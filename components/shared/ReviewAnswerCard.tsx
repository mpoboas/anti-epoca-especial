import React from 'react';
import { CheckCircle } from 'lucide-react';

export interface Answer {
    text: string;
    value: '++' | '+' | '-' | '--';
}

interface ReviewAnswerCardProps {
    questionText: string;
    answers: Answer[];
    selectedAnswer?: Answer;
    showFeedback?: boolean;
}

const getAnswerStyle = (value: string, isSelected: boolean) => {
    if (value === '++') {
        return isSelected
            ? 'bg-green-100 dark:bg-green-900/40 border-green-500 text-green-800 dark:text-green-400'
            : 'bg-green-50 dark:bg-green-950/20 border-green-300 dark:border-green-800 text-green-700 dark:text-green-500 opacity-75';
    }
    if (value === '+') {
        return isSelected
            ? 'bg-yellow-100 dark:bg-yellow-900/40 border-yellow-500 text-yellow-800 dark:text-yellow-400'
            : 'bg-gray-50 dark:bg-slate-900/50 border-gray-200 dark:border-slate-800 text-gray-400 dark:text-slate-600 opacity-50';
    }
    if (value === '-') {
        return isSelected
            ? 'bg-orange-100 dark:bg-orange-900/40 border-orange-500 text-orange-800 dark:text-orange-400'
            : 'bg-gray-50 dark:bg-slate-900/50 border-gray-200 dark:border-slate-800 text-gray-400 dark:text-slate-600 opacity-50';
    }
    if (value === '--') {
        return isSelected
            ? 'bg-red-100 dark:bg-red-900/40 border-red-500 text-red-800 dark:text-red-400'
            : 'bg-gray-50 dark:bg-slate-900/50 border-gray-200 dark:border-slate-800 text-gray-400 dark:text-slate-600 opacity-50';
    }
    return 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-400 dark:text-slate-500';
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

export const ReviewAnswerCard: React.FC<ReviewAnswerCardProps> = ({
    questionText,
    answers,
    selectedAnswer,
    showFeedback = true
}) => {
    return (
        <div className="h-full flex flex-col">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                {questionText}
            </h3>

            <div className="flex-1 flex flex-col justify-center space-y-3">
                {answers.map((ans, index) => {
                    const isSelected = selectedAnswer?.text === ans.text;
                    const isCorrect = ans.value === '++';

                    return (
                        <div
                            key={index}
                            className={`p-4 rounded-xl border-2 transition-all flex items-center justify-between ${showFeedback ? getAnswerStyle(ans.value, isSelected) : 'bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-800'
                                }`}
                        >
                            <span className="font-medium">{ans.text}</span>
                            {showFeedback && (
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
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
