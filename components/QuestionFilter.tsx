import React from 'react';
import { Eye, XCircle, Shuffle, Tag, ChevronDown, X } from 'lucide-react';

export type FilterMode = 'all' | 'unseen' | 'wrong' | 'theme';

interface QuestionFilterProps {
    currentFilter: FilterMode;
    onFilterChange: (filter: FilterMode) => void;
    colorClass: string;
    disabled?: boolean;
    themes?: string[];
    selectedTheme?: string | null;
    onThemeChange?: (theme: string | null) => void;
}

export const QuestionFilter: React.FC<QuestionFilterProps> = ({
    currentFilter,
    onFilterChange,
    colorClass,
    disabled = false,
    themes = [],
    selectedTheme = null,
    onThemeChange
}) => {
    const filters: { id: FilterMode; label: string; icon: React.ReactNode }[] = [
        { id: 'all', label: 'Aleatório', icon: <Shuffle className="w-4 h-4" /> },
        { id: 'unseen', label: 'Novas', icon: <Eye className="w-4 h-4" /> },
        { id: 'wrong', label: 'Erradas', icon: <XCircle className="w-4 h-4" /> },
        { id: 'theme', label: 'Por Tema', icon: <Tag className="w-4 h-4" /> },
    ];

    // Filter themes to only those that actually exist
    const hasThemes = themes.length > 0;
    const availableFilters = hasThemes ? filters : filters.filter(f => f.id !== 'theme');

    return (
        <div className="w-full space-y-4">
            <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Modo de Estudo
                </label>
                <div className={`grid ${availableFilters.length === 4 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-3'} gap-2`}>
                    {availableFilters.map(filter => {
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
                                <span className="text-xs font-medium whitespace-nowrap">{filter.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {currentFilter === 'theme' && hasThemes && onThemeChange && (
                <div className="animate-in slide-in-from-top-2 duration-200">
                    <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                        Selecionar Tema
                    </label>
                    <div className="relative">
                        <select
                            value={selectedTheme || ''}
                            onChange={(e) => onThemeChange(e.target.value || null)}
                            disabled={disabled}
                            className={`w-full appearance-none bg-white dark:bg-slate-900 border-2 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200 py-3 px-10 rounded-xl font-medium focus:outline-none focus:border-blue-500 transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                                }`}
                        >
                            <option value="">Todos os Temas</option>
                            {themes.map(theme => (
                                <option key={theme} value={theme}>{theme}</option>
                            ))}
                        </select>
                        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />

                        {selectedTheme && (
                            <button
                                onClick={() => onThemeChange(null)}
                                className="absolute right-10 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                            >
                                <X className="w-3 h-3 text-gray-400" />
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
