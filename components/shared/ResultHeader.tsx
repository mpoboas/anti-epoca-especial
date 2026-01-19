import React from 'react';
import { CheckCircle, XCircle } from 'lucide-react';

interface ResultHeaderProps {
    score: number;
    correctCount: number;
    totalQuestions: number;
    passThreshold?: number;
    // Optional source info for exam review
    source?: {
        label: string;
        icon?: React.ReactNode;
        colorClass?: string;
    };
    date?: Date;
}

export const ResultHeader: React.FC<ResultHeaderProps> = ({
    score,
    correctCount,
    totalQuestions,
    passThreshold = 9.5,
    source,
    date
}) => {
    const isPassed = score >= passThreshold;

    return (
        <div className="shrink-0">
            {/* Main Score Banner */}
            <div className={`${isPassed ? 'bg-green-600' : 'bg-red-600'} text-white`}>
                <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {isPassed ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                        <div>
                            <span className="font-bold">{isPassed ? "Aprovado" : "Reprovado"}</span>
                            <span className="text-xs opacity-80 ml-2">({correctCount}/{totalQuestions} corretas)</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="text-2xl font-extrabold">{score.toFixed(1)}</span>
                        <span className="text-sm opacity-80">/20</span>
                    </div>
                </div>
            </div>

            {/* Optional Source/Date Bar */}
            {(source || date) && (
                <div className="bg-gray-100/50 dark:bg-slate-900/50 border-b border-gray-200/50 dark:border-slate-800/50">
                    <div className="max-w-3xl mx-auto px-4 py-2 flex items-center justify-between text-sm">
                        {source && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${source.colorClass || 'bg-gray-200 text-gray-700'}`}>
                                {source.icon}
                                {source.label}
                            </span>
                        )}
                        {date && (
                            <span className="text-xs text-gray-500 dark:text-slate-400">
                                {date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
