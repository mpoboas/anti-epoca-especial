import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface NavigationFooterProps {
    currentIndex: number;
    totalCount: number;
    onPrevious: () => void;
    onNext: () => void;
    compact?: boolean;
}

export const NavigationFooter: React.FC<NavigationFooterProps> = ({
    currentIndex,
    totalCount,
    onPrevious,
    onNext,
    compact = false
}) => {
    const isFirst = currentIndex === 0;
    const isLast = currentIndex === totalCount - 1;

    return (
        <div className="shrink-0 border-t border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
            <div className="max-w-3xl mx-auto flex justify-between items-center p-3 px-4">
                <button
                    onClick={onPrevious}
                    disabled={isFirst}
                    className="flex items-center gap-1 px-3 py-2 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg disabled:opacity-30 transition-colors text-sm"
                >
                    <ChevronLeft className="w-4 h-4" />
                    {compact ? 'Ant.' : 'Anterior'}
                </button>

                <span className="text-xs text-gray-400 font-medium">
                    {currentIndex + 1}/{totalCount}
                </span>

                <button
                    onClick={onNext}
                    disabled={isLast}
                    className="flex items-center gap-1 px-3 py-2 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg disabled:opacity-30 transition-colors text-sm font-medium"
                >
                    {compact ? 'Seg.' : 'Seguinte'}
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};
