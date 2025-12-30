import { UserAnswer, AnswerValue } from './types';

const DB_NAME = 'ExamPrepDB';
const DB_VERSION = 1;

export interface StoredExam {
  id?: number;
  date: number;
  score: number;
  answers: UserAnswer[];
}

export interface StoredQuestionStat {
  questionId: number | string;
  timesSeen: number;
  lastResult: AnswerValue | string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

const openDB = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('exams')) {
        db.createObjectStore('exams', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('stats')) {
        db.createObjectStore('stats', { keyPath: 'questionId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
};

export const saveExam = async (score: number, answers: UserAnswer[]) => {
  const db = await openDB();
  const tx = db.transaction(['exams', 'stats'], 'readwrite');
  
  // Save Exam
  const examStore = tx.objectStore('exams');
  await new Promise((resolve, reject) => {
      const req = examStore.add({ date: Date.now(), score, answers });
      req.onsuccess = resolve;
      req.onerror = reject;
  });

  // Update Stats
  const statsStore = tx.objectStore('stats');
  
  for (const ans of answers) {
    await new Promise<void>((resolve) => {
       const getReq = statsStore.get(ans.questionId);
       getReq.onsuccess = () => {
         const existing = getReq.result as StoredQuestionStat | undefined;
         const newItem: StoredQuestionStat = {
            questionId: ans.questionId,
            timesSeen: (existing?.timesSeen || 0) + 1,
            lastResult: ans.selectedAnswer.value
         };
         statsStore.put(newItem);
         resolve();
       };
    });
  }
};

export const getStats = async (allQuestionIds: (string|number)[]) => {
  const db = await openDB();
  
  // Get Exams for average
  const examsTx = db.transaction('exams', 'readonly');
  const examsStore = examsTx.objectStore('exams');
  const exams = await new Promise<StoredExam[]>((resolve) => {
      const req = examsStore.getAll();
      req.onsuccess = () => resolve(req.result);
  });

  // Get Question Stats
  const statsTx = db.transaction('stats', 'readonly');
  const statsStore = statsTx.objectStore('stats');
  const stats = await new Promise<StoredQuestionStat[]>((resolve) => {
      const req = statsStore.getAll();
      req.onsuccess = () => resolve(req.result);
  });

  const seenIds = new Set(stats.map(s => s.questionId));
  const questionsSeen = seenIds.size;
  
  const totalScore = exams.reduce((acc, curr) => acc + curr.score, 0);
  const averageGrade = exams.length ? (totalScore / exams.length) : 0;

  return {
    questionsSeen,
    totalQuestionsPool: allQuestionIds.length,
    examsTaken: exams.length,
    averageGrade,
    totalQuestions: allQuestionIds.length,
    seenIds
  };
};
