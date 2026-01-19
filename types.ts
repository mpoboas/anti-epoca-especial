export type AnswerValue = '++' | '+' | '-' | '--';

export interface Answer {
  text: string;
  value: AnswerValue | string; 
}

export interface Question {
  id: number | string;
  text: string;
  answers: Answer[];
  explanation?: string; // Optional explanation for the correct answer
}

export interface QuizData {
  questions: Question[];
}

export interface UserAnswer {
  questionId: number | string;
  selectedAnswer: Answer;
}

export interface ExamResult {
  id?: number;
  date: number;
  score: number;
  answers: UserAnswer[];
}

export interface GlobalStats {
  questionsSeen: number;
  totalQuestions: number;
  examsTaken: number;
  averageGrade: number;
  totalQuestionsPool: number;
}
