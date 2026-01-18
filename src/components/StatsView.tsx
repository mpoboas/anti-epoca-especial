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
    scoreHistory: { date: string; score: number }[];
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
                const filter = `user = "${user.id}" && course = "${course.id}"`;

                const examResults = await pb.collection('exam_results').getFullList<ExamResult>({
                    filter,
                    sort: '-created',
                });

                if (!isMounted) return;

                const totalQuestionsInPool =
                    await getQuestionCount(course.id, 'previous') +
                    await getQuestionCount(course.id, 'ai') +
                    await getQuestionCount(course.id, 'kahoots');

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
    }, [course?.id, user?.id]);

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
            case 'previous': return 'bg-blue-100 text-blue-700';
            case 'ai': return 'bg-cyan-100 text-cyan-700';
            case 'kahoots': return 'bg-teal-100 text-teal-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    if (!stats || !user) {
        return (
            <div className="flex-1 flex items-center justify-center text-gray-500">
                <p>Faz login para ver as tuas estatísticas</p>
            </div>
        );
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
        <div className="flex-1 overflow-y-auto bg-slate-50 animate-fade-in custom-scrollbar">
            <div className="max-w-6xl mx-auto p-4 md:p-6">
                {/* Back Button & Profile Header */}
                <div className="flex items-center justify-between mb-6">
                    <button
                        onClick={onClose}
                        className="flex items-center gap-1 text-gray-500 hover:text-gray-700 transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                        <span>Voltar</span>
                    </button>

                    <div className="flex items-center gap-3">
                        <div className="text-right">
                            <p className="text-sm font-medium text-gray-800">{user?.name || 'Estudante'}</p>
                            <p className="text-xs text-gray-500">{user?.email}</p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="bg-gray-100 hover:bg-gray-200 p-2 rounded-lg transition-colors text-gray-600"
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
                            Já respondeste a <span className="font-bold text-lime-400 text-glow">{stats.totalExams}</span> exames.
                            Das <span className="font-bold">{stats.totalQuestionsInPool}</span> questões disponíveis
                            respondeste a <span className="font-bold text-lime-400 text-glow">{stats.uniqueQuestionsSeen}</span>,
                            ou seja <span className="font-bold text-lime-400 text-glow">{stats.percentageComplete}%</span>.
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
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                        <h3 className="font-bold text-gray-800 mb-4 text-center">Número de Exames</h3>
                        <div className="flex justify-center mb-4">
                            <PieChart
                                data={[
                                    { value: stats.passedExams, color: '#22c55e', label: 'Aprovado' },
                                    { value: stats.failedExams, color: '#ef4444', label: 'Reprovado' },
                                ]}
                                size={120}
                            />
                        </div>
                        <div className="flex justify-center gap-4 text-xs">
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
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                        <h3 className="font-bold text-gray-800 mb-4 text-center">Respostas</h3>
                        <div className="flex justify-center mb-4">
                            <PieChart
                                data={[
                                    { value: stats.correctAnswersTotal, color: '#22c55e', label: 'Corretas' },
                                    { value: stats.incorrectAnswersTotal, color: '#ef4444', label: 'Erradas' },
                                ]}
                                size={120}
                            />
                        </div>
                        <div className="flex justify-center gap-4 text-xs">
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
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                        <h3 className="font-bold text-gray-800 mb-4 text-center">Tipo de Exame</h3>
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
                        <div className="flex justify-center gap-3 text-xs flex-wrap">
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
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6">
                        <div className="flex items-center gap-2 mb-4">
                            <TrendingUp className="w-5 h-5 text-indigo-600" />
                            <h3 className="font-bold text-gray-800">Evolução das Notas</h3>
                            <div className="flex items-center gap-4 ml-auto text-xs text-gray-500">
                                <span className="flex items-center gap-1">
                                    <span className="w-3 h-3 bg-indigo-500 rounded-full"></span> Nota
                                </span>
                                <span className="flex items-center gap-1">
                                    <span className="w-6 h-0.5 bg-gray-400"></span> Tendência
                                </span>
                            </div>
                        </div>

                        <LineChart data={stats.scoreHistory} />
                    </div>
                )}

                {/* Exam History */}
                {stats.examResults.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-5 border-b border-gray-100">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <Clock className="w-5 h-5 text-indigo-600" />
                                Histórico de Exames
                            </h3>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-medium">Fonte</th>
                                        <th className="px-4 py-3 text-center font-medium">Nota</th>
                                        <th className="px-4 py-3 text-center font-medium">Data</th>
                                        <th className="px-4 py-3 text-center font-medium">Corretas</th>
                                        <th className="px-4 py-3 text-center font-medium">Ação</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.examResults.slice(0, 10).map((exam, index) => (
                                        <tr
                                            key={exam.id}
                                            className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                                        >
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${getSourceColor(exam.source)}`}>
                                                    {getSourceIcon(exam.source)}
                                                    {getSourceLabel(exam.source)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-flex items-center justify-center w-12 h-8 rounded-lg font-bold text-sm ${exam.score >= 10
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-red-100 text-red-700'
                                                    }`}>
                                                    {exam.score}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center text-sm text-gray-600">
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
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-medium disabled:opacity-50"
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
                            <div className="p-4 text-center text-sm text-gray-500 border-t border-gray-100">
                                A mostrar os últimos 10 exames de {stats.examResults.length} total
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// Exam Detail View Component
const ExamDetailView: React.FC<{
    examData: ExamDetailData;
    onBack: () => void;
    getSourceLabel: (source: string) => string;
    getSourceColor: (source: string) => string;
    getSourceIcon: (source: string) => React.ReactNode;
}> = ({ examData, onBack, getSourceLabel, getSourceColor, getSourceIcon }) => {
    const { examResult, answers } = examData;
    const [currentQuestion, setCurrentQuestion] = useState(0);

    const getAnswerStyle = (value: string, isSelected: boolean) => {
        if (value === '++') {
            return isSelected
                ? 'bg-green-100 border-green-500 text-green-800'
                : 'bg-green-50 border-green-300 text-green-700 opacity-75';
        }
        if (value === '+') {
            return isSelected
                ? 'bg-yellow-100 border-yellow-500 text-yellow-800'
                : 'bg-gray-50 border-gray-200 text-gray-400 opacity-50';
        }
        if (value === '-') {
            return isSelected
                ? 'bg-orange-100 border-orange-500 text-orange-800'
                : 'bg-gray-50 border-gray-200 text-gray-400 opacity-50';
        }
        if (value === '--') {
            return isSelected
                ? 'bg-red-100 border-red-500 text-red-800'
                : 'bg-gray-50 border-gray-200 text-gray-400 opacity-50';
        }
        return 'bg-gray-50 border-gray-200 text-gray-400';
    };

    const getValueLabel = (value: string) => {
        switch (value) {
            case '++': return 'Correta';
            case '+': return 'Menos Boa';
            case '-': return 'Menos Má';
            case '--': return 'Errada';
            default: return '';
        }
    };

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50 animate-fade-in custom-scrollbar">
            <div className="max-w-4xl mx-auto p-4 md:p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-1 text-gray-500 hover:text-gray-700 transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                        <span>Voltar às estatísticas</span>
                    </button>
                </div>

                {/* Exam Summary */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div>
                            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium mb-2 ${getSourceColor(examResult.source)}`}>
                                {getSourceIcon(examResult.source)}
                                {getSourceLabel(examResult.source)}
                            </span>
                            <h2 className="text-xl font-bold text-gray-800">Revisão do Exame</h2>
                            <p className="text-sm text-gray-500">
                                {new Date(examResult.created).toLocaleDateString('pt-PT', {
                                    day: '2-digit',
                                    month: 'long',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                            </p>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="text-center">
                                <p className={`text-3xl font-bold ${examResult.score >= 10 ? 'text-green-600' : 'text-red-600'}`}>
                                    {examResult.score}
                                </p>
                                <p className="text-xs text-gray-500">Nota</p>
                            </div>
                            <div className="text-center">
                                <p className="text-3xl font-bold text-gray-800">
                                    {examResult.correct_answers}/{examResult.total_questions}
                                </p>
                                <p className="text-xs text-gray-500">Corretas</p>
                            </div>
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${examResult.score >= 10 ? 'bg-green-100' : 'bg-red-100'
                                }`}>
                                {examResult.score >= 10 ? (
                                    <CheckCircle className="w-6 h-6 text-green-600" />
                                ) : (
                                    <XCircle className="w-6 h-6 text-red-600" />
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Question Navigator */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
                    <div className="flex flex-wrap gap-2 justify-center">
                        {answers.map((answer, index) => {
                            const isUnanswered = answer.selected_answer?.text === '(Não respondida)';
                            const getButtonColor = () => {
                                if (isUnanswered) return 'bg-gray-400 text-white';
                                if (answer.answer_value === '++') return 'bg-green-500 text-white';
                                if (answer.answer_value === '+') return 'bg-yellow-400 text-white';
                                if (answer.answer_value === '-') return 'bg-orange-400 text-white';
                                return 'bg-red-500 text-white';
                            };

                            return (
                                <button
                                    key={answer.id}
                                    onClick={() => setCurrentQuestion(index)}
                                    className={`w-10 h-10 rounded-lg font-medium text-sm transition-all ${currentQuestion === index ? 'ring-2 ring-indigo-500 ring-offset-2' : ''
                                        } ${getButtonColor()}`}
                                >
                                    {index + 1}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Current Question */}
                {answers[currentQuestion] && (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <div className="mb-4 text-sm text-gray-500">
                            Pergunta {currentQuestion + 1} de {answers.length}
                        </div>

                        {answers[currentQuestion].questionData ? (
                            <>
                                <h3 className="text-lg font-semibold text-gray-800 mb-6">
                                    {answers[currentQuestion].questionData.text}
                                </h3>

                                <div className="space-y-3">
                                    {answers[currentQuestion].questionData.answers.map((ans, index) => {
                                        const isSelected = ans.text === answers[currentQuestion].selected_answer?.text;
                                        const isCorrect = ans.value === '++';

                                        return (
                                            <div
                                                key={index}
                                                className={`p-4 rounded-xl border-2 transition-all flex items-center justify-between ${getAnswerStyle(ans.value, isSelected)}`}
                                            >
                                                <span className="font-medium">{ans.text}</span>
                                                <div className="flex items-center gap-2">
                                                    {isSelected && (
                                                        <span className="text-xs font-bold uppercase tracking-wide">
                                                            {getValueLabel(ans.value)}
                                                        </span>
                                                    )}
                                                    {isCorrect && !isSelected && (
                                                        <CheckCircle className="w-5 h-5 text-green-600" />
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        ) : (
                            <div className="text-center py-8">
                                <p className="text-gray-500 mb-2">Dados da pergunta não disponíveis</p>
                                {answers[currentQuestion].selected_answer && (
                                    <div className={`inline-block px-4 py-2 rounded-lg ${getAnswerStyle(answers[currentQuestion].answer_value, true)}`}>
                                        <p className="text-sm">Resposta selecionada:</p>
                                        <p className="font-medium">{answers[currentQuestion].selected_answer.text}</p>
                                        <p className="text-xs mt-1">{getValueLabel(answers[currentQuestion].answer_value)}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Navigation */}
                        <div className="flex justify-between mt-6 pt-4 border-t border-gray-100">
                            <button
                                onClick={() => setCurrentQuestion(prev => Math.max(0, prev - 1))}
                                disabled={currentQuestion === 0}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-40 transition-colors"
                            >
                                ← Anterior
                            </button>
                            <button
                                onClick={() => setCurrentQuestion(prev => Math.min(answers.length - 1, prev + 1))}
                                disabled={currentQuestion === answers.length - 1}
                                className="px-4 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg disabled:opacity-40 transition-colors"
                            >
                                Seguinte →
                            </button>
                        </div>
                    </div>
                )}
            </div>
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

// Line Chart Component using Chart.js
const LineChart: React.FC<{ data: { date: string; score: number }[] }> = ({ data }) => {
    if (data.length === 0) return null;

    // Calculate trend line
    const n = data.length;
    const sumX = data.reduce((sum, _, i) => sum + i, 0);
    const sumY = data.reduce((sum, d) => sum + d.score, 0);
    const sumXY = data.reduce((sum, d, i) => sum + i * d.score, 0);
    const sumX2 = data.reduce((sum, _, i) => sum + i * i, 0);
    const denominator = n * sumX2 - sumX * sumX;
    const slope = denominator !== 0 ? (n * sumXY - sumX * sumY) / denominator : 0;
    const intercept = (sumY - slope * sumX) / n;

    const trendLine = data.map((_, i) => slope * i + intercept);

    const chartData = {
        labels: data.map(d => new Date(d.date).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })),
        datasets: [
            {
                label: 'Nota',
                data: data.map(d => d.score),
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                borderWidth: 2,
                pointBackgroundColor: data.map(d => d.score >= 10 ? '#22c55e' : '#ef4444'),
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7,
                fill: true,
                tension: 0.3,
            },
            {
                label: 'Tendência',
                data: trendLine,
                borderColor: '#9ca3af',
                borderWidth: 1,
                borderDash: [5, 5],
                pointRadius: 0,
                fill: false,
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
                    label: (context: any) => {
                        if (context.dataset?.label === 'Tendência') return null;
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
                    color: '#e5e7eb',
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
        indigo: 'bg-indigo-50 text-indigo-600',
        green: 'bg-green-50 text-green-600',
        purple: 'bg-purple-50 text-purple-600',
        blue: 'bg-blue-50 text-blue-600',
    };

    return (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className={`text-2xl font-bold ${colorClasses[color].split(' ')[1]}`}>{value}</p>
            <p className="text-xs text-gray-500 mt-1">{label}</p>
        </div>
    );
};
