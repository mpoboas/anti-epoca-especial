import React, { useState, useEffect } from 'react';
import { QuizCard } from './components/QuizCard';
import { ResultSummary } from './components/ResultSummary';
import { HorizontalQuestionNav } from './components/shared/HorizontalQuestionNav';
import { NavigationFooter } from './components/shared/NavigationFooter';
import { AuthModal } from './src/components/AuthModal';
import { StatsView } from './src/components/StatsView';
import { AdminPanel } from './src/components/AdminPanel';
import { Confetti } from './components/Confetti';
import { QuestionFilter, FilterMode } from './components/QuestionFilter';
import { Leaderboard } from './components/Leaderboard';
import {
    pb,
    isLoggedIn,
    getCurrentUser,
    isAdmin,
    logout,
    getCourses,
    getFilteredRandomQuestions,
    getQuestionCount,
    saveExamResult,
    getUserStats,
    getThemes,
    Course,
    Question,
    Answer,
    UserStats
} from './src/lib/pocketbase';
import {
    Loader2, BookOpen, ArrowRight, ArrowLeft, CheckCircle,
    Bot, AlertTriangle, Library, ChevronLeft, Gamepad2, User, LogIn,
    Moon, Sun, Wrench, Trophy
} from 'lucide-react';

const EXAM_QUESTION_COUNT = 15;

// Source configurations
const SOURCE_CONFIG = {
    previous: {
        id: 'previous',
        name: 'Exames Anteriores',
        icon: <Library className="w-8 h-8 text-indigo-600" />,
        color: 'indigo',
        description: 'Perguntas oficiais de exames de anos anteriores.',
        warning: null
    },
    ai: {
        id: 'ai',
        name: 'Exames Gerados por IA',
        icon: <Bot className="w-8 h-8 text-fuchsia-600" />,
        color: 'fuchsia',
        description: 'Perguntas geradas para prática extra.',
        warning: 'O conteúdo pode conter imprecisões'
    },
    kahoots: {
        id: 'kahoots',
        name: 'Kahoots',
        icon: <Gamepad2 className="w-8 h-8 text-teal-600" />,
        color: 'teal',
        description: 'Perguntas de Kahoots disponibilizados pelos professores.',
        warning: null
    }
} as const;

type SourceType = keyof typeof SOURCE_CONFIG;

interface UserAnswer {
    questionId: string;
    selectedAnswer: Answer;
}

