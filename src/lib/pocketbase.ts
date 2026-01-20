import PocketBase from 'pocketbase';

// Pocketbase client instance with localStorage persistence
const POCKETBASE_URL = import.meta.env.VITE_POCKETBASE_URL || 'http://143.47.40.66:9000';
export const pb = new PocketBase(POCKETBASE_URL);

// Disable auto-cancellation to prevent request conflicts
pb.autoCancellation(false);

// Type definitions for our collections
export interface Course {
    id: string;
    title: string;
    description?: string;
    created: string;
    updated: string;
}

export interface Answer {
    text: string;
    value: '++' | '+' | '-' | '--';
}

export interface Question {
    id: string;
    text: string;
    answers: Answer[];
    explanation?: string; // Optional explanation for the correct answer
    source: 'previous' | 'ai' | 'kahoots';
    theme?: string;
    course: string;
    created: string;
    updated: string;
}

export interface ExamResult {
    id: string;
    user: string;
    course: string;
    source: 'previous' | 'ai' | 'kahoots';
    score: number;
    total_questions: number;
    correct_answers: number;
    created: string;
    updated: string;
}

export interface ExamAnswer {
    id: string;
    exam_result: string;
    question: string;
    selected_answer: Answer;
    answer_value: '++' | '+' | '-' | '--';
    created: string;
    updated: string;
}

export interface User {
    id: string;
    email: string;
    name?: string;
    avatar?: string;
    role?: 'student' | 'admin';
    created: string;
    updated: string;
}

// Auth helpers
export const isLoggedIn = () => pb.authStore.isValid;
export const getCurrentUser = () => pb.authStore.record as unknown as User | null;
export const logout = () => pb.authStore.clear();
export const isAdmin = () => {
    // Try both record and model as Pocketbase SDK versions differ
    const user = pb.authStore.record || (pb.authStore as any).model;
    return user?.role === 'admin';
};

// Login with email/password
export const login = async (email: string, password: string) => {
    return await pb.collection('users').authWithPassword(email, password);
};

// Register new user
export const register = async (email: string, password: string, name?: string) => {
    const data = {
        email,
        password,
        passwordConfirm: password,
        name: name || email.split('@')[0],
        role: 'student',
    };

    await pb.collection('users').create(data);
    return await login(email, password);
};

// Courses API
export const getCourses = async (): Promise<Course[]> => {
    return await pb.collection('courses').getFullList<Course>({
        sort: 'title',
        requestKey: null, // Disable auto-cancellation
    });
};

// Questions API
export const getQuestions = async (courseId: string, source?: string): Promise<Question[]> => {
    let filter = `course = "${courseId}"`;
    if (source) {
        filter += ` && source = "${source}"`;
    }

    return await pb.collection('questions').getFullList<Question>({
        filter,
        sort: 'created',
        requestKey: null, // Disable auto-cancellation
    });
};

export const getQuestionCount = async (courseId: string, source: string): Promise<number> => {
    const result = await pb.collection('questions').getList(1, 1, {
        filter: `course = "${courseId}" && source = "${source}"`,
        requestKey: null, // Disable auto-cancellation
    });
    return result.totalItems;
};

// Shuffle array helper
const shuffleArray = <T>(array: T[]): T[] => {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
};

// Get IDs of questions the user has already answered
export const getSeenQuestionIds = async (courseId: string): Promise<Set<string>> => {
    const userId = getCurrentUser()?.id;
    if (!userId) return new Set();

    try {
        // Get all exam results for this user and course
        const examResults = await pb.collection('exam_results').getFullList<ExamResult>({
            filter: `user = "${userId}" && course = "${courseId}"`,
        });

        if (examResults.length === 0) return new Set();

        // Get all exam answers in batches
        const examIds = examResults.map(e => e.id);
        const seenIds = new Set<string>();
        const batchSize = 10;

        for (let i = 0; i < examIds.length; i += batchSize) {
            const batch = examIds.slice(i, i + batchSize);
            const filterExamIds = batch.map(id => `exam_result = "${id}"`).join(' || ');

            try {
                const answers = await pb.collection('exam_answers').getFullList<ExamAnswer>({
                    filter: filterExamIds,
                });
                answers.forEach(a => seenIds.add(a.question));
            } catch (e) {
                // Ignore errors, continue with what we have
            }
        }

        return seenIds;
    } catch (e) {
        return new Set();
    }
};

