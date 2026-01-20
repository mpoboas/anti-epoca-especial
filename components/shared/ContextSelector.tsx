import React from 'react';
import { Course } from '../../src/lib/pocketbase';
import { Globe } from 'lucide-react';

interface ContextSelectorProps {
    courses: Course[];
    selectedCourseId: string | null;
    onSelect: (course: Course | null) => void;
}

export const ContextSelector: React.FC<ContextSelectorProps> = ({ courses, selectedCourseId, onSelect }) => {
    return (
        <div className="flex gap-2 overflow-x-auto pb-4 mb-6 no-scrollbar custom-scrollbar">
            <button
                onClick={() => onSelect(null)}
                className={`px-6 py-3 rounded-2xl border-2 transition-all whitespace-nowrap min-w-[120px] flex items-center justify-center gap-2 font-bold ${selectedCourseId === null
                    ? 'bg-blue-600 border-transparent text-white shadow-lg shadow-blue-500/30'
                    : 'bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800 text-gray-500 dark:text-slate-400 hover:border-blue-500 hover:text-blue-600'
                    }`}
            >
                <Globe className="w-4 h-4" />
                <span>Global</span>
            </button>
            {courses.map(course => (
                <button
                    key={course.id}
                    onClick={() => onSelect(course)}
                    className={`px-6 py-3 rounded-2xl border-2 transition-all whitespace-nowrap flex items-center justify-center gap-2 font-bold ${selectedCourseId === course.id
                        ? 'bg-blue-600 border-transparent text-white shadow-lg shadow-blue-500/30'
                        : 'bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800 text-gray-500 dark:text-slate-400 hover:border-blue-500 hover:text-blue-600'
                        }`}
                >
                    <span>{course.title}</span>
                </button>
            ))}
        </div>
    );
};