const App: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Auth
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    // Data
    const [courses, setCourses] = useState<Course[]>([]);
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [selectedSource, setSelectedSource] = useState<SourceType | null>(null);
    const [questionCount, setQuestionCount] = useState(0);
    const [stats, setStats] = useState<UserStats | null>(null);

    // Filter state
    const [filterMode, setFilterMode] = useState<FilterMode>('all');
    const [themes, setThemes] = useState<string[]>([]);
    const [selectedTheme, setSelectedTheme] = useState<string | null>(null);

    // App State
    const [appState, setAppState] = useState<'loading' | 'course-select' | 'source-select' | 'menu' | 'exam' | 'results' | 'profile' | 'admin' | 'leaderboard'>('loading');
    const [statsRefreshKey, setStatsRefreshKey] = useState(0);
    const [isDarkMode, setIsDarkMode] = useState(() => {
        const saved = localStorage.getItem('theme');
        // Default to light mode for new users
        return saved === 'dark';
    });

    // Exam State
    const [examQuestions, setExamQuestions] = useState<Question[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([]);
    const [examScore, setExamScore] = useState(0);

    // Confetti state
    const [showConfetti, setShowConfetti] = useState(false);

    // Confirmation state
    const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

    // Check auth on mount
    useEffect(() => {
        setIsAuthenticated(isLoggedIn());

        // Listen for auth changes
        pb.authStore.onChange(() => {
            setIsAuthenticated(isLoggedIn());
        });
    }, []);

    // Theme effect
    useEffect(() => {
        if (isDarkMode) {
            document.body.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.body.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [isDarkMode]);

    // Load courses on mount
    useEffect(() => {
        const loadCourses = async () => {
            try {
                const coursesData = await getCourses();
                setCourses(coursesData);
                setAppState('course-select');
            } catch (err) {
                console.error(err);
                setError('Não foi possível carregar os cursos. Verifica a conexão.');
            } finally {
                setLoading(false);
            }
        };

        loadCourses();
    }, []);

    // Load question count and stats when source is selected
    const loadSourceData = async (source: SourceType) => {
        if (!selectedCourse) return;

        setLoading(true);
        try {
            const count = await getQuestionCount(selectedCourse.id, source);
            setQuestionCount(count);

            if (isAuthenticated) {
                const userStats = await getUserStats(selectedCourse.id, source);
                setStats(userStats);
            }

            setSelectedSource(source);
            setFilterMode('all'); // Reset filter
            setSelectedTheme(null); // Reset theme

            // Load themes if kahoots
            if (source === 'kahoots') {
                const themesData = await getThemes(selectedCourse.id, source);
                setThemes(themesData);
            } else {
                setThemes([]);
            }

            setAppState('menu');
        } catch (err) {
            console.error(err);
            setError('Erro ao carregar dados.');
        } finally {
            setLoading(false);
        }
    };

    // Start exam
    const startExam = async () => {
        if (!selectedCourse || !selectedSource) return;

        setLoading(true);
        try {
            const questions = await getFilteredRandomQuestions(
                selectedCourse.id,
                selectedSource,
                EXAM_QUESTION_COUNT,
                filterMode,
                filterMode === 'theme' ? (selectedTheme || undefined) : undefined
            );

            if (questions.length === 0) {
                setError('Não há perguntas disponíveis com o filtro selecionado.');
                setLoading(false);
                return;
            }

            setExamQuestions(questions);
            setUserAnswers([]);
            setCurrentQuestionIndex(0);
            setAppState('exam');
        } catch (err) {
            console.error(err);
            setError('Erro ao carregar perguntas.');
        } finally {
            setLoading(false);
        }
    };

    // Handle answer
    const handleAnswer = (answer: Answer) => {
        const questionId = examQuestions[currentQuestionIndex].id;
        setUserAnswers(prev => {
            const existing = prev.filter(ua => ua.questionId !== questionId);
            return [...existing, { questionId, selectedAnswer: answer }];
        });
    };

    // Calculate score
    const calculateScore = (answers: UserAnswer[]): { score: number; correct: number } => {
        const totalQuestions = examQuestions.length;
        let correctCount = 0;

        answers.forEach(ans => {
            if (ans.selectedAnswer.value === '++') {
                correctCount++;
            }
        });

        let grade: number;

        if (selectedSource === 'kahoots') {
            // Kahoots: Simple scoring - each correct answer is worth 20/totalQuestions
            // Wrong answers don't deduct points
            grade = totalQuestions > 0 ? (correctCount / totalQuestions) * 20 : 0;
        } else {
            // Previous exams & AI: Complex scoring with deductions
            let totalPoints = 0;
            answers.forEach(ans => {
                switch (ans.selectedAnswer.value) {
                    case '++': totalPoints += 1; break;
                    case '+': totalPoints += 0.33; break;
                    case '-': totalPoints -= 0.33; break;
                    case '--': totalPoints -= 1; break;
                }
            });
            grade = totalQuestions > 0 ? (totalPoints / totalQuestions) * 20 : 0;
        }

        return {
            score: Math.max(0, Math.round(grade * 10) / 10),
            correct: correctCount
        };
    };

    // Finish exam
    const finishExam = async () => {
        const { score, correct } = calculateScore(userAnswers);
        setExamScore(score);

        // Check for perfect score (all correct)
        const allCorrect = userAnswers.length === examQuestions.length &&
            userAnswers.every(ua => ua.selectedAnswer.value === '++');

        if (allCorrect) {
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 5000);
        }

        // Save to database if authenticated
        if (isAuthenticated && selectedCourse && selectedSource) {
            try {
                // Build answers for ALL questions (including unanswered)
                const allAnswers = examQuestions.map(q => {
                    const userAnswer = userAnswers.find(ua => ua.questionId === q.id);
                    if (userAnswer) {
                        return {
                            questionId: q.id,
                            selectedAnswer: userAnswer.selectedAnswer
                        };
                    } else {
                        // For unanswered questions, we still save them with a null-like answer
                        return {
                            questionId: q.id,
                            selectedAnswer: { text: '(Não respondida)', value: '--' as const }
                        };
                    }
                });

                await saveExamResult(
                    selectedCourse.id,
                    selectedSource,
                    score,
                    examQuestions.length,
                    correct,
                    allAnswers
                );
            } catch (err) {
                console.error('Failed to save exam result:', err);
            }
        }

        setAppState('results');
    };

    // Get status color for navigator
    const getExamStatusColor = (index: number) => {
        const q = examQuestions[index];
        const isAnswered = userAnswers.some(ua => ua.questionId === q.id);

        if (isAnswered) {
            return 'bg-gray-500 dark:bg-slate-700 border-gray-600 dark:border-slate-600 text-white';
        }
        return 'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-700 text-gray-500 dark:text-slate-400';
    };

    // Get color class based on source
    const getSourceColorClass = (type: 'bg' | 'text' | 'border' | 'hover-border', variant: 'light' | 'normal' = 'normal') => {
        const colors = {
            previous: {
                bg: variant === 'light' ? 'bg-indigo-50 dark:bg-indigo-900/30' : 'bg-indigo-600 dark:bg-indigo-500',
                text: variant === 'light' ? 'text-indigo-700 dark:text-indigo-400' : 'text-white',
                border: 'border-indigo-200 dark:border-indigo-800',
                'hover-border': 'hover:border-indigo-500 dark:hover:border-indigo-400'
            },
            ai: {
                bg: variant === 'light' ? 'bg-fuchsia-50 dark:bg-fuchsia-900/30' : 'bg-fuchsia-600 dark:bg-fuchsia-500',
                text: variant === 'light' ? 'text-fuchsia-700 dark:text-fuchsia-400' : 'text-white',
                border: 'border-fuchsia-200 dark:border-fuchsia-800',
                'hover-border': 'hover:border-fuchsia-500 dark:hover:border-fuchsia-400'
            },
            kahoots: {
                bg: variant === 'light' ? 'bg-teal-50 dark:bg-teal-900/30' : 'bg-teal-600 dark:bg-teal-500',
                text: variant === 'light' ? 'text-teal-700 dark:text-teal-400' : 'text-white',
                border: 'border-teal-200 dark:border-teal-800',
                'hover-border': 'hover:border-teal-500 dark:hover:border-teal-400'
            }
        };

        return selectedSource ? colors[selectedSource][type] : colors.previous[type];
    };

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (appState !== 'exam') return;

            const currentQ = examQuestions[currentQuestionIndex];
            if (!currentQ) return;

            switch (e.key) {
                case 'ArrowRight':
                case 'Enter':
                    if (currentQuestionIndex < examQuestions.length - 1) {
                        setCurrentQuestionIndex(prev => prev + 1);
                    }
                    break;
                case 'ArrowLeft':
                    if (currentQuestionIndex > 0) {
                        setCurrentQuestionIndex(prev => prev - 1);
                    }
                    break;
                case '1':
                case 'a':
                case 'A':
                    if (currentQ.answers[0]) handleAnswer(currentQ.answers[0]);
                    break;
                case '2':
                case 'b':
                case 'B':
                    if (currentQ.answers[1]) handleAnswer(currentQ.answers[1]);
                    break;
                case '3':
                case 'c':
                case 'C':
                    if (currentQ.answers[2]) handleAnswer(currentQ.answers[2]);
                    break;
                case '4':
                case 'd':
                case 'D':
                    if (currentQ.answers[3]) handleAnswer(currentQ.answers[3]);
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [appState, currentQuestionIndex, examQuestions]);

    if (appState === 'loading' || (loading && appState === 'source-select')) {
        return (
            <div className="h-[100dvh] flex items-center justify-center bg-slate-50 dark:bg-slate-950">
                <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
            </div>
        );
    }

    // Error screen
    if (error) {
        return (
            <div className="h-[100dvh] flex items-center justify-center bg-slate-50 dark:bg-slate-950">
                <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-xl shadow-lg mx-4 border dark:border-slate-800">
                    <div className="text-red-600 font-bold mb-4">{error}</div>
                    <button
                        onClick={() => {
                            setError(null);
                            window.location.reload();
                        }}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg"
                    >
                        Recarregar
                    </button>
                </div>
            </div>
        );
    }

    const questionsLeft = stats ? Math.max(0, stats.totalQuestionsInPool - stats.uniqueQuestionsSeen) : questionCount;
    const user = getCurrentUser();

    return (
        <div className="h-[100dvh] bg-slate-50 dark:bg-slate-950 text-gray-800 dark:text-slate-200 font-sans selection:bg-blue-100 dark:selection:bg-blue-900 flex flex-col overflow-hidden transition-colors duration-300">
            {/* Confetti Overlay */}
            <Confetti isActive={showConfetti} />

            {/* Header */}
            <header className="bg-white dark:bg-slate-900 shadow-sm shrink-0 z-20 relative border-b dark:border-slate-800">
                <div className="max-w-5xl mx-auto px-3 md:px-4 py-2.5 md:py-4 flex items-center justify-between">
                    <div
                        className="flex items-center gap-2 cursor-pointer transition-transform active:scale-95"
                        onClick={() => {
                            setAppState('course-select');
                            setSelectedCourse(null);
                            setSelectedSource(null);
                            setSelectedTheme(null);
                        }}
                    >
                        <img src="/logo.png" className="w-8 h-8 md:w-11 md:h-11 rounded-lg md:rounded-xl shrink-0 object-contain" alt="Logo" />
                        <h1 className="font-bold text-lg md:text-xl text-gray-900 dark:text-white tracking-tight hidden sm:block">
                            AntiÉpoca<span className="text-lime-500 dark:text-lime-400">Especial</span>
                        </h1>
                    </div>

                    <div className="flex items-center gap-1.5 md:gap-3">
                        {/* Source Badge */}
                        {appState !== 'source-select' && selectedSource && (
                            <span className={`px-2 py-0.5 md:py-1 rounded text-[10px] md:text-xs font-bold uppercase tracking-wide border truncate max-w-[70px] sm:max-w-none
                                ${getSourceColorClass('bg', 'light')} ${getSourceColorClass('text', 'light')} ${getSourceColorClass('border')}
                            `}>
                                {SOURCE_CONFIG[selectedSource].name}
                            </span>
                        )}

                        <div className="flex items-center gap-1 md:gap-2 bg-gray-50 dark:bg-slate-800/50 p-1 rounded-xl">
                            {/* Leaderboard Button */}
                            <button
                                onClick={() => setAppState('leaderboard')}
                                className="p-2 rounded-lg text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors"
                                aria-label="Leaderboard"
                                title="Ranking de Alunos"
                            >
                                <Trophy className="w-5 h-5" />
                            </button>

                            {/* Theme Toggle */}
                            <button
                                onClick={() => setIsDarkMode(!isDarkMode)}
                                className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                aria-label="Toggle dark mode"
                            >
                                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                            </button>

                            {/* Admin Button */}
                            {isAuthenticated && isAdmin() && (
                                <button
                                    onClick={() => setAppState('admin')}
                                    className="p-2 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                                    aria-label="Admin panel"
                                    title="Painel de Administração"
                                >
                                    <Wrench className="w-5 h-5" />
                                </button>
                            )}
                        </div>

                        {/* Profile/Login Button */}
                        {isAuthenticated ? (
                            <button
                                onClick={() => {
                                    setStatsRefreshKey(k => k + 1);
                                    setAppState('profile');
                                }}
                                className="flex items-center gap-2 bg-dark-gradient text-white p-2 md:px-3 md:py-2.5 rounded-xl hover:shadow-md transition-all border border-blue-900/30 shadow-sm active:scale-95"
                            >
                                <User className="w-5 h-5 text-lime-400 shrink-0" />
                                <span className="hidden md:inline text-sm font-bold tracking-tight">{user?.name || 'Perfil'}</span>
                            </button>
                        ) : (
                            <button
                                onClick={() => setShowAuthModal(true)}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white p-1.5 md:px-4 md:py-2 rounded-xl transition-all shadow-md active:scale-95"
                            >
                                <LogIn className="w-4 h-4" />
                                <span className="hidden md:inline text-sm font-bold tracking-tight">Entrar</span>
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden w-full relative min-h-0">
                <div className="flex-1 flex flex-col w-full min-h-0">

                    {/* Course Selection */}
                    {appState === 'course-select' && (
                        <div className="flex-1 overflow-y-auto px-4 py-6 md:py-10 page-transition custom-scrollbar">
                            <div className="flex flex-col items-center justify-center min-h-full max-w-5xl mx-auto">
                                <h1 className="text-2xl md:text-4xl font-extrabold text-gray-900 dark:text-white mb-2 tracking-tight text-center">
                                    Selecionar Cadeira
                                </h1>
                                <p className="text-gray-500 dark:text-slate-400 mb-8 md:mb-12 text-center text-sm md:text-base">
                                    Escolhe a disciplina para estudar
                                </p>

                                <div className={`w-full ${courses.length < 3
                                    ? 'flex flex-col md:flex-row flex-wrap items-center justify-center gap-6'
                                    : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl'
                                    }`}>
                                    {courses.map(course => (
                                        <button
                                            key={course.id}
                                            onClick={() => {
                                                setSelectedCourse(course);
                                                setAppState('source-select');
                                            }}
                                            className={`bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border-2 border-transparent hover:border-blue-500 hover:shadow-xl transition-all duration-300 text-left group ${courses.length < 3 ? 'w-full max-w-sm' : ''}`}
                                        >
                                            <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                                <BookOpen className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                                            </div>
                                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                                                {course.title}
                                            </h3>
                                            <p className="text-gray-500 dark:text-slate-400">
                                                {course.description || 'Cadeira disponível para estudo.'}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Source Selection */}
                    {appState === 'source-select' && selectedCourse && (
                        <div className="flex-1 overflow-y-auto px-4 py-6 md:py-10 page-transition custom-scrollbar">
                            <div className="flex flex-col items-center justify-center min-h-full max-w-5xl mx-auto">
                                <button
                                    onClick={() => {
                                        setSelectedCourse(null);
                                        setSelectedSource(null);
                                        setSelectedTheme(null);
                                        setAppState('course-select');
                                    }}
                                    className="mb-8 flex items-center gap-1 text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 transition-colors self-start"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                    Mudar de Cadeira
                                </button>
                                <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white mb-2 tracking-tight text-center">
                                    {selectedCourse.title}
                                </h1>
                                <p className="text-gray-500 dark:text-slate-400 mb-8 md:mb-12 text-center text-sm md:text-base">
                                    Escolhe a origem das perguntas
                                </p>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 w-full max-w-5xl">
                                    {(Object.keys(SOURCE_CONFIG) as SourceType[]).map(source => (
                                        <button
                                            key={source}
                                            onClick={() => loadSourceData(source)}
                                            disabled={loading}
                                            className={`bg-white dark:bg-slate-900 p-6 md:p-8 rounded-2xl shadow-sm border-2 border-transparent 
                        ${SOURCE_CONFIG[source].color === 'indigo' ? 'hover:border-indigo-500' :
                                                    SOURCE_CONFIG[source].color === 'fuchsia' ? 'hover:border-fuchsia-500' :
                                                        'hover:border-teal-500'} 
                        hover:shadow-xl dark:shadow-blue-900/10 transition-all duration-300 text-left group disabled:opacity-50`}
                                        >
                                            <div className={`w-14 h-14 md:w-16 md:h-16 rounded-xl flex items-center justify-center mb-2 group-hover:scale-110 transition-transform
                        ${SOURCE_CONFIG[source].color === 'indigo' ? 'bg-indigo-50 dark:bg-indigo-950/50' :
                                                    SOURCE_CONFIG[source].color === 'fuchsia' ? 'bg-fuchsia-50 dark:bg-fuchsia-950/50' :
                                                        'bg-teal-50 dark:bg-teal-950/50'}`}
                                            >
                                                {SOURCE_CONFIG[source].icon}
                                            </div>
                                            <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white mb-2">
                                                {SOURCE_CONFIG[source].name}
                                            </h3>
                                            <p className="text-sm md:text-base text-gray-500 dark:text-slate-400 mb-4">
                                                {SOURCE_CONFIG[source].description}
                                            </p>

                                            {SOURCE_CONFIG[source].warning && (
                                                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-start gap-3 mt-2">
                                                    <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                                                    <span className="text-xs text-amber-800 dark:text-amber-300 font-medium leading-tight">
                                                        {SOURCE_CONFIG[source].warning}
                                                    </span>
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Menu */}
                    {
                        appState === 'menu' && selectedSource && (
                            <div className="flex-1 overflow-y-auto px-4 py-6 md:py-10 page-transition custom-scrollbar">
                                <div className="flex flex-col items-center justify-center min-h-full max-w-2xl mx-auto text-center">
                                    <div className="mb-8 p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 relative overflow-hidden w-full">
                                        <h2 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white mb-2">Progresso do Estudo</h2>

                                        <div className="w-full max-w-[250px] h-2 bg-gray-200 dark:bg-slate-800 rounded-full mx-auto mt-4 overflow-hidden">
                                            <div
                                                className={`h-full transition-all duration-1000 ${getSourceColorClass('bg')}`}
                                                style={{ width: `${questionCount > 0 ? ((questionCount - questionsLeft) / questionCount) * 100 : 0}%` }}
                                            />
                                        </div>
                                        <p className="mt-2 text-sm text-gray-500 dark:text-slate-400 font-medium">
                                            {isAuthenticated ? (
                                                questionsLeft > 0
                                                    ? `${questionsLeft} perguntas por descobrir (${questionCount} total)`
                                                    : "Todas as perguntas vistas!"
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => setShowAuthModal(true)}
                                                        className={`font-bold hover:underline text-glow ${getSourceColorClass('text', 'light')}`}
                                                    >
                                                        Faz login
                                                    </button>
                                                    {' '}para guardares o teu progresso
                                                </>
                                            )}
                                        </p>

                                        {stats && (
                                            <div className="mt-4 inline-flex items-center px-3 py-1 rounded-full bg-gray-50 dark:bg-slate-800 text-xs font-medium text-gray-600 dark:text-slate-400">
                                                Nota Média: {stats.averageScore.toFixed(1)} / 20
                                            </div>
                                        )}
                                    </div>

                                    {/* Question Filter */}
                                    {isAuthenticated && (
                                        <div className="mb-8 w-full max-w-md">
                                            <QuestionFilter
                                                currentFilter={filterMode}
                                                onFilterChange={setFilterMode}
                                                colorClass={getSourceColorClass('bg')}
                                                disabled={loading}
                                                themes={themes}
                                                selectedTheme={selectedTheme}
                                                onThemeChange={setSelectedTheme}
                                            />
                                        </div>
                                    )}

                                    <p className="text-base md:text-lg text-gray-600 dark:text-slate-400 mb-8 md:mb-10 leading-relaxed max-w-lg mx-auto">
                                        Serás testado em {EXAM_QUESTION_COUNT} perguntas do conjunto <strong>{SOURCE_CONFIG[selectedSource].name}</strong>.
                                    </p>

                                    <button
                                        onClick={startExam}
                                        disabled={loading || questionCount === 0}
                                        className={`w-full md:w-auto group relative inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white transition-all duration-200 rounded-xl md:rounded-full hover:shadow-lg transform active:scale-95 hover:-translate-y-1 disabled:opacity-50
                    ${getSourceColorClass('bg')} hover:opacity-90`}
                                    >
                                        {loading ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : (
                                            <>
                                                <span>Iniciar Exame</span>
                                                <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
                                            </>
                                        )}
                                    </button>

                                    <button
                                        onClick={() => {
                                            setSelectedSource(null);
                                            setSelectedTheme(null);
                                            setAppState('source-select');
                                        }}
                                        className="mt-8 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 text-sm font-medium flex items-center gap-1 transition-colors p-2"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                        Alterar Fonte
                                    </button>

                                    <div className="mt-12 text-sm text-gray-400 dark:text-slate-500 hidden md:block">
                                        <p>Dica: Usa as setas para navegar e 1-4 para responder.</p>
                                    </div>
                                </div>
                            </div>
                        )
                    }

                    {
                        appState === 'exam' && examQuestions.length > 0 && (
                            <div className="flex-1 flex flex-col h-full overflow-hidden w-full relative">
                                {/* Question Navigator - Centered */}
                                <HorizontalQuestionNav
                                    total={examQuestions.length}
                                    current={currentQuestionIndex}
                                    onSelect={setCurrentQuestionIndex}
                                    getStatusColor={getExamStatusColor}
                                />

                                <div className="flex-1 overflow-y-auto py-4 flex flex-col">
                                    <div className="flex-1 flex flex-col justify-center max-w-3xl mx-auto w-full px-4">
                                        <QuizCard
                                            key={examQuestions[currentQuestionIndex].id}
                                            question={examQuestions[currentQuestionIndex]}
                                            selectedAnswer={userAnswers.find(ua => ua.questionId === examQuestions[currentQuestionIndex].id)?.selectedAnswer}
                                            onAnswer={handleAnswer}
                                            showFeedback={false}
                                        />
                                    </div>
                                </div>

                                {/* Navigation Footer */}
                                <div className="shrink-0 flex flex-col">
                                    {currentQuestionIndex === examQuestions.length - 1 && (
                                        <div className="px-4 pb-2 max-w-3xl mx-auto w-full">
                                            <button
                                                onClick={() => setShowSubmitConfirm(true)}
                                                className="w-full flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 shadow-lg font-bold transition-all transform active:scale-95"
                                            >
                                                Submeter Exame
                                                <CheckCircle className="w-5 h-5 ml-2" />
                                            </button>
                                        </div>
                                    )}
                                    <NavigationFooter
                                        currentIndex={currentQuestionIndex}
                                        totalCount={examQuestions.length}
                                        onPrevious={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                                        onNext={() => setCurrentQuestionIndex(prev => Math.min(examQuestions.length - 1, prev + 1))}
                                    />
                                </div>

                                {/* Submit Confirmation Modal */}
                                {showSubmitConfirm && (
                                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
                                        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-800 p-6 w-full max-w-md animate-in zoom-in-95 duration-200">
                                            <div className="flex items-center gap-3 mb-4 text-amber-600">
                                                <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
                                                    <AlertTriangle className="w-7 h-7" />
                                                </div>
                                                <div>
                                                    <h3 className="text-xl font-bold dark:text-white">Submeter Exame?</h3>
                                                    <p className="text-sm text-gray-500 dark:text-slate-400">Verifica se respondeste a tudo.</p>
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <div className="p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-100 dark:border-slate-800">
                                                    <div className="flex justify-between items-center text-sm mb-1">
                                                        <span className="text-gray-500 dark:text-slate-400">Perguntas Respondidas:</span>
                                                        <span className="font-bold dark:text-white">{userAnswers.length}/{examQuestions.length}</span>
                                                    </div>
                                                    <div className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-green-500 transition-all duration-500"
                                                            style={{ width: `${(userAnswers.length / examQuestions.length) * 100}%` }}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-3">
                                                    <button
                                                        onClick={() => setShowSubmitConfirm(false)}
                                                        className="px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 font-bold hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                                                    >
                                                        Cancelar
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setShowSubmitConfirm(false);
                                                            finishExam();
                                                        }}
                                                        className="px-4 py-3 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 shadow-lg shadow-green-600/20 transition-all active:scale-95"
                                                    >
                                                        Submeter
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    }

                    {/* Results */}
                    {
                        appState === 'results' && (
                            <div className="flex-1 flex flex-col h-full overflow-hidden w-full relative page-transition">
                                <ResultSummary
                                    questions={examQuestions}
                                    userAnswers={userAnswers}
                                    score={examScore}
                                    onRestart={startExam}
                                    onHome={() => setAppState('course-select')}
                                />
                            </div>
                        )
                    }

                    {/* Stats/Profile */}
                    {/* Stats/Profile */}
                    {appState === 'profile' && (
                        <StatsView
                            key={statsRefreshKey}
                            courses={courses}
                            onClose={() => setAppState(selectedSource ? 'menu' : (selectedCourse ? 'source-select' : 'course-select'))}
                        />
                    )}

                    {/* Leaderboard View */}
                    {/* Leaderboard View */}
                    {appState === 'leaderboard' && (
                        <div className="flex-1 flex flex-col h-full overflow-hidden w-full relative page-transition">
                            <Leaderboard
                                courses={courses}
                                onBack={() => setAppState(selectedSource ? 'menu' : (selectedCourse ? 'source-select' : 'course-select'))}
                            />
                        </div>
                    )}

                    {/* Admin Panel */}
                    {
                        appState === 'admin' && (
                            <AdminPanel
                                courses={courses}
                                onClose={() => setAppState('source-select')}
                            />
                        )
                    }
                </div >
            </main >

            {/* Auth Modal */}
            {
                showAuthModal && (
                    <AuthModal
                        onSuccess={() => {
                            setShowAuthModal(false);
                            setIsAuthenticated(true);
                        }}
                        onClose={() => setShowAuthModal(false)}
                    />
                )
            }

            {/* Styles */}
            <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.6s ease-out forwards;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #cbd5e1;
          border-radius: 20px;
        }
      `}</style>
        </div >
    );
};

export default App;