import React, { useEffect, useRef } from 'react';

interface QuestionNavigatorProps {
  total: number;
  current: number;
  onSelect: (index: number) => void;
  // Function to determine the styling of a specific index
  getStatusColor: (index: number) => string;
}

export const QuestionNavigator: React.FC<QuestionNavigatorProps> = ({ total, current, onSelect, getStatusColor }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      const container = scrollRef.current;
      const activeItem = container.children[current] as HTMLElement;

      if (activeItem) {
        const containerWidth = container.offsetWidth;
        const itemLeft = activeItem.offsetLeft;
        const itemWidth = activeItem.offsetWidth;

        // Center logic: Item position - Half Container + Half Item
        const scrollPos = itemLeft - (containerWidth / 2) + (itemWidth / 2);

        container.scrollTo({
          left: scrollPos,
          behavior: 'smooth'
        });
      }
    }
  }, [current]);

  return (
    <div className="w-full mb-4 md:mb-6 relative group">
      {/* Visual fade indicators for overflow */}
      <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-slate-50 dark:from-slate-950 to-transparent z-10 pointer-events-none"></div>
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-slate-50 dark:from-slate-950 to-transparent z-10 pointer-events-none"></div>

      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto py-2 md:py-4 px-[50%] no-scrollbar scroll-smooth snap-x"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {Array.from({ length: total }).map((_, idx) => {
          const colorClass = getStatusColor(idx);
          const isCurrent = current === idx;

          return (
            <button
              key={idx}
              onClick={() => onSelect(idx)}
              className={`
                        flex-shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center font-bold text-xs md:text-sm transition-all duration-200 border-2 snap-center
                        ${colorClass}
                        ${isCurrent ? 'ring-4 ring-blue-200 dark:ring-blue-900/50 scale-110 z-10 shadow-lg' : 'opacity-90 hover:opacity-100 hover:scale-105'}
                    `}
            >
              {idx + 1}
            </button>
          )
        })}
      </div>
    </div>
  );
};