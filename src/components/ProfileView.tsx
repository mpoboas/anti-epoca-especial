import React, { useState, useEffect } from 'react';
import { getCurrentUser, logout, getUserStats, UserStats } from '../lib/pocketbase';
import {
    User, LogOut, TrendingUp, Target, CheckCircle, XCircle,
    BookOpen, Award, Loader2, ChevronLeft
} from 'lucide-react';

interface ProfileViewProps {
    courseId: string | null;
    source: string | null;
    onClose: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ courseId, source, onClose }) => {
    const [stats, setStats] = useState<UserStats | null>(null);
    const [loading, setLoading] = useState(true);
    const user = getCurrentUser();

    useEffect(() => {
        const loadStats = async () => {
            if (courseId) {
                const userStats = await getUserStats(courseId, source || undefined);
                setStats(userStats);
            }
            setLoading(false);
        };
        loadStats();
    }, [courseId, source]);

    const handleLogout = () => {
        logout();
        onClose();
    };

    const questionsLeft = stats
        ? Math.max(0, stats.totalQuestionsInPool - stats.uniqueQuestionsSeen)
        : 0;

    return (
        <div className="flex-1 overflow-y-auto px-4 py-6 animate-fade-in custom-scrollbar">
            <div className="max-w-2xl mx-auto">
                {/* Back Button */}
                <button
                    onClick={onClose}
                    className="flex items-center gap-1 text-gray-500 hover:text-gray-700 mb-6 transition-colors"
                >
                    <ChevronLeft className="w-5 h-5" />
                    <span>Voltar</span>
                </button>

                {/* Profile Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white mb-6">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/20 p-4 rounded-full">
                            <User className="w-8 h-8" />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-xl font-bold">{user?.name || 'Estudante'}</h2>
                            <p className="text-indigo-100 text-sm">{user?.email}</p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="bg-white/10 hover:bg-white/20 p-3 rounded-xl transition-colors"
                            title="Terminar sessão"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Stats */}
                {loading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                    </div>
                ) : stats ? (
                    <>
                        {/* Quick Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            <StatCard
                                icon={<BookOpen className="w-5 h-5" />}
                                label="Exames Feitos"
                                value={stats.totalExams}
                                color="indigo"
                            />
                            <StatCard
                                icon={<Target className="w-5 h-5" />}
                                label="Nota Média"
                                value={`${stats.averageScore}/20`}
                                color="purple"
                            />
                            <StatCard
                                icon={<CheckCircle className="w-5 h-5" />}
                                label="Aprovados"
                                value={stats.passedExams}
                                color="green"
                            />
                            <StatCard
                                icon={<XCircle className="w-5 h-5" />}
                                label="Reprovados"
                                value={stats.failedExams}
                                color="red"
                            />
                        </div>

                        {/* Progress */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
                            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <Award className="w-5 h-5 text-indigo-600" />
                                Progresso de Estudo
                            </h3>

                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-600">Perguntas Descobertas</span>
                                        <span className="font-medium text-gray-800">
                                            {stats.uniqueQuestionsSeen} / {stats.totalQuestionsInPool}
                                        </span>
                                    </div>
                                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                                            style={{
                                                width: stats.totalQuestionsInPool > 0
                                                    ? `${(stats.uniqueQuestionsSeen / stats.totalQuestionsInPool) * 100}%`
                                                    : '0%'
                                            }}
                                        />
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {questionsLeft > 0
                                            ? `${questionsLeft} perguntas por descobrir`
                                            : 'Todas as perguntas vistas! 🎉'}
                                    </p>
                                </div>

                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-600">Taxa de Aprovação</span>
                                        <span className="font-medium text-gray-800">{stats.passRate}%</span>
                                    </div>
                                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full transition-all duration-500 ${stats.passRate >= 50 ? 'bg-green-500' : 'bg-red-400'
                                                }`}
                                            style={{ width: `${stats.passRate}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Score Evolution */}
                        {stats.scoreEvolution.length > 0 && (
                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5 text-indigo-600" />
                                    Evolução das Notas
                                </h3>

                                <div className="flex items-end gap-2 h-32">
                                    {stats.scoreEvolution.map((entry, i) => (
                                        <div key={i} className="flex-1 flex flex-col items-center">
                                            <div
                                                className={`w-full rounded-t-lg transition-all ${entry.score >= 10
                                                        ? 'bg-gradient-to-t from-green-500 to-green-400'
                                                        : 'bg-gradient-to-t from-red-400 to-red-300'
                                                    }`}
                                                style={{ height: `${(entry.score / 20) * 100}%` }}
                                                title={`${entry.score}/20 - ${new Date(entry.created).toLocaleDateString()}`}
                                            />
                                            <span className="text-xs text-gray-500 mt-1">{entry.score}</span>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-xs text-gray-400 text-center mt-2">
                                    Últimos {stats.scoreEvolution.length} exames
                                </p>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-center py-12 text-gray-500">
                        <p>Seleciona um curso e fonte para ver estatísticas</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const StatCard: React.FC<{
    icon: React.ReactNode;
    label: string;
    value: string | number;
    color: 'indigo' | 'purple' | 'green' | 'red';
}> = ({ icon, label, value, color }) => {
    const colors = {
        indigo: 'bg-indigo-50 text-indigo-600',
        purple: 'bg-purple-50 text-purple-600',
        green: 'bg-green-50 text-green-600',
        red: 'bg-red-50 text-red-600',
    };

    return (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className={`inline-flex p-2 rounded-lg ${colors[color]} mb-2`}>
                {icon}
            </div>
            <p className="text-2xl font-bold text-gray-800">{value}</p>
            <p className="text-xs text-gray-500">{label}</p>
        </div>
    );
};
