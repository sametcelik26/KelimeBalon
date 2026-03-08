/**
 * auth.js
 * Manages user registration, login, and mock Google authentication via LocalStorage.
 */

const AUTH_KEY = 'vocab_users_db';
const SESSION_KEY = 'vocab_current_user';

let usersDB = {};
let currentUser = null;

function initAuth() {
    // Load local DB
    const savedDb = localStorage.getItem(AUTH_KEY);
    if (savedDb) {
        usersDB = JSON.parse(savedDb);
    }

    // Check if user already logged in
    const session = localStorage.getItem(SESSION_KEY);
    if (session) {
        currentUser = JSON.parse(session);
        return true; // Is logged in
    }
    return false; // Not logged in
}

function saveDB() {
    localStorage.setItem(AUTH_KEY, JSON.stringify(usersDB));
}

function updateSession(user) {
    currentUser = user;
    localStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));
}

function registerUser(username, email, password) {
    if (usersDB[email]) {
        return { success: false, error: 'Email already registered!' };
    }

    const newUser = {
        username: username,
        email: email,
        password: password, // Note: In a real app never store plaintext! Here it's a mock local DB.
        createdAt: new Date().toISOString()
    };

    usersDB[email] = newUser;
    saveDB();
    updateSession(newUser);
    return { success: true };
}

function loginUser(email, password) {
    const user = usersDB[email];
    if (user && user.password === password) {
        updateSession(user);
        return { success: true };
    }
    return { success: false, error: 'Invalid email or password.' };
}

function mockGoogleLogin() {
    // Simulate a Google OAuth flow returning an email & name
    const mockEmail = "student@google.mock";
    const mockName = "Google Student";

    if (!usersDB[mockEmail]) {
        const newUser = {
            username: mockName,
            email: mockEmail,
            password: "oauth_mock_password",
            createdAt: new Date().toISOString()
        };
        usersDB[mockEmail] = newUser;
        saveDB();
    }

    updateSession(usersDB[mockEmail]);
    return true;
}

function logout() {
    currentUser = null;
    localStorage.removeItem(SESSION_KEY);
}

function getCurrentUser() {
    return currentUser;
}

// Window global exports
window.authSystem = {
    initAuth,
    registerUser,
    loginUser,
    mockGoogleLogin,
    logout,
    getCurrentUser
};
