/**
 * main.js
 * App Initialization and UI Controller
 */

// UI Elements
const screenAuth = document.getElementById('auth-screen');
const screenDash = document.getElementById('dashboard-screen');
const screenGame = document.getElementById('game-screen');

const formAuth = document.getElementById('auth-form');
const inputEmail = document.getElementById('email');
const inputPass = document.getElementById('password');
const inputUser = document.getElementById('username');
const groupUser = document.getElementById('username-group');
const btnAuthSubmit = document.getElementById('auth-submit-btn');

const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const btnGoogle = document.getElementById('btn-google-login');
const btnLogout = document.getElementById('btn-logout');

const dashUsername = document.getElementById('dash-username');
const dashLevelTxt = document.getElementById('dash-level-text');
const statLearned = document.getElementById('stat-learned');
const statStreak = document.getElementById('stat-streak');
const statAccuracy = document.getElementById('stat-accuracy');

const selectLevel = document.getElementById('select-level');
const selectCat = document.getElementById('select-category');
const selectLang = document.getElementById('select-lang');
const modeCards = document.querySelectorAll('.mode-card');
const btnStartGame = document.getElementById('btn-start-game');
const btnQuitGame = document.getElementById('btn-quit-game');
const btnPauseGame = document.getElementById('btn-pause-game');

let currentAuthMode = 'login'; // 'login' or 'register'
let selectedGameMode = 'learn';

// Show/hide loading overlay
function setLoading(active) {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.toggle('hidden', !active);
}

// Inline error display in auth form
function showAuthError(msg) {
    let el = document.getElementById('auth-error');
    if (!el) {
        el = document.createElement('p');
        el.id = 'auth-error';
        el.className = 'auth-error-msg';
        formAuth.insertBefore(el, formAuth.firstChild);
    }
    el.textContent = msg;
    el.style.display = msg ? 'block' : 'none';
}

function clearAuthError() { showAuthError(''); }

// Initialize App
async function initApp() {
    setLoading(true);
    const isDataLoaded = await window.vocabData.loadData();
    setLoading(false);
    if (!isDataLoaded) {
        showAuthError('Failed to load vocabulary data. Please refresh.');
        return;
    }

    // Populate Categories
    const categories = window.vocabData.getCategories();
    categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.innerText = cat;
        selectCat.appendChild(opt);
    });
    // Add Difficult pseudo-category
    const diffOpt = document.createElement('option');
    diffOpt.value = 'Difficult';
    diffOpt.innerText = 'Review Difficult Words';
    selectCat.appendChild(diffOpt);

    // Check Auth
    window.authSystem.initAuth();
    if (window.authSystem.getCurrentUser()) {
        showDashboard();
    } else {
        showScreen(screenAuth);
    }
}

// Navigation
function showScreen(screenEl) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    screenEl.classList.add('active');
}

function showDashboard() {
    const user = window.authSystem.getCurrentUser();
    window.progressSystem.initProgress(user.email);

    dashUsername.innerText = user.username;

    updateDashboardStats();
    showScreen(screenDash);
}

function updateDashboardStats() {
    const stats = window.progressSystem.getStats();
    statLearned.innerText = stats.learnedWords;
    statStreak.innerText = stats.streak + ' 🔥';
    statAccuracy.innerText = stats.accuracy + '%';
    dashLevelTxt.innerText = `Level: ${selectLevel.value}`;
}

selectLevel.addEventListener('change', () => {
    dashLevelTxt.innerText = `Level: ${selectLevel.value}`;
});

// Auth Listeners
tabLogin.onclick = () => {
    currentAuthMode = 'login';
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    groupUser.style.display = 'none';
    btnAuthSubmit.innerText = 'Login';
};

tabRegister.onclick = () => {
    currentAuthMode = 'register';
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    groupUser.style.display = 'flex';
    inputUser.required = true;
    btnAuthSubmit.innerText = 'Register';
};

formAuth.onsubmit = (e) => {
    e.preventDefault();
    clearAuthError();
    const email = inputEmail.value;
    const pass = inputPass.value;

    if (currentAuthMode === 'login') {
        const result = window.authSystem.loginUser(email, pass);
        if (result.success) {
            showDashboard();
        } else {
            showAuthError(result.error);
        }
    } else {
        const user = inputUser.value || email.split('@')[0];
        const result = window.authSystem.registerUser(user, email, pass);
        if (result.success) {
            showDashboard();
        } else {
            showAuthError(result.error);
        }
    }
};

btnGoogle.onclick = () => {
    window.authSystem.mockGoogleLogin();
    showDashboard();
};

btnLogout.onclick = () => {
    window.authSystem.logout();
    inputEmail.value = '';
    inputPass.value = '';
    showScreen(screenAuth);
};

// Dashboard Interaction
modeCards.forEach(card => {
    card.onclick = () => {
        modeCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedGameMode = card.dataset.mode;
    };
});

btnStartGame.onclick = () => {
    const lvl = selectLevel.value;
    const cat = selectCat.value;
    const lang = selectLang.value;

    const wordsPool = window.vocabData.getWords(lvl, cat);
    if (cat === 'Difficult' && wordsPool.length < 5) {
        // Show a gentle toast instead of an alert
        showToast('Not enough difficult words yet. Try Learn Mode first! 📚');
        return;
    }

    showScreen(screenGame);
    btnPauseGame.innerText = '⏸ Pause';
    window.gameEngine.startGame(selectedGameMode, wordsPool, lang);
};

btnPauseGame.onclick = () => {
    const isPaused = window.gameEngine.togglePause();
    btnPauseGame.innerText = isPaused ? '▶ Resume' : '⏸ Pause';
};

btnQuitGame.onclick = () => {
    window.gameEngine.stopGame();
    updateDashboardStats();
    showScreen(screenDash);
};

// Simple toast for non-blocking messages
function showToast(msg) {
    let t = document.getElementById('dash-toast');
    if (!t) {
        t = document.createElement('div');
        t.id = 'dash-toast';
        t.className = 'dash-toast';
        document.getElementById('dashboard-screen').appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

// Start Everything
window.onload = initApp;
