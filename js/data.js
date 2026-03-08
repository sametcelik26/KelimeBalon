/**
 * data.js
 * Handles fetching, parsing, and dynamic categorization of vocabulary data.
 */

const DATA_URL = 'words_7000.json';
const CACHE_KEY = 'vocab_data_cache';
let vocabsByLevel = {}; // { 'A1': [...], 'A2': [...] }
let vocabsByCategory = {}; // { 'All': [...], 'Food': [...], 'Travel': [...] }

// Predefined categorization keywords (naive but effective heuristic)
const CATEGORY_KEYWORDS = {
    'Food & Drinks': ['apple', 'water', 'bread', 'beef', 'beer', 'butter', 'cake', 'candy', 'cheese', 'chicken', 'coffee', 'corn', 'cream', 'dinner', 'drink', 'eat', 'egg', 'fish', 'food', 'fruit', 'juice', 'kitchen'],
    'Travel & Places': ['airport', 'beach', 'boat', 'bus', 'car', 'city', 'coast', 'country', 'district', 'flight', 'forest', 'ground', 'hill', 'hotel', 'island', 'journey', 'street', 'train', 'travel', 'trip', 'world'],
    'People & Family': ['actor', 'actress', 'adult', 'aunt', 'baby', 'boy', 'brother', 'child', 'children', 'cousin', 'dad', 'daughter', 'family', 'father', 'female', 'friend', 'girl', 'grandfather', 'grandmother', 'guy', 'husband', 'kid', 'king', 'man', 'mother', 'parent', 'person', 'sister', 'son', 'wife', 'woman'],
    'Body & Health': ['arm', 'bath', 'blood', 'body', 'bone', 'brain', 'breath', 'breathe', 'cheek', 'chest', 'cough', 'cure', 'dentist', 'die', 'disease', 'doctor', 'ear', 'eye', 'face', 'finger', 'foot', 'hair', 'hand', 'head', 'health', 'heart', 'ill', 'illness', 'injure', 'injury', 'knee', 'leg', 'lip', 'medicine', 'mouth', 'neck', 'nose', 'patient', 'shoulder', 'sick', 'skin', 'stomach', 'teeth', 'throat', 'toe', 'tooth'],
    'Time & Dates': ['afternoon', 'age', 'april', 'august', 'autumn', 'century', 'date', 'day', 'december', 'early', 'evening', 'february', 'friday', 'future', 'hour', 'january', 'july', 'june', 'late', 'march', 'may', 'minute', 'monday', 'month', 'morning', 'night', 'november', 'october', 'saturday', 'season', 'second', 'september', 'spring', 'summer', 'sunday', 'thursday', 'time', 'today', 'tomorrow', 'tuesday', 'wednesday', 'week', 'weekend', 'winter', 'year', 'yesterday'],
    'Nature & Animals': ['animal', 'bear', 'bee', 'bird', 'cat', 'cloud', 'coal', 'cow', 'dog', 'duck', 'earth', 'elephant', 'fire', 'fish', 'flower', 'forest', 'grass', 'horse', 'ice', 'insect', 'island', 'moon', 'nature', 'ocean', 'plant', 'rain', 'river', 'rock', 'sea', 'sky', 'snow', 'space', 'star', 'sun', 'tree', 'water', 'wind', 'wood'],
    'Work & Education': ['actress', 'actor', 'artist', 'author', 'boss', 'business', 'class', 'classroom', 'clerk', 'coach', 'college', 'company', 'course', 'dentist', 'department', 'design', 'desk', 'director', 'doctor', 'educate', 'education', 'effort', 'employ', 'engineer', 'expert', 'factory', 'farmer', 'firm', 'goal', 'history', 'homework', 'industry', 'job', 'journalist', 'judge', 'lawyer', 'learn', 'lesson', 'manager', 'math', 'meeting', 'nurse', 'office', 'pilot', 'police', 'president', 'professor', 'project', 'read', 'school', 'science', 'scientist', 'secretary', 'student', 'study', 'teacher', 'university', 'work', 'worker', 'writer'],
    'Emotions & States': ['afraid', 'anger', 'angry', 'awful', 'bad', 'beautiful', 'blind', 'brave', 'busy', 'careful', 'careless', 'clean', 'clever', 'cold', 'comfortable', 'cool', 'crazy', 'cruel', 'curious', 'dark', 'dead', 'dear', 'deep', 'difficult', 'dirty', 'dry', 'easy', 'empty', 'excellent', 'expensive', 'fair', 'familiar', 'famous', 'fast', 'fat', 'feeling', 'fine', 'flat', 'free', 'fresh', 'friendly', 'fun', 'funny', 'gentle', 'glad', 'good', 'grateful', 'great', 'guilty', 'happy', 'hard', 'heavy', 'high', 'honest', 'hot', 'huge', 'hungry', 'ill', 'important', 'innocent', 'interesting', 'joy', 'kind', 'lazy', 'light', 'lonely', 'loud', 'low', 'lucky', 'mad', 'nervous', 'nice', 'old', 'patient', 'poor', 'popular', 'proud', 'quiet', 'ready', 'real', 'rich', 'sad', 'safe', 'secret', 'serious', 'sharp', 'short', 'shy', 'sick', 'slow', 'small', 'smart', 'soft', 'sorry', 'special', 'strange', 'strong', 'stupid', 'sure', 'surprise', 'sweet', 'tall', 'terrible', 'thick', 'thin', 'thirsty', 'tired', 'tough', 'true', 'ugly', 'warm', 'weak', 'wet', 'wide', 'wild', 'wise', 'wrong', 'young']
};

