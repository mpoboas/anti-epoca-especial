import React, { useEffect, useState } from 'react';

interface ConfettiPiece {
    id: number;
    x: number;
    delay: number;
    duration: number;
    color: string;
    size: number;
    rotation: number;
}

interface ConfettiProps {
    isActive: boolean;
    duration?: number;
}

const COLORS = [
    '#22c55e', // green
    '#3b82f6', // blue
    '#f59e0b', // amber
    '#ec4899', // pink
    '#8b5cf6', // violet
    '#06b6d4', // cyan
    '#f97316', // orange
    '#a3e635', // lime
];

export const Confetti: React.FC<ConfettiProps> = ({ isActive, duration = 4000 }) => {
    const [pieces, setPieces] = useState<ConfettiPiece[]>([]);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (isActive) {
            // Generate confetti pieces
            const newPieces: ConfettiPiece[] = [];
            for (let i = 0; i < 100; i++) {
                newPieces.push({
                    id: i,
                    x: Math.random() * 100,
                    delay: Math.random() * 0.5,
                    duration: 2 + Math.random() * 2,
                    color: COLORS[Math.floor(Math.random() * COLORS.length)],
                    size: 8 + Math.random() * 8,
                    rotation: Math.random() * 360,
                });
            }
            setPieces(newPieces);
            setVisible(true);

            // Hide after duration
            const timer = setTimeout(() => {
                setVisible(false);
            }, duration);

            return () => clearTimeout(timer);
        }
    }, [isActive, duration]);

    if (!visible) return null;

    return (
        <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
            {pieces.map((piece) => (
                <div
                    key={piece.id}
                    className="absolute animate-confetti-fall"
                    style={{
                        left: `${piece.x}%`,
                        top: '-20px',
                        width: `${piece.size}px`,
                        height: `${piece.size}px`,
                        backgroundColor: piece.color,
                        borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                        transform: `rotate(${piece.rotation}deg)`,
                        animationDelay: `${piece.delay}s`,
                        animationDuration: `${piece.duration}s`,
                    }}
                />
            ))}
            <style>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(0) rotate(0deg) scale(1);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg) scale(0.5);
            opacity: 0;
          }
        }
        .animate-confetti-fall {
          animation: confetti-fall linear forwards;
        }
      `}</style>
        </div>
    );
};
