import React, { useState, useEffect } from 'react';
import { UserAnswer, Question } from '../types';
import { RefreshCw, Home } from 'lucide-react';
import { ResultHeader } from './shared/ResultHeader';
import { NavigationFooter } from './shared/NavigationFooter';
import { HorizontalQuestionNav } from './shared/HorizontalQuestionNav';
import { QuizCard } from './QuizCard';

interface ResultSummaryProps {
    questions: Question[];
    userAnswers: UserAnswer[];
    score: number;
    onRestart: () => void;
    onHome: () => void;
}

export const ResultSummary: React.FC<ResultSummaryProps> = ({ questions, userAnswers, score, onRestart, onHome }) => {
    const [currentIndex, setCurrentIndex] = useState(0);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight' && currentIndex < questions.length - 1) {
                setCurrentIndex(prev => prev + 1);
            } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
                setCurrentIndex(prev => prev - 1);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentIndex, questions.length]);

    const getStatusColor = (index: number) => {
        const q = questions[index];
        const answer = userAnswers.find(a => a.questionId === q.id)?.selectedAnswer;

        if (!answer) return 'bg-gray-200 border-gray-300 text-gray-400';

        switch (answer.value) {
            case '++': return 'bg-green-500 border-green-600 text-white';
            case '+': return 'bg-yellow-400 border-yellow-500 text-white';
            case '-': return 'bg-orange-400 border-orange-500 text-white';
            case '--': return 'bg-red-500 border-red-600 text-white';
            default: return 'bg-gray-400 border-gray-500 text-white';
        }
    };

    const correctCount = userAnswers.filter(ua => ua.selectedAnswer.value === '++').length;
    const currentQuestion = questions[currentIndex];
    const currentUserAnswer = userAnswers.find(ua => ua.questionId === currentQuestion.id);

    return (
        <div className="h-full flex flex-col w-full">
            {/* Result Header */}
            <ResultHeader
                score={score}
                correctCount={correctCount}
                totalQuestions={questions.length}
            />

            {/* Action Buttons */}
            <div className="shrink-0 bg-gray-100 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
                <div className="max-w-3xl mx-auto flex gap-2 p-3 px-4">
                    <button
                        onClick={onHome}
                        className="flex-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-200 text-sm font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        <Home className="w-4 h-4" />
                        Menu
                    </button>
                    <button
                        onClick={onRestart}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Novo Exame
                    </button>
                </div>
            </div>

            {/* Question Navigator - Centered on current */}
            <HorizontalQuestionNav
                total={questions.length}
                current={currentIndex}
                onSelect={setCurrentIndex}
                getStatusColor={getStatusColor}
            />

            <div className="flex-1 overflow-y-auto py-4 flex flex-col">
                <div className="flex-1 flex flex-col justify-center max-w-3xl mx-auto w-full px-4">
                    <QuizCard
                        key={currentQuestion.id}
                        question={currentQuestion}
                        selectedAnswer={currentUserAnswer?.selectedAnswer}
                        onAnswer={() => { }}
                        showFeedback={true}
                    />
                </div>
            </div>

            {/* Navigation Footer */}
            <NavigationFooter
                currentIndex={currentIndex}
                totalCount={questions.length}
                onPrevious={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                onNext={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
            />
        </div>
    );
};