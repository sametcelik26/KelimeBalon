/**
 * game.js
 * Handles game loop, logic, modes, animations, and sound using Web Audio API. 
 */

const gameCanvas = document.getElementById('game-canvas');
const scoreEl = document.getElementById('game-score');
const multiEl = document.getElementById('game-multiplier');
const feedbackBanner = document.getElementById('feedback-banner');
const feedbackTitle = document.getElementById('feedback-title');
const feedbackText = document.getElementById('feedback-text');

// Global Hit Detection (Bypasses mobile WebKit bugs on animated elements)
gameCanvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (e.changedTouches && e.changedTouches.length > 0) {
        checkBubbleHits(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    }
}, {passive: false});

gameCanvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || e.pointerType === 'pen') {
        checkBubbleHits(e.clientX, e.clientY);
    }
});

function checkBubbleHits(x, y) {
    if (!gameState.isRunning || gameState.isPaused || gameState.isTransitioning) return;
    for (let i = gameState.activeBubbles.length - 1; i >= 0; i--) {
        const b = gameState.activeBubbles[i];
        if (b.classList.contains('popped')) continue;
        const rect = b.getBoundingClientRect();
        const pad = 15; // Generous mobile hitbox padding
        if (x >= rect.left - pad && x <= rect.right + pad && y >= rect.top - pad && y <= rect.bottom + pad) {
            handleBubbleClick(b.wordObj, b, x, y, b.colorString);
            break; 
        }
    }
}

const quizTargetContainer = document.getElementById('quiz-target-container');
const quizTargetWord = document.getElementById('quiz-target-word');
const btnReplayAudio = document.getElementById('btn-replay-audio');
const btnToggleSound = document.getElementById('btn-toggle-sound');

let aCtx = null;
let masterGain = null;
let isSoundEnabled = true;

// Global Audio Manager
window.GlobalAudioManager = {
    bgMusic: new window.Audio('https://cdn.pixabay.com/download/audio/2022/02/10/audio_fcdd720d2c.mp3'), // Sample BGM
    init: function() {
        try {
            this.bgMusic.loop = true;
            this.bgMusic.volume = 0.15;
            this.bgMusic.crossOrigin = 'anonymous';

            if (!aCtx) {
                aCtx = new (window.AudioContext || window.webkitAudioContext)();
                masterGain = aCtx.createGain();
                masterGain.connect(aCtx.destination);
                masterGain.gain.value = isSoundEnabled ? 0.5 : 0;
            }
            if (aCtx && aCtx.state === 'suspended') {
                aCtx.resume();
            }
            
            // Unlock Mobile Audio completely by playing a silent buffer
            const buffer = aCtx.createBuffer(1, 1, 22050);
            const source = aCtx.createBufferSource();
            source.buffer = buffer;
            source.connect(aCtx.destination);
            if (source.start) source.start(0);

            // Unlock SpeechSynthesis for iOS Safari async voice-overs
            if (window.speechSynthesis) {
                const emptyUtterance = new SpeechSynthesisUtterance('');
                emptyUtterance.volume = 0;
                window.speechSynthesis.speak(emptyUtterance);
            }

            this.playBGM();
        } catch (e) {
            console.warn("Audio Context not supported", e);
        }
    },
    playBGM: function() {
        if (isSoundEnabled && gameState.isRunning) {
            this.bgMusic.play().catch(e => console.log('BGM prevented:', e));
        }
    },
    stopBGM: function() {
        this.bgMusic.pause();
        this.bgMusic.currentTime = 0;
    },
    pauseBGM: function() {
        this.bgMusic.pause();
    },
    setMute: function(mute) {
        isSoundEnabled = !mute;
        btnToggleSound.innerText = isSoundEnabled ? '🔊' : '🔇';
        
        if (aCtx && aCtx.state === 'suspended' && !mute) {
            aCtx.resume();
        }

        if (mute) {
            this.pauseBGM();
            if (synthVoice) synthVoice.cancel();
            if (masterGain && aCtx) {
                masterGain.gain.setTargetAtTime(0, aCtx.currentTime, 0.05); // Smooth mute
            }
        } else {
            if (gameState.isRunning && !gameState.isPaused) {
                this.bgMusic.play().catch(e => {});
            }
            if (masterGain && aCtx) {
                masterGain.gain.setTargetAtTime(0.5, aCtx.currentTime, 0.05);
            }
        }
    }
};