export const getRandomQuestions = async (
    courseId: string,
    source: string,
    count: number = 15
): Promise<Question[]> => {
    const allQuestions = await getQuestions(courseId, source);

    // Get questions the user has already seen
    const seenIds = await getSeenQuestionIds(courseId);

    // Separate into unseen and seen questions
    const unseenQuestions = allQuestions.filter(q => !seenIds.has(q.id));
    const seenQuestions = allQuestions.filter(q => seenIds.has(q.id));

    let selected: Question[] = [];

    // First, take from unseen questions
    const shuffledUnseen = shuffleArray(unseenQuestions);
    selected = shuffledUnseen.slice(0, Math.min(count, shuffledUnseen.length));

    // If we need more questions, take from seen questions
    if (selected.length < count && seenQuestions.length > 0) {
        const shuffledSeen = shuffleArray(seenQuestions);
        const remaining = count - selected.length;
        selected = [...selected, ...shuffledSeen.slice(0, remaining)];
    }

    // Shuffle answers within each question
    return selected.map(q => ({
        ...q,
        answers: shuffleArray([...q.answers])
    }));
};

// Exam Results API
export const saveExamResult = async (
    courseId: string,
    source: 'previous' | 'ai' | 'kahoots',
    score: number,
    totalQuestions: number,
    correctAnswers: number,
    answers: { questionId: string; selectedAnswer: Answer }[]
): Promise<ExamResult> => {
    const userId = getCurrentUser()?.id;
    if (!userId) throw new Error('User not logged in');

    // Ensure valid numbers
    const safeScore = Number(score) || 0;
    const safeTotalQuestions = Number(totalQuestions) || 1;
    const safeCorrectAnswers = Number(correctAnswers) || 0;

    // Create exam result
    const examResult = await pb.collection('exam_results').create<ExamResult>({
        user: userId,
        course: courseId,
        source,
        score: safeScore,
        total_questions: safeTotalQuestions,
        correct_answers: safeCorrectAnswers,
    }, { requestKey: null });

    // Save individual answers in background (don't await all)
    for (const a of answers) {
        pb.collection('exam_answers').create({
            exam_result: examResult.id,
            question: a.questionId,
            selected_answer: a.selectedAnswer,
            answer_value: a.selectedAnswer.value,
        }, { requestKey: null }).catch(console.error);
    }

    return examResult;
};

// Stats API
export interface UserStats {
    totalExams: number;
    passedExams: number;
    failedExams: number;
    averageScore: number;
    totalQuestionsAnswered: number;
    totalCorrectAnswers: number;
    uniqueQuestionsSeen: number;
    totalQuestionsInPool: number;
    scoreEvolution: { date: string; score: number; source: string }[];
    passRate: number;
}

