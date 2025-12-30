import { Question, Answer, UserAnswer } from './types';

export const shuffleArray = <T>(array: T[]): T[] => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

export const getRandomQuestions = (allQuestions: Question[], count: number = 15): Question[] => {
    const shuffled = shuffleArray(allQuestions);
    const selected = shuffled.slice(0, Math.min(count, shuffled.length));
    
    // Shuffle answers for each selected question
    return selected.map(q => ({
        ...q,
        answers: shuffleArray(q.answers)
    }));
};

export const calculateScore = (userAnswers: UserAnswer[], totalQuestions: number): number => {
    let totalPoints = 0;
    
    userAnswers.forEach(ans => {
        switch (ans.selectedAnswer.value) {
            case '++': totalPoints += 1; break;
            case '+': totalPoints += 0.33; break;
            case '-': totalPoints -= 0.33; break;
            case '--': totalPoints -= 1; break;
        }
    });

    // If totalQuestions is 0 (shouldn't happen in exam), return 0
    if (totalQuestions === 0) return 0;

    // Normalize to 0-20 scale
    // Formula: (Total Points / Total Questions) * 20
    const grade = (totalPoints / totalQuestions) * 20;
    
    // Ensure grade is between 0 and 20 and round to 1 decimal
    // We clamp at 0 because negative grades are usually not displayed on a 0-20 scale
    return Math.max(0, Math.round(grade * 10) / 10);
};
