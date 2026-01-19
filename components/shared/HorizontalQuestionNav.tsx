import React, { useRef, useEffect, useState } from 'react';

interface HorizontalQuestionNavProps {
    total: number;
    current: number;
    onSelect: (index: number) => void;
    getStatusColor: (index: number) => string;
}

export const HorizontalQuestionNav: React.FC<HorizontalQuestionNavProps> = ({
    total,
    current,
    onSelect,
    getStatusColor
}) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [showLeftFade, setShowLeftFade] = useState(false);
    const [showRightFade, setShowRightFade] = useState(false);

    const updateFadeVisibility = () => {
        if (scrollRef.current) {
            const container = scrollRef.current;
            const buttons = container.querySelectorAll('button');
            if (buttons.length > 0) {
                const firstButton = buttons[0];
                const lastButton = buttons[buttons.length - 1];
                const containerRect = container.getBoundingClientRect();
                const firstRect = firstButton.getBoundingClientRect();
                const lastRect = lastButton.getBoundingClientRect();

                // Show left fade only if buttons are actually under/beyond it
                setShowLeftFade(firstRect.left < containerRect.left + 32);
                // Show right fade only if buttons are actually under/beyond it
                setShowRightFade(lastRect.right > containerRect.right - 32);
            }
        }
    };

    useEffect(() => {
        if (scrollRef.current) {
            const container = scrollRef.current;
            const activeItem = container.children[current] as HTMLElement;

            if (activeItem) {
                const containerWidth = container.offsetWidth;
                const itemLeft = activeItem.offsetLeft;
                const itemWidth = activeItem.offsetWidth;

                // Center the active item
                const scrollPos = itemLeft - (containerWidth / 2) + (itemWidth / 2);

                container.scrollTo({
                    left: scrollPos,
                    behavior: 'smooth'
                });

                // Update visibility after smooth scroll completes
                const timer = setTimeout(updateFadeVisibility, 300);
                return () => clearTimeout(timer);
            }
        }
    }, [current]);

    useEffect(() => {
        updateFadeVisibility();
        const container = scrollRef.current;
        if (container) {
            container.addEventListener('scroll', updateFadeVisibility);
            window.addEventListener('resize', updateFadeVisibility);
        }
        return () => {
            if (container) {
                container.removeEventListener('scroll', updateFadeVisibility);
            }
            window.removeEventListener('resize', updateFadeVisibility);
        };
    }, []);

    return (
        <div className="shrink-0 bg-white/50 dark:bg-slate-900/50 border-b border-gray-200/50 dark:border-slate-800/50 relative">
            <div className="max-w-3xl mx-auto relative h-full">
                {/* Fade indicators - only shown when buttons are underneath */}
                <div className={`absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white dark:from-slate-950 to-transparent z-10 pointer-events-none transition-opacity duration-300 ${showLeftFade ? 'opacity-100' : 'opacity-0'}`}></div>
                <div className={`absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white dark:from-slate-950 to-transparent z-10 pointer-events-none transition-opacity duration-300 ${showRightFade ? 'opacity-100' : 'opacity-0'}`}></div>

                <div
                    ref={scrollRef}
                    className="flex gap-3 overflow-x-auto py-3 px-[50%] no-scrollbar scroll-smooth"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                    {Array.from({ length: total }).map((_, idx) => {
                        const colorClass = getStatusColor(idx);
                        const isCurrent = current === idx;

                        return (
                            <button
                                key={idx}
                                onClick={() => onSelect(idx)}
                                className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-200 border-2 snap-center ${colorClass} ${isCurrent ? 'ring-4 ring-blue-200 dark:ring-blue-900/50 scale-110 z-10 shadow-lg' : 'opacity-90 hover:opacity-100 hover:scale-105'
                                    }`}
                            >
                                {idx + 1}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
