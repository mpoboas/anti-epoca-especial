import React, { useEffect, useState } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

interface TimerBarProps {
    totalSeconds: number;
    isRunning: boolean;
    onTimeUp: () => void;
    colorClass?: string;
}

export const TimerBar: React.FC<TimerBarProps> = ({
    totalSeconds,
    isRunning,
    onTimeUp,
    colorClass = 'bg-blue-600'
}) => {
    const [remainingSeconds, setRemainingSeconds] = useState(totalSeconds);
    const [hasWarned, setHasWarned] = useState(false);

    useEffect(() => {
        setRemainingSeconds(totalSeconds);
        setHasWarned(false);
    }, [totalSeconds]);

    useEffect(() => {
        if (!isRunning) return;

        const interval = setInterval(() => {
            setRemainingSeconds(prev => {
                if (prev <= 1) {
                    clearInterval(interval);
                    onTimeUp();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [isRunning, onTimeUp]);

    // Warning when 20% time remaining
    useEffect(() => {
        if (remainingSeconds <= totalSeconds * 0.2 && !hasWarned && remainingSeconds > 0) {
            setHasWarned(true);
        }
    }, [remainingSeconds, totalSeconds, hasWarned]);

    const percentage = (remainingSeconds / totalSeconds) * 100;
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;

    const isLowTime = remainingSeconds <= totalSeconds * 0.2;
    const isCritical = remainingSeconds <= 60;

    const getBarColor = () => {
        if (isCritical) return 'bg-red-500';
        if (isLowTime) return 'bg-amber-500';
        return colorClass;
    };

    return (
        <div className="w-full space-y-2">
            {/* Timer display */}
            <div className="flex items-center justify-between text-sm">
                <div className={`flex items-center gap-2 font-medium transition-colors ${isCritical ? 'text-red-500 animate-pulse' :
                        isLowTime ? 'text-amber-500' :
                            'text-gray-600 dark:text-slate-400'
                    }`}>
                    {isCritical ? (
                        <AlertTriangle className="w-4 h-4" />
                    ) : (
                        <Clock className="w-4 h-4" />
                    )}
                    <span className="font-mono font-bold">
                        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                    </span>
                </div>
                <span className="text-xs text-gray-400 dark:text-slate-500">
                    {isLowTime ? 'Tempo a acabar!' : 'Tempo restante'}
                </span>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-gray-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                    className={`h-full transition-all duration-1000 ease-linear rounded-full ${getBarColor()}`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
};