/**
 * Initializes and fetches the dataset.
 */
async function loadData() {
    try {
        // Try sessionStorage cache first to avoid re-fetching 784KB on every load
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
            vocabsByLevel = JSON.parse(cached);
        } else {
            const response = await fetch(DATA_URL);
            if (!response.ok) throw new Error('Could not fetch words data.');
            vocabsByLevel = await response.json();
            sessionStorage.setItem(CACHE_KEY, JSON.stringify(vocabsByLevel));
        }
        buildCategories();
        return true;
    } catch (error) {
        console.error('Failed to load data:', error);
        return false;
    }
}

/**
 * Categorize words based on heuristic keywords to create dynamic categories.
 */
function buildCategories() {
    vocabsByCategory = { 'All': [] };
    
    // Initialize empty category arrays
    Object.keys(CATEGORY_KEYWORDS).forEach(cat => {
        vocabsByCategory[cat] = [];
    });
    vocabsByCategory['General'] = [];

    // Process all words from all levels
    Object.keys(vocabsByLevel).forEach(level => {
        vocabsByLevel[level].forEach(wordObj => {
            const enWord = wordObj.en.toLowerCase();
            wordObj.level = level; // Inject level into the object
            
            vocabsByCategory['All'].push(wordObj);
            
            let matchedCategory = false;
            
            for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
                if (keywords.includes(enWord)) {
                    vocabsByCategory[category].push(wordObj);
                    matchedCategory = true;
                    break;
                }
            }
            
            if (!matchedCategory) {
                vocabsByCategory['General'].push(wordObj);
            }
        });
    });
    
    // Clean up empty categories
    Object.keys(vocabsByCategory).forEach(cat => {
        if (vocabsByCategory[cat].length === 0) {
            delete vocabsByCategory[cat];
        }
    });
}

/**
 * Gets a subset of words filtered by level and category
 */
function getWords(level, category) {
    if (!vocabsByCategory[category] && category !== 'Difficult') category = 'All';
    let words = [];

    if (category === 'Difficult') {
        const diffWordsEn = window.progressSystem.getDifficultWords();
        words = vocabsByCategory['All'].filter(w => diffWordsEn.includes(w.en));
    } else {
        words = vocabsByCategory[category].filter(w => w.level === level);
    }
    
    // Fallback if combination has too few words
    if (words.length < 10) {
        console.warn(`Not enough words in ${level} - ${category}. Falling back to Level All.`);
        words = vocabsByLevel[level] || vocabsByCategory['All'];
    }
    
    return words;
}

// Ensure globally accessible
window.vocabData = {
    loadData,
    getWords,
    getCategories: () => Object.keys(vocabsByCategory).filter(k => k !== 'All' && k !== 'General') // Get main ones
};
