import React, { useState, useEffect } from 'react';
import { QuizCard } from './components/QuizCard';
import { ResultSummary } from './components/ResultSummary';
import { QuestionNavigator } from './components/QuestionNavigator';
import { AuthModal } from './src/components/AuthModal';
import { StatsView } from './src/components/StatsView';
import {
    pb,
    isLoggedIn,
    getCurrentUser,
    logout,
    getCourses,
    getRandomQuestions as fetchRandomQuestions,
    getQuestionCount,
    saveExamResult,
    getUserStats,
    Course,
    Question,
    Answer,
    UserStats
} from './src/lib/pocketbase';
import {
    Loader2, BookOpen, ArrowRight, ArrowLeft, CheckCircle,
    Bot, AlertTriangle, Library, ChevronLeft, Gamepad2, User, LogIn
} from 'lucide-react';

const EXAM_QUESTION_COUNT = 15;

// Source configurations
const SOURCE_CONFIG = {
    previous: {
        id: 'previous',
        name: 'Exames Anteriores',
        icon: <Library className="w-8 h-8 text-indigo-600 mb-3" />,
        color: 'indigo',
        description: 'Perguntas oficiais de exames de anos anteriores.',
        warning: null
    },
    ai: {
        id: 'ai',
        name: 'Exames Gerados por IA',
        icon: <Bot className="w-8 h-8 text-fuchsia-600 mb-3" />,
        color: 'fuchsia',
        description: 'Perguntas geradas para prática extra.',
        warning: 'O conteúdo pode conter imprecisões'
    },
    kahoots: {
        id: 'kahoots',
        name: 'Kahoots',
        icon: <Gamepad2 className="w-8 h-8 text-teal-600 mb-3" />,
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

    // App State
    const [appState, setAppState] = useState<'loading' | 'source-select' | 'menu' | 'exam' | 'results' | 'profile'>('loading');
    const [statsRefreshKey, setStatsRefreshKey] = useState(0);

    // Exam State
    const [examQuestions, setExamQuestions] = useState<Question[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([]);
    const [examScore, setExamScore] = useState(0);

    // Check auth on mount
    useEffect(() => {
        setIsAuthenticated(isLoggedIn());

        // Listen for auth changes
        pb.authStore.onChange(() => {
            setIsAuthenticated(isLoggedIn());
        });
    }, []);

    // Load courses on mount
    useEffect(() => {
        const loadCourses = async () => {
            try {
                const coursesData = await getCourses();
                setCourses(coursesData);

                // Auto-select first course (TESIM)
                if (coursesData.length > 0) {
                    setSelectedCourse(coursesData[0]);
                }

                setAppState('source-select');
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
            const questions = await fetchRandomQuestions(
                selectedCourse.id,
                selectedSource,
                EXAM_QUESTION_COUNT
            );

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
        let totalPoints = 0;
        let correctCount = 0;

        answers.forEach(ans => {
            switch (ans.selectedAnswer.value) {
                case '++': totalPoints += 1; correctCount++; break;
                case '+': totalPoints += 0.33; break;
                case '-': totalPoints -= 0.33; break;
                case '--': totalPoints -= 1; break;
            }
        });

        const totalQuestions = examQuestions.length;
        const grade = totalQuestions > 0 ? (totalPoints / totalQuestions) * 20 : 0;

        return {
            score: Math.max(0, Math.round(grade * 10) / 10),
            correct: correctCount
        };
    };

    // Finish exam
    const finishExam = async () => {
        const { score, correct } = calculateScore(userAnswers);
        setExamScore(score);

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
            return 'bg-gray-500 border-gray-600 text-white';
        }
        return 'bg-white border-gray-300 text-gray-500';
    };

    // Get color class based on source
    const getSourceColorClass = (type: 'bg' | 'text' | 'border' | 'hover-border', variant: 'light' | 'normal' = 'normal') => {
        const colors = {
            previous: {
                bg: variant === 'light' ? 'bg-indigo-50' : 'bg-indigo-600',
                text: variant === 'light' ? 'text-indigo-700' : 'text-white',
                border: 'border-indigo-200',
                'hover-border': 'hover:border-indigo-500'
            },
            ai: {
                bg: variant === 'light' ? 'bg-fuchsia-50' : 'bg-fuchsia-600',
                text: variant === 'light' ? 'text-fuchsia-700' : 'text-white',
                border: 'border-fuchsia-200',
                'hover-border': 'hover:border-fuchsia-500'
            },
            kahoots: {
                bg: variant === 'light' ? 'bg-teal-50' : 'bg-teal-600',
                text: variant === 'light' ? 'text-teal-700' : 'text-white',
                border: 'border-teal-200',
                'hover-border': 'hover:border-teal-500'
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

    // Loading screen
    if (appState === 'loading' || (loading && appState === 'source-select')) {
        return (
            <div className="h-[100dvh] flex items-center justify-center bg-slate-50">
                <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
            </div>
        );
    }

    // Error screen
    if (error) {
        return (
            <div className="h-[100dvh] flex items-center justify-center bg-slate-50">
                <div className="p-8 text-center bg-white rounded-xl shadow-lg mx-4">
                    <div className="text-red-600 font-bold mb-4">{error}</div>
                    <button
                        onClick={() => window.location.reload()}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg"
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
        <div className="h-[100dvh] bg-slate-50 text-gray-800 font-sans selection:bg-indigo-100 flex flex-col overflow-hidden">
            {/* Header */}
            <header className="bg-white shadow-sm shrink-0 z-20 relative">
                <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => setAppState('source-select')}>
                        <div className="bg-indigo-600 p-2 rounded-lg shrink-0">
                            <BookOpen className="w-5 h-5 text-white" />
                        </div>
                        <h1 className="font-bold text-lg md:text-xl text-gray-900 tracking-tight truncate">
                            AntiÉpocaEspecial
                        </h1>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Source Badge */}
                        {appState !== 'source-select' && selectedSource && (
                            <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wide border truncate max-w-[100px] md:max-w-none
                ${getSourceColorClass('bg', 'light')} ${getSourceColorClass('text', 'light')} ${getSourceColorClass('border')}
              `}>
                                {SOURCE_CONFIG[selectedSource].name}
                            </span>
                        )}

                        {/* Profile/Login Button */}
                        {isAuthenticated ? (
                            <button
                                onClick={() => {
                                    setStatsRefreshKey(k => k + 1);
                                    setAppState('profile');
                                }}
                                className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-3 py-2 rounded-lg hover:shadow-md transition-all"
                            >
                                <User className="w-4 h-4" />
                                <span className="hidden md:inline text-sm font-medium">{user?.name || 'Perfil'}</span>
                            </button>
                        ) : (
                            <button
                                onClick={() => setShowAuthModal(true)}
                                className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg transition-all"
                            >
                                <LogIn className="w-4 h-4" />
                                <span className="hidden md:inline text-sm font-medium">Entrar</span>
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden w-full relative min-h-0">
                <div className="flex-1 flex flex-col w-full max-w-5xl mx-auto min-h-0">

                    {/* Source Selection */}
                    {appState === 'source-select' && (
                        <div className="flex-1 overflow-y-auto px-4 py-6 md:py-10 animate-fade-in custom-scrollbar">
                            <div className="flex flex-col items-center justify-center min-h-full max-w-4xl mx-auto">
                                <h1 className="text-2xl md:text-4xl font-extrabold text-gray-900 mb-2 tracking-tight text-center">
                                    Selecionar Fonte
                                </h1>
                                <p className="text-gray-500 mb-8 md:mb-12 text-center text-sm md:text-base">
                                    Escolhe a origem das perguntas
                                </p>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 w-full max-w-5xl">
                                    {(Object.keys(SOURCE_CONFIG) as SourceType[]).map(source => (
                                        <button
                                            key={source}
                                            onClick={() => loadSourceData(source)}
                                            disabled={loading}
                                            className={`bg-white p-6 md:p-8 rounded-2xl shadow-sm border-2 border-transparent 
                        ${SOURCE_CONFIG[source].color === 'indigo' ? 'hover:border-indigo-500' :
                                                    SOURCE_CONFIG[source].color === 'fuchsia' ? 'hover:border-fuchsia-500' :
                                                        'hover:border-teal-500'} 
                        hover:shadow-xl transition-all duration-300 text-left group disabled:opacity-50`}
                                        >
                                            <div className={`w-14 h-14 md:w-16 md:h-16 rounded-xl flex items-center justify-center mb-4 md:mb-6 group-hover:scale-110 transition-transform
                        ${SOURCE_CONFIG[source].color === 'indigo' ? 'bg-indigo-50' :
                                                    SOURCE_CONFIG[source].color === 'fuchsia' ? 'bg-fuchsia-50' :
                                                        'bg-teal-50'}`}
                                            >
                                                {SOURCE_CONFIG[source].icon}
                                            </div>
                                            <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-2">
                                                {SOURCE_CONFIG[source].name}
                                            </h3>
                                            <p className="text-sm md:text-base text-gray-500 mb-4">
                                                {SOURCE_CONFIG[source].description}
                                            </p>

                                            {SOURCE_CONFIG[source].warning && (
                                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3 mt-2">
                                                    <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                                                    <span className="text-xs text-amber-800 font-medium leading-tight">
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
                    {appState === 'menu' && selectedSource && (
                        <div className="flex-1 overflow-y-auto px-4 py-6 md:py-10 animate-fade-in custom-scrollbar">
                            <div className="flex flex-col items-center justify-center min-h-full max-w-2xl mx-auto text-center">
                                <div className="mb-8 p-6 bg-white rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden w-full">
                                    <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-2">Progresso do Estudo</h2>

                                    <div className="w-full max-w-[250px] h-2 bg-gray-200 rounded-full mx-auto mt-4 overflow-hidden">
                                        <div
                                            className={`h-full transition-all duration-1000 ${getSourceColorClass('bg')}`}
                                            style={{ width: `${questionCount > 0 ? ((questionCount - questionsLeft) / questionCount) * 100 : 0}%` }}
                                        />
                                    </div>
                                    <p className="mt-2 text-sm text-gray-500 font-medium">
                                        {isAuthenticated ? (
                                            questionsLeft > 0
                                                ? `${questionsLeft} perguntas por descobrir (${questionCount} total)`
                                                : "Todas as perguntas vistas!"
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => setShowAuthModal(true)}
                                                    className={`font-bold hover:underline ${getSourceColorClass('text', 'light')}`}
                                                >
                                                    Faz login
                                                </button>
                                                {' '}para guardares o teu progresso
                                            </>
                                        )}
                                    </p>

                                    {stats && (
                                        <div className="mt-4 inline-flex items-center px-3 py-1 rounded-full bg-gray-50 text-xs font-medium text-gray-600">
                                            Nota Média: {stats.averageScore.toFixed(1)} / 20
                                        </div>
                                    )}
                                </div>

                                <h1 className="text-3xl md:text-5xl font-extrabold text-gray-900 mb-4 md:mb-6 tracking-tight">
                                    Exame Modelo
                                </h1>
                                <p className="text-base md:text-lg text-gray-600 mb-8 md:mb-10 leading-relaxed max-w-lg mx-auto">
                                    Serás testado em {Math.min(EXAM_QUESTION_COUNT, questionCount)} perguntas aleatórias do conjunto <strong>{SOURCE_CONFIG[selectedSource].name}</strong>.
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
                                            <span>Iniciar Novo Exame</span>
                                            <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
                                        </>
                                    )}
                                </button>

                                <button
                                    onClick={() => setAppState('source-select')}
                                    className="mt-8 text-gray-400 hover:text-gray-600 text-sm font-medium flex items-center gap-1 transition-colors p-2"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                    Alterar Fonte
                                </button>

                                <div className="mt-12 text-sm text-gray-400 hidden md:block">
                                    <p>Dica: Usa as setas para navegar e 1-4 para responder.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Exam */}
                    {appState === 'exam' && examQuestions.length > 0 && (
                        <div className="flex-1 flex flex-col h-full overflow-hidden max-w-2xl mx-auto w-full relative">
                            <div className="shrink-0 pt-4 px-4 pb-0 z-10 bg-slate-50">
                                <QuestionNavigator
                                    total={examQuestions.length}
                                    current={currentQuestionIndex}
                                    onSelect={setCurrentQuestionIndex}
                                    getStatusColor={getExamStatusColor}
                                />
                            </div>

                            <div className="flex-1 overflow-y-auto px-4 pt-2 pb-32 custom-scrollbar">
                                <QuizCard
                                    key={examQuestions[currentQuestionIndex].id}
                                    question={examQuestions[currentQuestionIndex]}
                                    selectedAnswer={userAnswers.find(ua => ua.questionId === examQuestions[currentQuestionIndex].id)?.selectedAnswer}
                                    onAnswer={handleAnswer}
                                    showFeedback={false}
                                />
                            </div>

                            {/* Footer */}
                            <div className="fixed bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-50 flex items-center gap-3 md:relative md:bg-transparent md:border-t md:shadow-none md:p-4 md:pb-6">
                                <div className="w-full max-w-2xl mx-auto flex items-center gap-3">
                                    <button
                                        onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                                        disabled={currentQuestionIndex === 0}
                                        className="flex-1 flex items-center justify-center px-4 py-3 md:py-2 text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:shadow-sm rounded-xl disabled:opacity-40 disabled:hover:bg-gray-50 font-medium transition-all"
                                    >
                                        <ArrowLeft className="w-5 h-5 md:mr-2" />
                                        <span className="hidden md:inline">Anterior</span>
                                    </button>

                                    {currentQuestionIndex < examQuestions.length - 1 ? (
                                        <button
                                            onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                                            className={`flex-1 flex items-center justify-center px-4 py-3 md:py-2 text-white rounded-xl shadow-sm font-bold transition-all transform active:scale-95
                        ${getSourceColorClass('bg')} hover:opacity-90`}
                                        >
                                            <span className="hidden md:inline">Seguinte</span>
                                            <span className="md:hidden">Próxima</span>
                                            <ArrowRight className="w-5 h-5 ml-2" />
                                        </button>
                                    ) : (
                                        <button
                                            onClick={finishExam}
                                            className="flex-[2] flex items-center justify-center px-4 py-3 md:py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 shadow-md font-bold transition-all transform active:scale-95"
                                        >
                                            <span className="truncate">Submeter</span>
                                            <CheckCircle className="w-5 h-5 ml-2 shrink-0" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Results */}
                    {appState === 'results' && (
                        <div className="flex-1 flex flex-col h-full overflow-hidden px-2 py-2 md:px-4 md:py-4 relative">
                            <ResultSummary
                                questions={examQuestions}
                                userAnswers={userAnswers}
                                score={examScore}
                                onRestart={startExam}
                                onHome={() => setAppState('source-select')}
                            />
                        </div>
                    )}

                    {/* Stats/Profile */}
                    {appState === 'profile' && (
                        <StatsView
                            key={statsRefreshKey}
                            course={selectedCourse}
                            onClose={() => setAppState(selectedSource ? 'menu' : 'source-select')}
                        />
                    )}
                </div>
            </main>

            {/* Auth Modal */}
            {showAuthModal && (
                <AuthModal
                    onSuccess={() => {
                        setShowAuthModal(false);
                        setIsAuthenticated(true);
                    }}
                    onClose={() => setShowAuthModal(false)}
                />
            )}

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
        </div>
    );
};

export default App;