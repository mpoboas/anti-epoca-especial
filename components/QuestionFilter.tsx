import React from 'react';
import { Eye, XCircle, Shuffle } from 'lucide-react';

export type FilterMode = 'all' | 'unseen' | 'wrong';

interface QuestionFilterProps {
    currentFilter: FilterMode;
    onFilterChange: (filter: FilterMode) => void;
    colorClass: string;
    disabled?: boolean;
}

export const QuestionFilter: React.FC<QuestionFilterProps> = ({
    currentFilter,
    onFilterChange,
    colorClass,
    disabled = false
}) => {
    const filters: { id: FilterMode; label: string; icon: React.ReactNode }[] = [
        { id: 'all', label: 'Aleatório', icon: <Shuffle className="w-4 h-4" /> },
        { id: 'unseen', label: 'Nunca Vistas', icon: <Eye className="w-4 h-4" /> },
        { id: 'wrong', label: 'Erradas', icon: <XCircle className="w-4 h-4" /> },
    ];

    return (
        <div className="w-full">
            <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Modo de Estudo
            </label>
            <div className="grid grid-cols-3 gap-2">
                {filters.map(filter => {
                    const isActive = currentFilter === filter.id;

                    return (
                        <button
                            key={filter.id}
                            onClick={() => !disabled && onFilterChange(filter.id)}
                            disabled={disabled}
                            className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${isActive
                                    ? `${colorClass} text-white border-transparent shadow-md`
                                    : disabled
                                        ? 'bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-800 text-gray-300 dark:text-slate-600 cursor-not-allowed'
                                        : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:border-gray-300 dark:hover:border-slate-600'
                                }`}
                        >
                            {filter.icon}
                            <span className="text-xs font-medium">{filter.label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