// Global mobile audio unlock on interaction
['touchstart', 'pointerdown'].forEach(evt => {
    document.addEventListener(evt, () => {
        if (aCtx && aCtx.state === 'suspended') {
            aCtx.resume();
        }
        if (isSoundEnabled && gameState.isRunning && !gameState.isPaused && window.GlobalAudioManager.bgMusic.paused) {
            window.GlobalAudioManager.bgMusic.play().catch(() => {});
        }
    }, { passive: true, once: true });
});

btnToggleSound.onclick = () => {
    window.GlobalAudioManager.setMute(isSoundEnabled);
};

// Pre-initialize synth engine
function initAudioEngine() {
    window.GlobalAudioManager.init();
}

// Generate an ultra-satisfying bubble pop sound
function playPopSound(isCorrect = null) {
    if (!isSoundEnabled || !aCtx) return;
    try {
        const osc = aCtx.createOscillator();
        const gainNode = aCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(masterGain);

        // Core Pitch logic
        if (isCorrect === true) {
            osc.frequency.setValueAtTime(600, aCtx.currentTime); // Higher pitched, happy
            osc.frequency.exponentialRampToValueAtTime(1000, aCtx.currentTime + 0.1);
        } else if (isCorrect === false) {
            osc.frequency.setValueAtTime(300, aCtx.currentTime); // Lower pitched, sad
            osc.frequency.exponentialRampToValueAtTime(150, aCtx.currentTime + 0.2);
        } else {
            // Neutral Learn Mode Pop (water droplet style)
            osc.frequency.setValueAtTime(400, aCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(600, aCtx.currentTime + 0.05);
            osc.frequency.linearRampToValueAtTime(300, aCtx.currentTime + 0.15);
        }

        osc.type = 'sine';

        // Envelope: Attack and sharp decay
        gainNode.gain.setValueAtTime(0, aCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(1, aCtx.currentTime + 0.01);
        gainNode.gain.linearRampToValueAtTime(0.001, aCtx.currentTime + 0.15); // Fixed for Safari bugs

        osc.start(aCtx.currentTime);
        osc.stop(aCtx.currentTime + 0.2);
    } catch (e) { }
}

const synthVoice = window.speechSynthesis;
let currentSpokenWord = '';

function speakWord(text, langCode, onEndCallback = null) {
    if (!isSoundEnabled || !synthVoice) {
        if (onEndCallback) setTimeout(onEndCallback, 1000);
        return;
    }
    synthVoice.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    // langCode expected: 'en', 'fr', 'tr'
    if (langCode === 'en') utterance.lang = 'en-US';
    else if (langCode === 'fr') utterance.lang = 'fr-FR';
    else utterance.lang = 'tr-TR';

    utterance.rate = 0.9;
    utterance.pitch = 1.05; // Slightly playful pitch

    if (onEndCallback) {
        utterance.onend = onEndCallback;
        utterance.onerror = onEndCallback;
    }

    synthVoice.speak(utterance);
    currentSpokenWord = text;
}

btnReplayAudio.onclick = () => {
    if (currentSpokenWord) speakWord(currentSpokenWord, gameState.voiceLang);
}

// Particle System
function createParticles(x, y, colorStr) {
    for (let i = 0; i < 12; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.left = x + 'px';
        p.style.top = y + 'px';
        p.style.width = Math.random() * 8 + 4 + 'px';
        p.style.height = p.style.width;
        p.style.background = colorStr;
        p.style.boxShadow = `0 0 10px ${colorStr}`;
        gameCanvas.appendChild(p);

        const angle = Math.random() * Math.PI * 2;
        const velocity = 40 + Math.random() * 60;
        const tx = Math.cos(angle) * velocity;
        const ty = Math.sin(angle) * velocity;

        p.animate([
            { transform: 'translate(0,0) scale(1)', opacity: 1 },
            { transform: `translate(${tx}px, ${ty}px) scale(0)`, opacity: 0 }
        ], {
            duration: 400 + Math.random() * 300,
            easing: 'cubic-bezier(0, .9, .57, 1)'
        });

        setTimeout(() => { if (p.parentNode) p.remove() }, 700);
    }
}

// Game State
let gameState = {
    isRunning: false,
    isPaused: false,
    isTransitioning: false,
    mode: 'learn', // 'learn', 'quiz', 'listen'
    words: [],      // current dictionary pool
    voiceLang: 'en', // 'en' or 'fr'
    score: 0,
    combo: 0,
    activeBubbles: [],
    loopTimer: null,
    spawnInterval: 2000,
    currentQuizTarget: null, // word object
    currentRoundId: 0
};

function startGame(mode, wordsPool, targetLang) {
    if (wordsPool.length === 0) {
        alert("Not enough words in this category!");
        return;
    }

    gameState.mode = mode;
    gameState.words = wordsPool;
    gameState.voiceLang = targetLang;
    gameState.score = 0;
    gameState.combo = 0;
    gameState.isRunning = true;
    gameState.isPaused = false;
    gameState.isTransitioning = false;
    gameState.activeBubbles = [];

    updateScoreUI();
    initAudioEngine();

    gameCanvas.innerHTML = ''; // Clear canvas

    if (mode === 'quiz' || mode === 'listen') {
        quizTargetContainer.classList.remove('hidden');
        if (mode === 'listen') {
            btnReplayAudio.classList.remove('hidden');
        } else {
            btnReplayAudio.classList.add('hidden');
        }
        pickNewQuizTarget();
    } else {
        quizTargetContainer.classList.add('hidden');
        btnReplayAudio.classList.add('hidden');
    }

    // Start Loop
    spawnBubbleBurst();
    gameState.loopTimer = setInterval(spawnBubbleBurst, gameState.spawnInterval);
}

function togglePause() {
    gameState.isPaused = !gameState.isPaused;

    if (gameState.isPaused) {
        window.GlobalAudioManager.pauseBGM();
        clearInterval(gameState.loopTimer);
        document.querySelectorAll('.bubble').forEach(b => {
            b.getAnimations().forEach(a => a.pause());
        });
    } else {
        if (isSoundEnabled) window.GlobalAudioManager.bgMusic.play().catch(()=>{});
        document.querySelectorAll('.bubble').forEach(b => {
            b.getAnimations().forEach(a => a.play());
        });
        gameState.loopTimer = setInterval(spawnBubbleBurst, gameState.spawnInterval);
    }
    return gameState.isPaused;
}

function stopGame() {
    gameState.isRunning = false;
    gameState.isPaused = false;
    clearInterval(gameState.loopTimer);
    synthVoice.cancel(); // Stop any in-progress speech
    if (window.GlobalAudioManager) window.GlobalAudioManager.stopBGM();
    gameCanvas.innerHTML = '';
    gameState.activeBubbles = [];
    quizTargetContainer.classList.add('hidden');
}

function updateScoreUI() {
    scoreEl.innerText = `Score: ${gameState.score}`;
    multiEl.innerText = `x${Math.floor(gameState.combo / 3) + 1}`;
}

function pickNewQuizTarget() {
    if (!gameState.isRunning) return;
    gameState.isTransitioning = false;

    // Pick 3 random words for choices, one is correct
    const shuffled = [...gameState.words].sort(() => 0.5 - Math.random());
    const choices = shuffled.slice(0, 3);
    const correct = choices[Math.floor(Math.random() * 3)];

    gameState.currentQuizTarget = correct;
    gameState.currentRoundId = Date.now(); // Unique ID for this round

    const targetText = gameState.voiceLang === 'fr' && correct.fr ? correct.fr : correct.en;

    if (gameState.mode === 'quiz') {
        // Display Translation
        quizTargetWord.innerText = targetText;
    } else if (gameState.mode === 'listen') {
        quizTargetWord.innerText = "🔊 Listen...";
        let listenSpeakCount = 0;
        function playListenTwice() {
            listenSpeakCount++;
            if (listenSpeakCount === 1 && gameState.isRunning && !gameState.isTransitioning) {
                setTimeout(() => {
                    if (gameState.isRunning && !gameState.isTransitioning) {
                        speakWord(targetText, gameState.voiceLang);
                    }
                }, 2000);
            }
        }
        speakWord(targetText, gameState.voiceLang, playListenTwice);
    }

    // Spawn just these choices
    gameCanvas.innerHTML = '';
    gameState.activeBubbles = []; // Reset active array between rounds
    choices.forEach((w, index) => {
        // Distribute horizontally
        const xPos = 20 + (index * 30); // vw mapping: 20%, 50%, 80% roughly
        spawnSpecificBubble(w, xPos, gameState.currentRoundId);
    });
}

function getRandomColorPair() {
    const pairs = [
        ['#ff5fa2', '#ff4081'], // Pink
        ['#4facfe', '#00f2fe'], // Blue
        ['#43e97b', '#38f9d7'], // Green
        ['#fa709a', '#fee140'], // Sunset
        ['#c471ed', '#f64f59']  // Purple/Red
    ];
    return pairs[Math.floor(Math.random() * pairs.length)];
}

function spawnSpecificBubble(wordObj, xPosVW, roundId = 0) {
    if (!gameState.isRunning || gameState.isPaused) return;

    const colors = getRandomColorPair();
    const b = document.createElement('div');
    b.className = 'bubble';

    // Content determines by mode
    b.innerText = wordObj.tr; // Balloons are always Turkish

    // Initial Position (Bottom to Top)
    const size = 90 + Math.random() * 30; // 90 to 120px
    b.style.width = size + 'px';
    b.style.height = size + 'px';

    // For specific spawning in Quiz mode, we spawn at bottom and float up slowly
    b.style.left = `calc(${xPosVW}vw - ${size / 2}px)`;
    b.style.top = `${window.innerHeight + 50}px`; // Off-screen bottom
    b.style.background = `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`;

    gameCanvas.appendChild(b);
    gameState.activeBubbles.push(b);

    // Calculate animation
    const duration = 12000 - (Math.random() * 3000); // 9-12 seconds

    // Slight horizontal drift via transform
    const drift = (Math.random() - 0.5) * 100;

    b.animate([
        { transform: `translate3d(0, 0, 0)` },
        { transform: `translate3d(${drift}px, -${window.innerHeight + 200}px, 0)` }
    ], {
        duration: duration,
        easing: 'linear',
        fill: 'forwards'
    });

    // Interaction properties stored for global hit detection
    b.wordObj = wordObj;
    b.colorString = colors[1];

    // Remove if went off screen
    setTimeout(() => {
        if (!b.parentNode || !gameState.isRunning) return;
        if (gameState.mode !== 'learn' && roundId !== gameState.currentRoundId) return; // Prevent ghost timeouts from older rounds

        // Prevent off-screen penalty if bubble was already correctly clicked and is celebrating!
        if (b.classList.contains('popped') || b.classList.contains('bubble--correct')) {
            return;
        }

        const idx = gameState.activeBubbles.indexOf(b);
        if (idx > -1) gameState.activeBubbles.splice(idx, 1);
        b.remove();
        
        if (gameState.mode !== 'learn' && wordObj.en === gameState.currentQuizTarget?.en && !gameState.isTransitioning) {
            // Player truly missed the correct bubble!
            handleMissTarget();
        }
    }, duration);
}

function spawnBubbleBurst() {
    if (!gameState.isRunning || gameState.isPaused) return;

    if (gameState.mode === 'quiz' || gameState.mode === 'listen') {
        // In Quiz/Listen mode, spawn logic is handled sequentially by pickNewQuizTarget.
        // The Burst loops check if canvas is empty.
        if (gameCanvas.children.length === 0) {
            pickNewQuizTarget();
        }
        return;
    }

    // Learn Mode: Continuous flow of random words
    const count = 1 + Math.floor(Math.random() * 2); // 1-2 bubbles
    for (let i = 0; i < count; i++) {
        const randomWord = gameState.words[Math.floor(Math.random() * gameState.words.length)];
        const vw = 10 + Math.random() * 80;
        spawnSpecificBubble(randomWord, vw);
    }
}

function popVisuals(element, x, y, particleColor) {
    element.classList.add('popped');
    
    // Automatically remove from active bounds array for performance
    const idx = gameState.activeBubbles.indexOf(element);
    if (idx > -1) gameState.activeBubbles.splice(idx, 1);
    
    createParticles(x, y, particleColor);
    setTimeout(() => { if (element.parentNode) element.remove(); }, 200);
}

function showFeedbackBanner(title, desc, isCorrect) {
    feedbackTitle.innerText = title;
    feedbackText.innerText = desc;
    feedbackBanner.className = isCorrect ? 'correct show' : 'wrong show';

    setTimeout(() => {
        feedbackBanner.classList.remove('show');
    }, 2000);
}

function handleMissTarget() {
    gameState.combo = 0;
    gameState.score = Math.max(0, gameState.score - 5);
    updateScoreUI();
    const correctW = gameState.currentQuizTarget;
    window.progressSystem.recordWordResult(correctW.en, false);

    playPopSound(false);

    const targetText = gameState.voiceLang === 'fr' && correctW.fr ? correctW.fr : correctW.en;
    showFeedbackBanner("Missed it!", `${correctW.tr} = ${targetText}`, false);

    pickNewQuizTarget();
}

function handleBubbleClick(wordObj, bubbleElement, clientX, clientY, colorString) {
    if (gameState.isPaused || gameState.isTransitioning || bubbleElement.classList.contains('popped')) return;

    const rect = bubbleElement.getBoundingClientRect();
    const cX = rect.left + rect.width / 2;
    const cY = rect.top + rect.height / 2;

    const targetText = gameState.voiceLang === 'fr' && wordObj.fr ? wordObj.fr : wordObj.en;

    if (gameState.mode === 'learn') {
        popVisuals(bubbleElement, cX, cY, colorString);
        playPopSound(null);
        showFeedbackBanner(wordObj.tr, targetText, true);
        speakWord(targetText, gameState.voiceLang);

        gameState.score += 1;
        updateScoreUI();

    } else {
        // Quiz or Listen Mode Checking
        if (wordObj.en === gameState.currentQuizTarget.en) {
            // Correct!
            gameState.isTransitioning = true;
            playPopSound(true);
            gameState.combo++;
            const multi = Math.floor(gameState.combo / 3) + 1;
            gameState.score += (10 * multi);
            updateScoreUI();

            window.progressSystem.recordWordResult(wordObj.en, true);
            showFeedbackBanner("Correct! 🌟", `${wordObj.tr} = ${targetText}`, true);

            // Pop all other bubbles
            document.querySelectorAll('.bubble').forEach(b => {
                if (b !== bubbleElement) {
                    const r = b.getBoundingClientRect();
                    popVisuals(b, r.left + r.width / 2, r.top + r.height / 2, '#fff');
                }
            });

            // Mark correct bubble visually with CSS class
            bubbleElement.classList.add('bubble--correct');
            bubbleElement.getAnimations().forEach(anim => anim.pause());

            let speakCount = 0;
            function playTwiceAndPop() {
                speakCount++;
                if (speakCount <= 2 && gameState.isRunning) {
                    if (speakCount === 1) {
                        setTimeout(() => speakWord(targetText, gameState.voiceLang, playTwiceAndPop), 300);
                    } else {
                        setTimeout(() => speakWord(targetText, gameState.voiceLang, playTwiceAndPop), 2000);
                    }
                } else {
                    if (gameState.isRunning) {
                        const r = bubbleElement.getBoundingClientRect();
                        popVisuals(bubbleElement, r.left + r.width / 2, r.top + r.height / 2, '#fff');
                        pickNewQuizTarget();
                    }
                }
            }
            playTwiceAndPop();

        } else {
            // Incorrect — pop the wrong bubble only, don't end round
            popVisuals(bubbleElement, cX, cY, colorString);
            playPopSound(false);
            gameState.combo = 0;
            gameState.score = Math.max(0, gameState.score - 5);
            updateScoreUI();
            window.progressSystem.recordWordResult(gameState.currentQuizTarget.en, false);

            const correctTarget = gameState.currentQuizTarget;
            const correctText = gameState.voiceLang === 'fr' && correctTarget.fr ? correctTarget.fr : correctTarget.en;
            showFeedbackBanner('Wrong! ❌', `${wordObj.tr} ≠ ${correctText}`, false);
        }
    }
}

// Global Export
window.gameEngine = {
    startGame,
    stopGame,
    togglePause
};
