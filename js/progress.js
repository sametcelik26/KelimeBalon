/**
 * progress.js
 * Tracks user statistics, spaced repetition of difficult words, and learning streaks.
 */

const PROGRESS_KEY_PREFIX = 'vocab_progress_';

let userProgress = {
    learnedWords: {}, // { 'apple': { seen: 5, correct: 4, incorrect: 1, lastSeen: timestamp } }
    streak: { current: 0, lastActiveDate: null },
    totalCorrect: 0,
    totalAnswered: 0
};

let currentUserEmail = null;

function initProgress(email) {
    currentUserEmail = email;
    const key = PROGRESS_KEY_PREFIX + email;
    const saved = localStorage.getItem(key);

    if (saved) {
        userProgress = JSON.parse(saved);
        checkStreak();
    } else {
        // Reset
        userProgress = {
            learnedWords: {},
            streak: { current: 0, lastActiveDate: null },
            totalCorrect: 0,
            totalAnswered: 0
        };
        saveProgress();
    }
}

function saveProgress() {
    if (!currentUserEmail) return;
    const key = PROGRESS_KEY_PREFIX + currentUserEmail;
    localStorage.setItem(key, JSON.stringify(userProgress));
}

function getTodayString() {
    return new Date().toISOString().split('T')[0];
}

function checkStreak() {
    const today = getTodayString();
    const lastActive = userProgress.streak.lastActiveDate;

    if (!lastActive) return;

    // Compare using date strings (YYYY-MM-DD) to avoid floating-point day math bugs
    const todayDate = new Date(today);
    const lastDate = new Date(lastActive);
    const diffDays = Math.round((todayDate - lastDate) / (1000 * 60 * 60 * 24));

    if (diffDays > 1) {
        // Streak broken — more than one day missed
        userProgress.streak.current = 0;
    }
    saveProgress();
}

function recordActivity() {
    const today = getTodayString();
    if (userProgress.streak.lastActiveDate !== today) {
        userProgress.streak.current += 1;
        userProgress.streak.lastActiveDate = today;
        saveProgress();
    }
}

function recordWordResult(enWord, isCorrect) {
    if (!userProgress.learnedWords[enWord]) {
        userProgress.learnedWords[enWord] = { seen: 0, correct: 0, incorrect: 0, lastSeen: 0 };
    }

    const w = userProgress.learnedWords[enWord];
    w.seen++;
    w.lastSeen = Date.now();

    if (isCorrect) {
        w.correct++;
        userProgress.totalCorrect++;
    } else {
        w.incorrect++;
    }

    userProgress.totalAnswered++;
    recordActivity();
    saveProgress();
}

function getDifficultWords() {
    // A word is difficult if it has been seen and incorrect >= correct
    const difficult = [];
    for (const [word, data] of Object.entries(userProgress.learnedWords)) {
        if (data.incorrect > 0 && data.incorrect >= data.correct / 2) {
            difficult.push(word);
        }
    }
    return difficult;
}

function getStats() {
    const learnedCount = Object.keys(userProgress.learnedWords).filter(k => userProgress.learnedWords[k].correct > 0).length;
    let accuracy = 0;
    if (userProgress.totalAnswered > 0) {
        accuracy = Math.round((userProgress.totalCorrect / userProgress.totalAnswered) * 100);
    }

    return {
        learnedWords: learnedCount,
        streak: userProgress.streak.current,
        accuracy: accuracy
    };
}

window.progressSystem = {
    initProgress,
    recordWordResult,
    getStats,
    getDifficultWords
};
