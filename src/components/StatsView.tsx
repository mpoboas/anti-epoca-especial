import React, { useState, useEffect } from 'react';
import {
    getCurrentUser,
    logout,
    pb,
    Course,
    ExamResult,
    ExamAnswer,
    Question,
    getQuestionCount
} from '../lib/pocketbase';
import {
    LogOut, ChevronLeft, Loader2, Info, TrendingUp, Clock,
    Library, Bot, Gamepad2, CheckCircle, XCircle, Eye
} from 'lucide-react';
import { ResultHeader, NavigationFooter, HorizontalQuestionNav } from '../../components/shared';
import { QuizCard } from '../../components/QuizCard';
import {
    Chart as ChartJS,
    ArcElement,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import { Doughnut, Line } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
    ArcElement,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

interface StatsViewProps {
    course: Course | null;
    onClose: () => void;
}

interface DetailedStats {
    totalExams: number;
    passedExams: number;
    failedExams: number;
    averageScore: number;
    averageScoreOutOf100: number;
    totalQuestionsAnswered: number;
    correctAnswersTotal: number;
    incorrectAnswersTotal: number;
    uniqueQuestionsSeen: number;
    totalQuestionsInPool: number;
    percentageComplete: number;
    examsBySource: { previous: number; ai: number; kahoots: number };
    scoreHistory: { date: string; score: number; source: string }[];
    examResults: ExamResult[];
}

interface ExamDetailData {
    examResult: ExamResult;
    answers: (ExamAnswer & { questionData?: Question })[];
}

export const StatsView: React.FC<StatsViewProps> = ({ course, onClose }) => {
    const [stats, setStats] = useState<DetailedStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedExam, setSelectedExam] = useState<ExamDetailData | null>(null);
    const [loadingExam, setLoadingExam] = useState(false);
    const user = getCurrentUser();

    useEffect(() => {
        let isMounted = true;

        const loadStats = async () => {
            if (!course || !user) {
                if (isMounted) setLoading(false);
                return;
            }

            try {
                let filter = `user = "${user.id}"`;
                if (course) {
                    filter += ` && course = "${course.id}"`;
                }

                const examResults = await pb.collection('exam_results').getFullList<ExamResult & { expand?: { course: Course } }>({
                    filter,
                    sort: '-created',
                    expand: 'course',
                });

                if (!isMounted) return;

                let totalQuestionsInPool = 0;
                if (course) {
                    totalQuestionsInPool =
                        await getQuestionCount(course.id, 'previous') +
                        await getQuestionCount(course.id, 'ai') +
                        await getQuestionCount(course.id, 'kahoots');
                } else {
                    // Global view: maybe just sum of all questions across all courses?
                    // For now, let's keep it 0 or omit it
                }

                if (!isMounted) return;

                const totalExams = examResults.length;
                const passedExams = examResults.filter(e => e.score >= 10).length;
                const failedExams = totalExams - passedExams;
                const averageScore = totalExams > 0
                    ? examResults.reduce((sum, e) => sum + e.score, 0) / totalExams
                    : 0;

                const totalQuestionsAnswered = examResults.reduce((sum, e) => sum + e.total_questions, 0);
                const correctAnswersTotal = examResults.reduce((sum, e) => sum + e.correct_answers, 0);
                const incorrectAnswersTotal = totalQuestionsAnswered - correctAnswersTotal;

                let uniqueQuestionsSeen = 0;
                if (examResults.length > 0) {
                    const examIds = examResults.map(e => e.id);
                    const batchSize = 10;
                    const allQuestionIds = new Set<string>();

                    for (let i = 0; i < examIds.length; i += batchSize) {
                        const batch = examIds.slice(i, i + batchSize);
                        const filterExamIds = batch.map(id => `exam_result = "${id}"`).join(' || ');

                        try {
                            const examAnswers = await pb.collection('exam_answers').getFullList<ExamAnswer>({
                                filter: filterExamIds,
                            });
                            examAnswers.forEach(a => allQuestionIds.add(a.question));
                        } catch (e) {
                            console.error('Error fetching exam answers batch:', e);
                        }
                    }
                    uniqueQuestionsSeen = allQuestionIds.size;
                }

                const examsBySource = {
                    previous: examResults.filter(e => e.source === 'previous').length,
                    ai: examResults.filter(e => e.source === 'ai').length,
                    kahoots: examResults.filter(e => e.source === 'kahoots').length,
                };

                const scoreHistory = [...examResults]
                    .reverse()
                    .slice(-20)
                    .map(e => ({
                        date: e.created,
                        score: e.score,
                        source: e.source,
                    }));

                if (isMounted) {
                    setStats({
                        totalExams,
                        passedExams,
                        failedExams,
                        averageScore: Math.round(averageScore * 10) / 10,
                        averageScoreOutOf100: Math.round((averageScore / 20) * 100),
                        totalQuestionsAnswered,
                        correctAnswersTotal,
                        incorrectAnswersTotal,
                        uniqueQuestionsSeen,
                        totalQuestionsInPool,
                        percentageComplete: totalQuestionsInPool > 0
                            ? Math.round((uniqueQuestionsSeen / totalQuestionsInPool) * 1000) / 10
                            : 0,
                        examsBySource,
                        scoreHistory,
                        examResults,
                    });
                }
            } catch (error) {
                console.error('Error loading stats:', error);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        loadStats();

        return () => {
            isMounted = false;
        };
    }, [course, user?.id]);

    const loadExamDetails = async (examResult: ExamResult) => {
        setLoadingExam(true);
        try {
            // Load answers for this exam
            const answers = await pb.collection('exam_answers').getFullList<ExamAnswer>({
                filter: `exam_result = "${examResult.id}"`,
                requestKey: null,
            });

            // Load questions for these answers
            const questionIds = answers.map(a => a.question);
            const questionsFilter = questionIds.map(id => `id = "${id}"`).join(' || ');

            let questions: Question[] = [];
            if (questionsFilter) {
                questions = await pb.collection('questions').getFullList<Question>({
                    filter: questionsFilter,
                    requestKey: null,
                });
            }

            // Map questions to answers
            const answersWithQuestions = answers.map(a => ({
                ...a,
                questionData: questions.find(q => q.id === a.question),
            }));

            setSelectedExam({
                examResult,
                answers: answersWithQuestions,
            });
        } catch (error) {
            console.error('Error loading exam details:', error);
        } finally {
            setLoadingExam(false);
        }
    };

    const handleLogout = () => {
        logout();
        onClose();
    };

    const getSourceIcon = (source: string) => {
        switch (source) {
            case 'previous': return <Library className="w-4 h-4" />;
            case 'ai': return <Bot className="w-4 h-4" />;
            case 'kahoots': return <Gamepad2 className="w-4 h-4" />;
            default: return null;
        }
    };

    const getSourceLabel = (source: string) => {
        switch (source) {
            case 'previous': return 'Exames Anteriores';
            case 'ai': return 'IA';
            case 'kahoots': return 'Kahoots';
            default: return source;
        }
    };

    const getSourceColor = (source: string) => {
        switch (source) {
            case 'previous': return 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400';
            case 'ai': return 'bg-fuchsia-100 dark:bg-fuchsia-900/40 text-fuchsia-700 dark:text-fuchsia-400';
            case 'kahoots': return 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-400';
            default: return 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-400';
        }
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-950">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (!stats || !user) {
        // Auto-redirect when not logged in
        onClose();
        return null;
    }

    // Show exam details view
    if (selectedExam) {
        return (
            <ExamDetailView
                examData={selectedExam}
                onBack={() => setSelectedExam(null)}
                getSourceLabel={getSourceLabel}
                getSourceColor={getSourceColor}
                getSourceIcon={getSourceIcon}
            />
        );
    }

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 transition-colors duration-300 animate-fade-in custom-scrollbar">
            <div className="max-w-6xl mx-auto p-4 md:p-6">
                {/* Back Button & Profile Header */}
                <div className="flex items-center justify-between mb-6">
                    <button
                        onClick={onClose}
                        className="flex items-center gap-1 text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                        <span>Voltar</span>
                    </button>

                    <div className="flex items-center gap-3">
                        <div className="text-right">
                            <p className="text-sm font-medium text-gray-800 dark:text-slate-100">{user?.name || 'Estudante'}</p>
                            <p className="text-xs text-gray-500 dark:text-slate-400">{user?.email}</p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 p-2 rounded-lg transition-colors text-gray-600 dark:text-slate-400"
                            title="Terminar sessão"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Summary Banner */}
                <div className="bg-dark-gradient text-white rounded-2xl p-6 mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-blue-900/50 glow-border">
                    <div className="flex items-start gap-3">
                        <Info className="w-5 h-5 mt-0.5 shrink-0 text-lime-400" />
                        <p className="text-sm md:text-base leading-relaxed">
                            Já respondeste a <span className="font-bold text-lime-400 text-glow">{stats.totalExams}</span> exames{course ? ` na cadeira ${course.title}` : ''}.
                            {stats.totalQuestionsInPool > 0 && (
                                <>
                                    {" "}Das <span className="font-bold">{stats.totalQuestionsInPool}</span> questões disponíveis
                                    respondeste a <span className="font-bold text-lime-400 text-glow">{stats.uniqueQuestionsSeen}</span>,
                                    ou seja <span className="font-bold text-lime-400 text-glow">{stats.percentageComplete}%</span>.
                                </>
                            )}
                        </p>
                    </div>

                    {/* Score Gauge */}
                    <div className="shrink-0 flex flex-col items-center bg-white/10 rounded-xl p-3">
                        <div className="relative w-24 h-14">
                            <svg viewBox="0 0 100 50" className="w-full h-full">
                                <path
                                    d="M 10 50 A 40 40 0 0 1 90 50"
                                    fill="none"
                                    stroke="rgba(255,255,255,0.3)"
                                    strokeWidth="8"
                                    strokeLinecap="round"
                                />
                                <path
                                    d="M 10 50 A 40 40 0 0 1 90 50"
                                    fill="none"
                                    stroke={stats.averageScoreOutOf100 >= 50 ? '#86efac' : '#fca5a5'}
                                    strokeWidth="8"
                                    strokeLinecap="round"
                                    strokeDasharray={`${(stats.averageScoreOutOf100 / 100) * 126} 126`}
                                />
                            </svg>
                        </div>
                        <div className="text-center -mt-1">
                            <p className="text-xl font-bold">{stats.averageScore}<span className="text-sm font-normal opacity-80">/20</span></p>
                        </div>
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <QuickStat label="Exames Feitos" value={stats.totalExams} color="indigo" />
                    <QuickStat
                        label="Taxa de Aprovação"
                        value={`${stats.totalExams > 0 ? Math.round((stats.passedExams / stats.totalExams) * 100) : 0}%`}
                        color="green"
                    />
                    <QuickStat
                        label="Perguntas Vistas"
                        value={`${stats.uniqueQuestionsSeen}/${stats.totalQuestionsInPool}`}
                        color="purple"
                    />
                    <QuickStat
                        label="Taxa de Acerto"
                        value={`${stats.totalQuestionsAnswered > 0 ? Math.round((stats.correctAnswersTotal / stats.totalQuestionsAnswered) * 100) : 0}%`}
                        color="blue"
                    />
                </div>

                {/* Pie Charts Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    {/* Exams Pie */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-slate-800">
                        <h3 className="font-bold text-gray-800 dark:text-slate-100 mb-4 text-center">Número de Exames</h3>
                        <div className="flex justify-center mb-4">
                            <PieChart
                                data={[
                                    { value: stats.passedExams, color: '#22c55e', label: 'Aprovado' },
                                    { value: stats.failedExams, color: '#ef4444', label: 'Reprovado' },
                                ]}
                                size={120}
                            />
                        </div>
                        <div className="flex justify-center gap-4 text-xs text-gray-600 dark:text-slate-400">
                            <span className="flex items-center gap-1">
                                <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                                Aprovado ({stats.passedExams})
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                                Reprovado ({stats.failedExams})
                            </span>
                        </div>
                    </div>

                    {/* Questions Pie */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-slate-800">
                        <h3 className="font-bold text-gray-800 dark:text-slate-100 mb-4 text-center">Respostas</h3>
                        <div className="flex justify-center mb-4">
                            <PieChart
                                data={[
                                    { value: stats.correctAnswersTotal, color: '#22c55e', label: 'Corretas' },
                                    { value: stats.incorrectAnswersTotal, color: '#ef4444', label: 'Erradas' },
                                ]}
                                size={120}
                            />
                        </div>
                        <div className="flex justify-center gap-4 text-xs text-gray-600 dark:text-slate-400">
                            <span className="flex items-center gap-1">
                                <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                                Corretas ({stats.correctAnswersTotal})
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                                Erradas ({stats.incorrectAnswersTotal})
                            </span>
                        </div>
                    </div>

                    {/* Source Pie */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-slate-800">
                        <h3 className="font-bold text-gray-800 dark:text-slate-100 mb-4 text-center">Tipo de Exame</h3>
                        <div className="flex justify-center mb-4">
                            <PieChart
                                data={[
                                    { value: stats.examsBySource.previous, color: '#6366f1', label: 'Anteriores' },
                                    { value: stats.examsBySource.ai, color: '#d946ef', label: 'IA' },
                                    { value: stats.examsBySource.kahoots, color: '#14b8a6', label: 'Kahoots' },
                                ]}
                                size={120}
                            />
                        </div>
                        <div className="flex justify-center gap-3 text-xs flex-wrap text-gray-600 dark:text-slate-400">
                            <span className="flex items-center gap-1">
                                <span className="w-3 h-3 bg-indigo-500 rounded-full"></span>
                                Anteriores ({stats.examsBySource.previous})
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-3 h-3 bg-fuchsia-500 rounded-full"></span>
                                IA ({stats.examsBySource.ai})
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-3 h-3 bg-teal-500 rounded-full"></span>
                                Kahoots ({stats.examsBySource.kahoots})
                            </span>
                        </div>
                    </div>
                </div>

                {/* Score Evolution Chart */}
                {stats.scoreHistory.length > 1 && (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-slate-800 mb-6">
                        <div className="flex items-center gap-2 mb-4">
                            <TrendingUp className="w-5 h-5 text-gray-400" />
                            <h3 className="font-bold text-gray-800 dark:text-slate-100">Evolução das Notas</h3>
                        </div>
                        <div className="flex flex-wrap gap-3 mb-4 text-xs text-gray-500 dark:text-slate-400">
                            <span className="flex items-center gap-1">
                                <span className="w-3 h-3 bg-indigo-500 rounded-full"></span> Exames Anteriores
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-3 h-3 bg-fuchsia-500 rounded-full"></span> IA
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-3 h-3 bg-teal-500 rounded-full"></span> Kahoots
                            </span>
                        </div>

                        <LineChart data={stats.scoreHistory} />
                    </div>
                )}

                {/* Exam History */}
                {stats.examResults.length > 0 && (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
                        <div className="p-5 border-b border-gray-100 dark:border-slate-800">
                            <h3 className="font-bold text-gray-800 dark:text-slate-100 flex items-center gap-2">
                                <Clock className="w-5 h-5 text-gray-400" />
                                Histórico de Exames
                            </h3>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-dark-gradient text-white text-sm border-b border-blue-900">
                                    <tr>
                                        {course ? null : <th className="px-4 py-3 text-left font-medium">Cadeira</th>}
                                        <th className="px-4 py-3 text-left font-medium">Fonte</th>
                                        <th className="px-4 py-3 text-center font-medium">Nota</th>
                                        <th className="px-4 py-3 text-center font-medium">Data</th>
                                        <th className="px-4 py-3 text-center font-medium">Corretas</th>
                                        <th className="px-4 py-3 text-center font-medium">Ação</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.examResults.slice(0, 50).map((exam, index) => (
                                        <tr
                                            key={exam.id}
                                            className={`border-b border-gray-50 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors ${index % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-gray-50/50 dark:bg-slate-800/40'}`}
                                        >
                                            {course ? null : (
                                                <td className="px-4 py-4 text-sm font-bold text-gray-700 dark:text-slate-300">
                                                    {(exam as any).expand?.course?.title || 'N/A'}
                                                </td>
                                            )}
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${getSourceColor(exam.source)}`}>
                                                    {getSourceIcon(exam.source)}
                                                    {getSourceLabel(exam.source)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-flex items-center justify-center w-12 h-8 rounded-lg font-bold text-sm ${exam.score >= 10
                                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                                    : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                                    }`}>
                                                    {exam.score}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center text-sm text-gray-600 dark:text-slate-400">
                                                {new Date(exam.created).toLocaleDateString('pt-PT', {
                                                    day: '2-digit',
                                                    month: 'short',
                                                    year: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </td>
                                            <td className="px-4 py-3 text-center text-sm">
                                                <span className="text-green-600 font-medium">{exam.correct_answers}</span>
                                                <span className="text-gray-400">/{exam.total_questions}</span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    onClick={() => loadExamDetails(exam)}
                                                    disabled={loadingExam}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors text-sm font-medium disabled:opacity-50"
                                                >
                                                    {loadingExam ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <>
                                                            <Eye className="w-4 h-4" />
                                                            Ver
                                                        </>
                                                    )}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {stats.examResults.length > 10 && (
                            <div className="p-4 text-center text-sm text-gray-500 dark:text-slate-400 border-t border-gray-100 dark:border-slate-800">
                                A mostrar os últimos 10 exames de {stats.examResults.length} total
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// Exam Detail View Component - Uses shared components
const ExamDetailView: React.FC<{
    examData: ExamDetailData;
    onBack: () => void;
    getSourceLabel: (source: string) => string;
    getSourceColor: (source: string) => string;
    getSourceIcon: (source: string) => React.ReactNode;
}> = ({ examData, onBack, getSourceLabel, getSourceColor, getSourceIcon }) => {
    const { examResult, answers } = examData;
    const [currentQuestion, setCurrentQuestion] = useState(0);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight' && currentQuestion < answers.length - 1) {
                setCurrentQuestion(prev => prev + 1);
            } else if (e.key === 'ArrowLeft' && currentQuestion > 0) {
                setCurrentQuestion(prev => prev - 1);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentQuestion, answers.length]);

    const getStatusColor = (index: number) => {
        const answer = answers[index];
        const isUnanswered = answer.selected_answer?.text === '(Não respondida)';
        if (isUnanswered) return 'bg-gray-400 border-gray-500 text-white';
        if (answer.answer_value === '++') return 'bg-green-500 border-green-600 text-white';
        if (answer.answer_value === '+') return 'bg-yellow-400 border-yellow-500 text-white';
        if (answer.answer_value === '-') return 'bg-orange-400 border-orange-500 text-white';
        return 'bg-red-500 border-red-600 text-white';
    };

    const currentAnswer = answers[currentQuestion];
    const questionData = currentAnswer?.questionData;

    return (
        <div className="h-full flex flex-col w-full">
            {/* Back Button */}
            <div className="shrink-0 border-b border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                <div className="max-w-3xl mx-auto w-full px-4">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-1 text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 transition-colors py-2 text-sm"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Voltar
                    </button>
                </div>
            </div>

            {/* Result Header - Unified with ResultSummary */}
            <ResultHeader
                score={examResult.score}
                correctCount={examResult.correct_answers}
                totalQuestions={examResult.total_questions}
                passThreshold={10}
                source={{
                    label: getSourceLabel(examResult.source),
                    icon: getSourceIcon(examResult.source),
                    colorClass: getSourceColor(examResult.source)
                }}
                date={new Date(examResult.created)}
            />

            {/* Question Navigator - Centered via shared component */}
            <HorizontalQuestionNav
                total={answers.length}
                current={currentQuestion}
                onSelect={setCurrentQuestion}
                getStatusColor={getStatusColor}
            />

            {/* Question Card - Using QuizCard for consistency */}
            {currentAnswer && (
                <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                    <div className="flex-1 overflow-y-auto py-4 flex flex-col">
                        <div className="flex-1 flex flex-col justify-center max-w-3xl mx-auto w-full px-4">
                            {questionData ? (
                                <QuizCard
                                    key={questionData.id}
                                    question={questionData}
                                    selectedAnswer={currentAnswer.selected_answer}
                                    onAnswer={() => { }}
                                    showFeedback={true}
                                />
                            ) : (
                                <div className="h-full flex items-center justify-center text-gray-400 italic">
                                    Dados da pergunta não disponíveis
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Navigation Footer */}
                    <NavigationFooter
                        currentIndex={currentQuestion}
                        totalCount={answers.length}
                        onPrevious={() => setCurrentQuestion(prev => Math.max(0, prev - 1))}
                        onNext={() => setCurrentQuestion(prev => Math.min(answers.length - 1, prev + 1))}
                    />
                </div>
            )}
        </div>
    );
};

// Pie Chart Component using Chart.js
const PieChart: React.FC<{ data: { value: number; color: string; label: string }[]; size: number }> = ({ data, size }) => {
    const total = data.reduce((sum, d) => sum + d.value, 0);
    if (total === 0) {
        return (
            <div
                className="rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-xs"
                style={{ width: size, height: size }}
            >
                Sem dados
            </div>
        );
    }

    const chartData = {
        labels: data.map(d => d.label),
        datasets: [{
            data: data.map(d => d.value),
            backgroundColor: data.map(d => d.color),
            borderColor: data.map(d => d.color),
            borderWidth: 0,
        }]
    };

    const options = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: (context: any) => {
                        const value = context.raw as number;
                        const percentage = ((value / total) * 100).toFixed(1);
                        return `${context.label}: ${value} (${percentage}%)`;
                    }
                }
            }
        },
        cutout: '60%',
    };

    return (
        <div style={{ width: size, height: size }}>
            <Doughnut data={chartData} options={options} />
        </div>
    );
};

// Line Chart Component using Chart.js with source distinction
const LineChart: React.FC<{ data: { date: string; score: number; source: string }[] }> = ({ data }) => {
    if (data.length === 0) return null;

    // Source colors
    const sourceColors: Record<string, string> = {
        'previous': '#6366f1', // indigo
        'ai': '#d946ef',       // fuchsia
        'kahoots': '#14b8a6',  // teal
    };

    const chartData = {
        labels: data.map(d => new Date(d.date).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })),
        datasets: [
            {
                label: 'Nota',
                data: data.map(d => d.score),
                borderColor: data.map(d => sourceColors[d.source] || '#6366f1'),
                backgroundColor: data.map(d => {
                    const color = sourceColors[d.source] || '#6366f1';
                    return color + '20'; // Add transparency
                }),
                borderWidth: 2,
                pointBackgroundColor: data.map(d => sourceColors[d.source] || '#6366f1'),
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 6,
                pointHoverRadius: 8,
                fill: false,
                tension: 0.3,
                segment: {
                    borderColor: (ctx: any) => {
                        if (!ctx.p0 || !ctx.p1) return '#6366f1';
                        const source = data[ctx.p0DataIndex]?.source || 'previous';
                        return sourceColors[source] || '#6366f1';
                    }
                }
            }
        ]
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    title: (context: any) => {
                        const index = context[0]?.dataIndex;
                        const source = data[index]?.source;
                        const sourceLabel = source === 'previous' ? 'Exames Anteriores' :
                            source === 'ai' ? 'IA' :
                                source === 'kahoots' ? 'Kahoots' : source;
                        return `${context[0]?.label} - ${sourceLabel}`;
                    },
                    label: (context: any) => {
                        return `Nota: ${(context.raw as number).toFixed(1)}/20`;
                    }
                }
            }
        },
        scales: {
            y: {
                min: 0,
                max: 20,
                ticks: {
                    stepSize: 5,
                    color: '#9ca3af',
                },
                grid: {
                    color: 'rgba(156, 163, 175, 0.1)',
                },
            },
            x: {
                ticks: {
                    color: '#9ca3af',
                    maxTicksLimit: 10,
                },
                grid: {
                    display: false,
                },
            }
        },
    };

    return (
        <div className="h-48">
            <Line data={chartData} options={options} />
        </div>
    );
};

// Quick Stat Component
const QuickStat: React.FC<{ label: string; value: string | number; color: 'indigo' | 'green' | 'purple' | 'blue' }> = ({ label, value, color }) => {
    const colorClasses = {
        indigo: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
        green: 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400',
        purple: 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
        blue: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-slate-800">
            <p className={`text-2xl font-bold ${colorClasses[color].split(' ').pop()}`}>{value}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{label}</p>
        </div>
    );
};
