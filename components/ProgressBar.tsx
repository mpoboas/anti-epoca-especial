import React from 'react';

interface ProgressBarProps {
  current: number;
  total: number;
  label?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ current, total, label }) => {
  const percentage = Math.min(100, Math.max(0, ((current + 1) / total) * 100));

  return (
    <div className="w-full mb-6">
      <div className="bg-gray-200 rounded-full h-2.5 overflow-hidden">
        <div 
            className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300 ease-in-out" 
            style={{ width: `${percentage}%` }}
        ></div>
      </div>
      <div className="flex justify-between text-xs font-medium text-gray-500 mt-2">
        <span>Question {current + 1} of {total}</span>
        {label && <span>{label}</span>}
      </div>
    </div>
  );
};