export const getUserStats = async (courseId: string, source?: string): Promise<UserStats> => {
    const userId = getCurrentUser()?.id;
    if (!userId) {
        return {
            totalExams: 0,
            passedExams: 0,
            failedExams: 0,
            averageScore: 0,
            totalQuestionsAnswered: 0,
            totalCorrectAnswers: 0,
            uniqueQuestionsSeen: 0,
            totalQuestionsInPool: 0,
            scoreEvolution: [],
            passRate: 0,
        };
    }

    let filter = `user = "${userId}" && course = "${courseId}"`;
    if (source) {
        filter += ` && source = "${source}"`;
    }

    const examResults = await pb.collection('exam_results').getFullList<ExamResult>({
        filter,
        sort: '-created',
        requestKey: null, // Disable auto-cancellation
    });

    // Get total questions in pool
    let totalQuestionsInPool = 0;
    if (source) {
        totalQuestionsInPool = await getQuestionCount(courseId, source);
    }

    // Calculate stats
    const totalExams = examResults.length;
    const passedExams = examResults.filter(e => e.score >= 10).length;
    const failedExams = totalExams - passedExams;
    const averageScore = totalExams > 0
        ? examResults.reduce((sum, e) => sum + e.score, 0) / totalExams
        : 0;
    const totalQuestionsAnswered = examResults.reduce((sum, e) => sum + e.total_questions, 0);
    const totalCorrectAnswers = examResults.reduce((sum, e) => sum + e.correct_answers, 0);

    // Get unique questions seen
    let uniqueQuestionsSeen = 0;
    if (examResults.length > 0) {
        const examIds = examResults.map(e => e.id);
        const filterExamIds = examIds.slice(0, 20).map(id => `exam_result = "${id}"`).join(' || ');

        if (filterExamIds) {
            const examAnswers = await pb.collection('exam_answers').getFullList<ExamAnswer>({
                filter: filterExamIds,
                requestKey: null, // Disable auto-cancellation
            });
            const uniqueQuestions = new Set(examAnswers.map(a => a.question));
            uniqueQuestionsSeen = uniqueQuestions.size;
        }
    }

    // Score evolution (last 10 exams, ordered oldest to newest)
    const scoreEvolution = examResults
        .slice(0, 10)
        .reverse()
        .map(e => ({
            date: e.created,
            score: e.score,
            source: e.source,
        }));

    return {
        totalExams,
        passedExams,
        failedExams,
        averageScore: Math.round(averageScore * 10) / 10,
        totalQuestionsAnswered,
        totalCorrectAnswers,
        uniqueQuestionsSeen,
        totalQuestionsInPool,
        scoreEvolution,
        passRate: totalExams > 0 ? Math.round((passedExams / totalExams) * 100) : 0,
    };
};

// Admin: Create questions in batch
export interface QuestionInput {
    text: string;
    answers: Answer[];
}

export const createQuestions = async (
    courseId: string,
    source: 'previous' | 'ai' | 'kahoots',
    questions: QuestionInput[]
): Promise<{ created: number; errors: string[] }> => {
    const errors: string[] = [];
    let created = 0;

    for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        try {
            await pb.collection('questions').create({
                text: q.text,
                answers: q.answers,
                source,
                course: courseId,
            }, { requestKey: null });
            created++;
        } catch (e: any) {
            errors.push(`Pergunta ${i + 1}: ${e.message || 'Erro desconhecido'}`);
        }
    }

    return { created, errors };
};

// Get all unique themes for a course and source
export const getThemes = async (courseId: string, source: string): Promise<string[]> => {
    const questions = await getQuestions(courseId, source);
    const themes = new Set<string>();
    questions.forEach(q => {
        if (q.theme) themes.add(q.theme);
    });
    return Array.from(themes).sort();
};

// Leaderboard types and API
export interface LeaderboardEntry {
    userId: string;
    userName: string;
    averageScore: number;
    totalExams: number;
    passRate: number;
}

export const getLeaderboard = async (
    courseId: string,
    source?: string,
    limit: number = 20
): Promise<LeaderboardEntry[]> => {
    let filter = courseId ? `course = "${courseId}"` : '';
    if (source) {
        if (filter) filter += ' && ';
        filter += `source = "${source}"`;
    }

    try {
        // Get all exam results with user expansion
        const examResults = await pb.collection('exam_results').getFullList<ExamResult & { expand?: { user: User } }>({
            filter,
            expand: 'user',
            requestKey: null,
        });

        // Group by user
        const userStats = new Map<string, { 
            userName: string; 
            scores: number[]; 
            passed: number;
        }>();

        for (const result of examResults) {
            const userId = result.user;
            const userName = result.expand?.user?.name || 'Anónimo';
            
            if (!userStats.has(userId)) {
                userStats.set(userId, { userName, scores: [], passed: 0 });
            }
            
            const stats = userStats.get(userId)!;
            stats.scores.push(result.score);
            if (result.score >= 10) stats.passed++;
        }

        // Calculate averages and sort
        const leaderboard: LeaderboardEntry[] = [];
        
        userStats.forEach((stats, odiserId) => {
            const totalExams = stats.scores.length;
            const averageScore = stats.scores.reduce((a, b) => a + b, 0) / totalExams;
            
            leaderboard.push({
                userId: odiserId,
                userName: stats.userName,
                averageScore: Math.round(averageScore * 10) / 10,
                totalExams,
                passRate: Math.round((stats.passed / totalExams) * 100),
            });
        });

        // Sort by average score (desc), then by total exams (desc)
        leaderboard.sort((a, b) => {
            if (b.averageScore !== a.averageScore) {
                return b.averageScore - a.averageScore;
            }
            return b.totalExams - a.totalExams;
        });

        return leaderboard.slice(0, limit);
    } catch (e) {
        console.error('Failed to get leaderboard:', e);
        return [];
    }
};

