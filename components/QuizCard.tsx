import React from 'react';
import { Question, Answer } from '../types';
import { CheckCircle2, XCircle, AlertCircle, HelpCircle } from 'lucide-react';

interface QuizCardProps {
  question: Question;
  selectedAnswer: Answer | undefined;
  onAnswer: (answer: Answer) => void;
  showFeedback: boolean; // If true, shows correct/incorrect. If false, just shows selection.
}

const getFeedbackConfig = (value: string) => {
  switch (value) {
    case '++': return { label: 'Correta', color: 'bg-green-100 border-green-500 text-green-800', icon: <CheckCircle2 className="w-5 h-5 text-green-600" /> };
    case '+': return { label: 'Menos Boa', color: 'bg-yellow-100 border-yellow-500 text-yellow-800', icon: <HelpCircle className="w-5 h-5 text-yellow-600" /> };
    case '-': return { label: 'Menos Má', color: 'bg-orange-100 border-orange-500 text-orange-800', icon: <AlertCircle className="w-5 h-5 text-orange-600" /> };
    case '--': return { label: 'Errada', color: 'bg-red-100 border-red-500 text-red-800', icon: <XCircle className="w-5 h-5 text-red-600" /> };
    default: return { label: 'Desconhecido', color: 'bg-gray-100 border-gray-500 text-gray-800', icon: null };
  }
};

export const QuizCard: React.FC<QuizCardProps> = ({ question, selectedAnswer, onAnswer, showFeedback }) => {
  
  const handleSelect = (answer: Answer) => {
    if (showFeedback) return; // Read-only in feedback mode
    onAnswer(answer);
  };

  const getShortcutLabel = (index: number) => {
      if (index < 4) return index + 1;
      return String.fromCharCode(65 + index); // A, B, C...
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-5 md:p-8 w-full mx-auto transition-all duration-300 flex flex-col h-auto">
      <h2 className="text-lg md:text-2xl font-semibold text-gray-800 mb-6 leading-relaxed">
        {question.text}
      </h2>

      <div className="space-y-3 md:space-y-4">
        {question.answers.map((answer, index) => {
          const isSelected = selectedAnswer?.text === answer.text; // Compare by text or value if unique
          
          let buttonClass = "w-full text-left p-4 md:p-5 rounded-xl border-2 transition-all duration-200 flex items-center justify-between group relative active:scale-[0.99] ";
          
          if (showFeedback) {
             const feedback = getFeedbackConfig(answer.value);
             if (isSelected) {
               buttonClass += feedback.color;
             } else if (answer.value === '++') {
               buttonClass += "bg-green-50 border-green-300 text-green-700 opacity-75 ";
             } else {
               buttonClass += "bg-gray-50 border-gray-200 text-gray-400 opacity-50 ";
             }
          } else {
             // Exam Mode
             if (isSelected) {
                buttonClass += "border-indigo-600 bg-indigo-50 text-indigo-900 shadow-md ring-1 ring-indigo-600 ";
             } else {
                buttonClass += "border-gray-200 hover:border-indigo-300 hover:bg-gray-50 text-gray-700 ";
             }
          }

          return (
            <button
              key={index}
              onClick={() => handleSelect(answer)}
              disabled={showFeedback}
              className={buttonClass}
            >
              <div className="flex items-center gap-3 md:gap-4 w-full">
                  {!showFeedback && (
                      <span className={`shrink-0 flex items-center justify-center w-6 h-6 md:w-8 md:h-8 rounded border text-xs md:text-sm font-bold transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-300 text-gray-500'}`}>
                          {getShortcutLabel(index)}
                      </span>
                  )}
                  <span className="font-medium text-base md:text-lg">{answer.text}</span>
              </div>
              
              {showFeedback && isSelected && (
                 <div className="shrink-0 flex items-center gap-2 font-bold text-xs md:text-sm uppercase tracking-wide ml-2">
                    <span className="hidden md:inline">{getFeedbackConfig(answer.value).label}</span>
                    {getFeedbackConfig(answer.value).icon}
                 </div>
              )}
               {showFeedback && !isSelected && answer.value === '++' && (
                 <div className="shrink-0 flex items-center gap-2 font-bold text-sm uppercase tracking-wide text-green-600 ml-2">
                    <CheckCircle2 className="w-5 h-5" />
                 </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};