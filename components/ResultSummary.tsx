import React, { useState, useEffect } from 'react';
import { UserAnswer, Question } from '../types';
import { RefreshCw, Home, ArrowRight, ArrowLeft, CheckCircle2, XCircle } from 'lucide-react';
import { QuizCard } from './QuizCard';
import { QuestionNavigator } from './QuestionNavigator';

interface ResultSummaryProps {
  questions: Question[];
  userAnswers: UserAnswer[];
  score: number;
  onRestart: () => void;
  onHome: () => void;
}

export const ResultSummary: React.FC<ResultSummaryProps> = ({ questions, userAnswers, score, onRestart, onHome }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Keyboard navigation for results review
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowRight':
                if (currentIndex < questions.length - 1) {
                    setCurrentIndex(prev => prev + 1);
                }
                break;
            case 'ArrowLeft':
                if (currentIndex > 0) {
                    setCurrentIndex(prev => prev - 1);
                }
                break;
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

  const isPassed = score >= 9.5;
  const bgColor = isPassed ? 'bg-green-600' : 'bg-red-600';
  const StatusIcon = isPassed ? CheckCircle2 : XCircle;

  const currentQuestion = questions[currentIndex];
  const currentUserAnswer = userAnswers.find(ua => ua.questionId === currentQuestion.id);

  return (
    <div className="max-w-3xl mx-auto w-full h-full flex flex-col animate-fade-in relative">
      {/* Compact Score Header */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden shrink-0 mb-3 md:mb-4 z-10">
        <div className={`${bgColor} p-3 md:p-4 flex items-center justify-between text-white transition-colors`}>
          <div className="flex items-center gap-3">
             <StatusIcon className="w-6 h-6 md:w-8 md:h-8 opacity-90" />
             <div className="flex flex-col">
                <h2 className="text-lg md:text-xl font-bold leading-tight">
                    {isPassed ? "Aprovado" : "Reprovado"}
                </h2>
                <span className="text-[10px] md:text-xs opacity-80 uppercase tracking-wider font-semibold">Resultado Final</span>
             </div>
          </div>
          <div className="text-right">
              <span className="text-3xl md:text-4xl font-extrabold tracking-tighter">{score.toFixed(1)}</span>
              <span className="text-xs md:text-sm opacity-80 font-medium ml-1">/ 20</span>
          </div>
        </div>
        
        <div className="p-2 md:p-3 flex gap-3 bg-gray-50 border-t border-gray-100">
             <button 
                onClick={onHome}
                className="flex-1 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 text-sm font-bold py-2 md:py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
                <Home className="w-4 h-4" />
                Menu
            </button>
            <button 
                onClick={onRestart}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold py-2 md:py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
                <RefreshCw className="w-4 h-4" />
                Novo Exame
            </button>
        </div>
      </div>

      {/* Review Section */}
      <div className="flex-1 flex flex-col min-h-0 bg-slate-100/50 rounded-xl border border-slate-200 overflow-hidden relative">
        <div className="bg-white p-2 md:p-3 border-b border-gray-200 shrink-0 z-10">
            <h3 className="text-xs md:text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Rever Respostas</h3>
            <QuestionNavigator 
                total={questions.length}
                current={currentIndex}
                onSelect={setCurrentIndex}
                getStatusColor={getStatusColor}
            />
        </div>

        {/* Scrollable area - padding bottom added to clear fixed footer */}
        <div className="flex-1 overflow-y-auto p-2 pb-24 md:p-4 md:pb-4 custom-scrollbar">
            <QuizCard 
                question={currentQuestion}
                selectedAnswer={currentUserAnswer?.selectedAnswer}
                onAnswer={() => {}}
                showFeedback={true}
            />
        </div>
        
        {/* Fixed Navigation Buttons - Mobile: Fixed Bottom, Desktop: Relative */}
        <div className="fixed bottom-0 left-0 right-0 p-3 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-50 md:relative md:bg-transparent md:border-t md:shadow-none md:p-4">
            <div className="flex justify-between items-center gap-3 md:gap-4 max-w-3xl mx-auto md:w-full">
                <button
                    onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                    disabled={currentIndex === 0}
                    className="flex-1 flex items-center justify-center px-4 py-3 md:py-2 text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:shadow-sm rounded-xl disabled:opacity-30 disabled:hover:bg-transparent font-medium transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 md:mr-2" />
                    <span className="hidden md:inline">Anterior</span>
                    <span className="md:hidden">Ant.</span>
                </button>
                
                <div className="text-xs font-medium text-gray-400 whitespace-nowrap min-w-[50px] text-center hidden md:block">
                    {currentIndex + 1} / {questions.length}
                </div>
                
                {/* Mobile counter indicator */}
                <div className="text-xs font-bold text-gray-500 md:hidden bg-gray-100 px-2 py-1 rounded">
                    {currentIndex + 1}/{questions.length}
                </div>

                <button
                    onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
                    disabled={currentIndex === questions.length - 1}
                    className="flex-1 flex items-center justify-center px-4 py-3 md:py-2 text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:shadow-sm rounded-xl disabled:opacity-30 disabled:hover:bg-transparent font-medium transition-colors"
                >
                    <span className="hidden md:inline">Seguinte</span>
                    <span className="md:hidden">Seg.</span>
                    <ArrowRight className="w-5 h-5 md:ml-2" />
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};