// Get IDs of questions the user answered wrong (-- value)
export const getWrongQuestionIds = async (courseId: string, source?: string): Promise<Set<string>> => {
    const userId = getCurrentUser()?.id;
    if (!userId) return new Set();

    try {
        // Get all exam results for this user
        let filter = `user = "${userId}" && course = "${courseId}"`;
        if (source) {
            filter += ` && source = "${source}"`;
        }

        const examResults = await pb.collection('exam_results').getFullList<ExamResult>({
            filter,
            requestKey: null,
        });

        if (examResults.length === 0) return new Set();

        // Get all wrong answers
        const wrongIds = new Set<string>();
        const examIds = examResults.map(e => e.id);
        const batchSize = 10;

        for (let i = 0; i < examIds.length; i += batchSize) {
            const batch = examIds.slice(i, i + batchSize);
            const filterExamIds = batch.map(id => `exam_result = "${id}"`).join(' || ');

            try {
                const answers = await pb.collection('exam_answers').getFullList<ExamAnswer>({
                    filter: `(${filterExamIds}) && answer_value = "--"`,
                    requestKey: null,
                });
                answers.forEach(a => wrongIds.add(a.question));
            } catch (e) {
                // Ignore errors, continue
            }
        }

        return wrongIds;
    } catch (e) {
        console.error('Failed to get wrong questions:', e);
        return new Set();
    }
};

// Get filtered random questions based on mode
export const getFilteredRandomQuestions = async (
    courseId: string,
    source: string,
    count: number = 15,
    mode: 'all' | 'unseen' | 'wrong' | 'theme' = 'all',
    theme?: string
): Promise<Question[]> => {
    let allQuestions = await getQuestions(courseId, source);

    if (theme) {
        allQuestions = allQuestions.filter(q => q.theme === theme);
    }
    
    if (allQuestions.length === 0) {
        return [];
    }
    
    let selected: Question[] = [];
    
    if (mode === 'all' || mode === 'theme') {
        // Pure random selection from all questions (already filtered by theme if applicable)
        const shuffled = shuffleArray(allQuestions);
        selected = shuffled.slice(0, Math.min(count, shuffled.length));
    } else if (mode === 'unseen') {
        // Only unseen questions, fill with random if not enough
        const seenIds = await getSeenQuestionIds(courseId);
        const unseenQuestions = allQuestions.filter(q => !seenIds.has(q.id));
        const seenQuestions = allQuestions.filter(q => seenIds.has(q.id));
        
        const shuffledUnseen = shuffleArray(unseenQuestions);
        selected = shuffledUnseen.slice(0, Math.min(count, shuffledUnseen.length));
        
        // Fill with random seen questions if not enough unseen
        if (selected.length < count && seenQuestions.length > 0) {
            const shuffledSeen = shuffleArray(seenQuestions);
            const remaining = count - selected.length;
            selected = [...selected, ...shuffledSeen.slice(0, remaining)];
        }
    } else if (mode === 'wrong') {
        // Wrong questions first, then fill with random from pool
        const wrongIds = await getWrongQuestionIds(courseId, source);
        const wrongQuestions = allQuestions.filter(q => wrongIds.has(q.id));
        const otherQuestions = allQuestions.filter(q => !wrongIds.has(q.id));
        
        const shuffledWrong = shuffleArray(wrongQuestions);
        selected = shuffledWrong.slice(0, Math.min(count, shuffledWrong.length));
        
        // Fill with random other questions if not enough wrong
        if (selected.length < count && otherQuestions.length > 0) {
            const shuffledOther = shuffleArray(otherQuestions);
            const remaining = count - selected.length;
            selected = [...selected, ...shuffledOther.slice(0, remaining)];
        }
    }
    
    // Shuffle answers within each question
    return selected.map(q => ({
        ...q,
        answers: shuffleArray([...q.answers])
    }));
};
