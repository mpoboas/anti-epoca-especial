import React, { useState, useEffect } from 'react';
import { Trophy, Medal, Crown, User, ArrowLeft, Loader2, TrendingUp, Target, Award, Globe } from 'lucide-react';
import { getLeaderboard, LeaderboardEntry, Course } from '../src/lib/pocketbase';
import { ContextSelector } from './shared';

interface LeaderboardProps {
    courses: Course[];
    onBack: () => void;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ courses, onBack }) => {
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeCourse, setActiveCourse] = useState<Course | null>(null);

    useEffect(() => {
        const loadLeaderboard = async () => {
            setLoading(true);
            try {
                const data = await getLeaderboard(activeCourse?.id || '');
                setEntries(data);
            } catch (err) {
                console.error('Error loading leaderboard:', err);
            } finally {
                setLoading(false);
            }
        };

        loadLeaderboard();
    }, [activeCourse?.id]);

    const topThree = entries.slice(0, 3);
    const theRest = entries.slice(3);

    const getPodiumStyle = (index: number) => {
        switch (index) {
            case 0: return {
                container: "order-2 -mt-8",
                box: "h-40 bg-gradient-to-b from-yellow-400 to-yellow-600 shadow-yellow-500/20",
                icon: <Crown className="w-8 h-8 text-yellow-400 mb-2" />,
                medal: <Medal className="w-10 h-10 text-yellow-500 drop-shadow-md" />,
                ring: "ring-yellow-400"
            };
            case 1: return {
                container: "order-1",
                box: "h-32 bg-gradient-to-b from-slate-300 to-slate-500 shadow-slate-400/20",
                icon: <Medal className="w-6 h-6 text-slate-300 mb-2 invisible" />,
                medal: <Medal className="w-8 h-8 text-slate-300 drop-shadow-md" />,
                ring: "ring-slate-300"
            };
            case 2: return {
                container: "order-3",
                box: "h-28 bg-gradient-to-b from-orange-400 to-orange-600 shadow-orange-500/20",
                icon: <Medal className="w-6 h-6 text-orange-400 mb-2 invisible" />,
                medal: <Medal className="w-8 h-8 text-orange-400 drop-shadow-md" />,
                ring: "ring-orange-400"
            };
            default: return null;
        }
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col w-full h-full overflow-hidden bg-gray-50 dark:bg-slate-950">
            {/* Header */}
            <div className="shrink-0 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 p-4">
                <div className="max-w-3xl mx-auto flex items-center justify-between">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-gray-500 dark:text-slate-400"
                    >
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <h1 className="text-xl font-bold dark:text-white flex items-center gap-2">
                        <Trophy className="w-6 h-6 text-yellow-500" />
                        {activeCourse ? `Ranking ${activeCourse.title}` : 'Ranking Global'}
                    </h1>
                    <div className="w-10" /> {/* Spacer */}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                {/* Course/Global Selector */}
                <div className="max-w-2xl mx-auto px-4 pt-6">
                    <ContextSelector
                        courses={courses}
                        selectedCourseId={activeCourse?.id || null}
                        onSelect={setActiveCourse}
                    />
                </div>

                <div className="max-w-2xl mx-auto px-4 pb-8">
                    {/* Podium Area */}
                    {topThree.length > 0 && (
                        <div className="flex items-end justify-center gap-2 md:gap-4 mb-12 py-10">
                            {[1, 0, 2].map((idx) => {
                                const entry = topThree[idx];
                                if (!entry) return <div key={`empty-${idx}`} className="flex-1 max-w-[120px]" />;
                                const style = getPodiumStyle(idx)!;

                                return (
                                    <div key={entry.userId} className={`flex-1 flex flex-col items-center max-w-[120px] ${style.container}`}>
                                        <div className="relative mb-3">
                                            {style.icon}
                                            <div className={`w-16 h-16 md:w-20 md:h-20 rounded-full border-4 ${style.ring} overflow-hidden bg-white dark:bg-slate-800 shadow-xl flex items-center justify-center`}>
                                                <User className="w-10 h-10 md:w-12 md:h-12 text-gray-300" />
                                            </div>
                                            <div className="absolute -bottom-2 -right-1">
                                                {style.medal}
                                            </div>
                                        </div>
                                        <div className="text-center mb-4">
                                            <p className="font-bold dark:text-white truncate w-full px-1 text-sm">{entry.userName}</p>
                                            <p className="text-xl md:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
                                                {entry.averageScore.toFixed(1)}
                                            </p>
                                        </div>
                                        <div className={`w-full rounded-t-2xl ${style.box} flex flex-col items-center justify-center text-white/90 shadow-lg`}>
                                            <p className="text-[10px] font-bold uppercase tracking-wider opacity-75">RANK</p>
                                            <p className="text-2xl md:text-3xl font-black">{idx + 1}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Stats List */}
                    <div className="space-y-3 max-w-xl mx-auto">
                        <h2 className="text-lg font-bold dark:text-white flex items-center gap-2 mb-4 px-1">
                            <TrendingUp className="w-5 h-5 text-blue-500" />
                            Top de Alunos
                        </h2>

                        {entries.length === 0 ? (
                            <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800">
                                <Award className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-500 dark:text-slate-400 font-medium">Ainda não há dados suficientes para o ranking.</p>
                            </div>
                        ) : (
                            entries.map((entry, index) => (
                                <div
                                    key={entry.userId}
                                    className={`flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 ${index < 3
                                        ? 'bg-white dark:bg-slate-900 border-2 border-transparent'
                                        : 'bg-white/50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-800'
                                        } hover:translate-x-1`}
                                >
                                    <div className="w-10 flex justify-center font-black text-xl text-gray-400 dark:text-slate-600">
                                        {index + 1}
                                    </div>

                                    <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                                        <User className="w-6 h-6 text-gray-400" />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold dark:text-white truncate">{entry.userName}</p>
                                        <p className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1">
                                            <Target className="w-3 h-3" />
                                            {entry.totalExams} exames finalizados
                                        </p>
                                    </div>

                                    <div className="text-right shrink-0">
                                        <p className="text-xl font-black text-blue-600 dark:text-blue-400 leading-tight">
                                            {entry.averageScore.toFixed(1)}
                                        </p>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                                            Média
                                        </p>
                                    </div>

                                    <div className="w-12 text-right">
                                        <div className={`inline-flex px-2 py-1 rounded-lg text-[10px] font-bold ${entry.passRate >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900/30' :
                                            entry.passRate >= 50 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30' :
                                                'bg-red-100 text-red-700 dark:bg-red-900/30'
                                            }`}>
                                            {entry.passRate}%
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
