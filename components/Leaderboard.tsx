import React, { useEffect, useState } from 'react';
import { Trophy, Medal, Crown, ChevronLeft, Loader2, User } from 'lucide-react';
import { getLeaderboard, LeaderboardEntry, getCurrentUser } from '../src/lib/pocketbase';

interface LeaderboardProps {
    courseId: string;
    source?: string;
    onClose: () => void;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ courseId, source, onClose }) => {
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const currentUser = getCurrentUser();

    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                setLoading(true);
                const data = await getLeaderboard(courseId, source, 20);
                setEntries(data);
            } catch (err) {
                console.error(err);
                setError('Erro ao carregar ranking');
            } finally {
                setLoading(false);
            }
        };

        fetchLeaderboard();
    }, [courseId, source]);

    const getRankIcon = (rank: number) => {
        switch (rank) {
            case 1:
                return <Crown className="w-6 h-6 text-yellow-500" />;
            case 2:
                return <Medal className="w-6 h-6 text-gray-400" />;
            case 3:
                return <Medal className="w-6 h-6 text-amber-600" />;
            default:
                return <span className="w-6 h-6 flex items-center justify-center text-gray-500 font-bold">{rank}</span>;
        }
    };

    const getRankBg = (rank: number, isCurrentUser: boolean) => {
        if (isCurrentUser) return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
        switch (rank) {
            case 1:
                return 'bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border-yellow-200 dark:border-yellow-800';
            case 2:
                return 'bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-900/20 dark:to-slate-900/20 border-gray-200 dark:border-gray-700';
            case 3:
                return 'bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-800';
            default:
                return 'bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800';
        }
    };

    return (
        <div className="flex-1 overflow-hidden flex flex-col animate-fade-in">
            {/* Header */}
            <div className="shrink-0 px-4 py-6 text-center">
                <div className="flex items-center justify-center gap-3 mb-2">
                    <Trophy className="w-8 h-8 text-yellow-500" />
                    <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white">
                        Ranking
                    </h1>
                </div>
                <p className="text-gray-500 dark:text-slate-400 text-sm">
                    Top estudantes por nota média
                </p>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 pb-24 md:pb-8 custom-scrollbar">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    </div>
                ) : error ? (
                    <div className="text-center py-12 text-red-500">{error}</div>
                ) : entries.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 dark:text-slate-400">
                        <Trophy className="w-16 h-16 mx-auto mb-4 opacity-30" />
                        <p>Ainda não há dados de ranking.</p>
                        <p className="text-sm mt-2">Sê o primeiro a completar um exame!</p>
                    </div>
                ) : (
                    <div className="space-y-3 max-w-xl mx-auto">
                        {entries.map((entry, idx) => {
                            const isCurrentUser = currentUser?.id === entry.userId;
                            const rank = idx + 1;

                            return (
                                <div
                                    key={entry.userId}
                                    className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${getRankBg(rank, isCurrentUser)} ${isCurrentUser ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-950' : ''
                                        }`}
                                >
                                    {/* Rank */}
                                    <div className="shrink-0">
                                        {getRankIcon(rank)}
                                    </div>

                                    {/* Avatar */}
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${rank === 1 ? 'bg-yellow-100 dark:bg-yellow-900/30' :
                                            rank === 2 ? 'bg-gray-100 dark:bg-gray-800' :
                                                rank === 3 ? 'bg-amber-100 dark:bg-amber-900/30' :
                                                    'bg-gray-100 dark:bg-slate-800'
                                        }`}>
                                        <User className={`w-5 h-5 ${rank === 1 ? 'text-yellow-600' :
                                                rank === 2 ? 'text-gray-500' :
                                                    rank === 3 ? 'text-amber-600' :
                                                        'text-gray-400 dark:text-slate-500'
                                            }`} />
                                    </div>

                                    {/* Name & Stats */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className={`font-bold truncate ${isCurrentUser ? 'text-blue-700 dark:text-blue-400' : 'text-gray-900 dark:text-white'
                                                }`}>
                                                {entry.userName}
                                            </span>
                                            {isCurrentUser && (
                                                <span className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium">
                                                    Tu
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                                            {entry.totalExams} exame{entry.totalExams !== 1 ? 's' : ''} •
                                            {entry.passRate}% aprovação
                                        </div>
                                    </div>

                                    {/* Score */}
                                    <div className="text-right shrink-0">
                                        <div className={`text-xl font-extrabold ${entry.averageScore >= 16 ? 'text-green-600 dark:text-green-400' :
                                                entry.averageScore >= 10 ? 'text-blue-600 dark:text-blue-400' :
                                                    'text-red-600 dark:text-red-400'
                                            }`}>
                                            {entry.averageScore.toFixed(1)}
                                        </div>
                                        <div className="text-[10px] text-gray-400 dark:text-slate-500 uppercase tracking-wide">
                                            média
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Back button */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 md:relative md:bg-transparent md:border-0 z-50">
                <div className="max-w-xl mx-auto">
                    <button
                        onClick={onClose}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-xl font-medium transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                        Voltar
                    </button>
                </div>
            </div>
        </div>
    );
};
