// app.js
// Hoofdlogica voor het Grillworstje 3D spel.

import { wordList } from './words.js';
import { englishWordList } from './words_en.js';
import { 
  initThreeScene, 
  disposeThreeScene,
  updateCameraPosition,
  startVictoryAnimation,
  stopVictoryAnimation,
  highlightPlatform,
  spawnConfetti,
  animateJump,
  animateCorrect,
  animateWrong,
  resetGrillworstje,
  resetPlatforms
} from './threeScene.js';

let gameState = {
  currentIndex: 0,
  score: 0,
  lives: 3,
  shuffledWords: [],
  currentOptions: [],
  correctIndex: -1,
  currentList: [],
  listName: '',
  gameMode: 'word',
  isAnimating: false,
  isWrongAnswerShown: false,
  totalQuestions: 15
};

const startScreen = document.getElementById('start-screen');
const testButtons = document.getElementById('test-buttons');
const modeSelection = document.getElementById('mode-selection');
const selectedListName = document.getElementById('selected-list-name');
const gameScreen = document.getElementById('game-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const feedback = document.getElementById('feedback');
const wordDisplay = document.getElementById('word-display');
const scoreDisplay = document.getElementById('score');
const livesDisplay = document.getElementById('lives');
const modeIndicator = document.getElementById('mode-indicator');
const threeContainer = document.getElementById('three-container');
const answerCards = document.querySelectorAll('.answer-card');
const victoryOverlay = document.getElementById('victory-overlay');
const victoryStats = document.getElementById('victory-stats');
const endTitle = document.getElementById('end-title');

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function showFeedback(message, duration = 1500) {
  feedback.textContent = message;
  feedback.classList.remove('hidden');
  feedback.style.display = 'block';
  
  setTimeout(() => {
    feedback.classList.add('hidden');
    feedback.style.display = '';
  }, duration);
}

function updateAnswerCards(options) {
  answerCards.forEach((card, index) => {
    const textElement = card.querySelector('.card-text');
    if (textElement && options[index]) {
      textElement.textContent = options[index];
    }
    card.classList.remove('selected', 'correct', 'wrong');
  });
}

function updatePlatformLabels() {
  const labels = ['A', 'B', 'C', 'D'];
  if (globalThis.threeSceneInstance) {
    // Update platform labels with A/B/C/D
    globalThis.threeSceneInstance.platformLabels.forEach((labelSprite, index) => {
      if (labelSprite && globalThis.threeSceneInstance.updateTextSprite) {
        globalThis.threeSceneInstance.updateTextSprite(labelSprite, labels[index]);
      }
    });
    
    // Also update platform labels with answer options
    if (gameState.currentOptions && gameState.currentOptions.length > 0) {
      gameState.currentOptions.forEach((option, index) => {
        if (index < globalThis.threeSceneInstance.platformLabels.length) {
          // For now, just show A/B/C/D, but we could show short versions of answers
          // globalThis.threeSceneInstance.updateTextSprite(
          //   globalThis.threeSceneInstance.platformLabels[index],
          //   labels[index] + ': ' + (option.substring(0, 10) + '...')
          // );
        }
      });
    }
  }
}

function highlightCard(index, type) {
  answerCards.forEach((card, i) => {
    card.classList.remove('selected', 'correct', 'wrong');
    if (i === index) {
      card.classList.add(type);
    }
  });
}

function resetAnswerCards() {
  answerCards.forEach(card => {
    card.classList.remove('selected', 'correct', 'wrong');
  });
}

// ============================================================================
// GAME INITIALISATIE
// ============================================================================

function initGame() {
  gameState.currentIndex = 0;
  gameState.score = 0;
  gameState.lives = 3;
  gameState.isAnimating = false;
  gameState.isWrongAnswerShown = false;
  
  if (!gameState.currentList || gameState.currentList.length === 0) {
    console.error('Geen woordenlijst beschikbaar!');
    return;
  }
  
  const availableWords = shuffleArray([...gameState.currentList]);
  gameState.shuffledWords = availableWords.slice(0, gameState.totalQuestions);
  
  resetPlatforms();
  resetGrillworstje();
  resetAnswerCards();
  
  loadNextQuestion();
  updateUI();
  
  // Play intro sound
  AudioManager.playIntro();
}

function loadNextQuestion() {
  if (!gameState.currentList || gameState.currentList.length === 0) {
    return;
  }
  
  // Check victory condition after each question
  if (checkVictoryCondition()) {
    levelComplete();
    return;
  }
  
  if (gameState.currentIndex >= gameState.shuffledWords.length) {
    levelComplete();
    return;
  }
  
  const currentWord = gameState.shuffledWords[gameState.currentIndex];
  
  let options = [];
  let correctAnswer = '';
  
  if (gameState.gameMode === 'word') {
    correctAnswer = currentWord.correct;
    const otherMeanings = gameState.currentList
      .filter(w => w.word !== currentWord.word)
      .map(w => w.correct);
    const shuffledMeanings = shuffleArray(otherMeanings);
    const wrongOptions = shuffledMeanings.slice(0, 3);
    options = [correctAnswer, ...wrongOptions];
  } else {
    correctAnswer = currentWord.word;
    const otherWords = gameState.currentList
      .filter(w => w.word !== currentWord.word)
      .map(w => w.word);
    const shuffledWords = shuffleArray(otherWords);
    const wrongOptions = shuffledWords.slice(0, 3);
    options = [correctAnswer, ...wrongOptions];
  }
  
  gameState.currentOptions = shuffleArray(options);
  gameState.correctIndex = gameState.currentOptions.indexOf(correctAnswer);
  
  renderQuestion(currentWord);
}

function renderQuestion(currentWord) {
  // Random camera hoek per vraag
  updateCameraPosition(gameState.currentIndex);
  
  if (gameState.gameMode === 'word') {
    wordDisplay.textContent = currentWord.word;
    if (modeIndicator) modeIndicator.textContent = 'Kies de juiste betekenis:';
  } else {
    wordDisplay.textContent = currentWord.correct;
    if (modeIndicator) modeIndicator.textContent = 'Kies het juiste woord:';
  }
  
  updateAnswerCards(gameState.currentOptions);
  updatePlatformLabels();
  resetPlatforms();
  resetGrillworstje();
  gameState.isAnimating = false;
  gameState.isWrongAnswerShown = false;
}

function updateUI() {
  scoreDisplay.textContent = `Score: ${gameState.score}`;
  livesDisplay.textContent = `Levens: ${'❤️'.repeat(Math.max(0, gameState.lives))}`;
  
  if (gameState.lives <= 0) {
    gameOver();
  }
}

// ============================================================================
// AUDIO MANAGER - Simpele Web Audio API voor sound effects
// ============================================================================

// AudioContext resume handler - defined separately so it can be removed
const resumeAudioHandler = (event) => {
  event.preventDefault(); // Prevent default behavior
  
  if (AudioManager.ctx && AudioManager.ctx.state === 'suspended') {
    AudioManager.ctx.resume().then(() => {
      console.log('AudioContext resumed on user interaction');
    }).catch(err => {
      console.error('Failed to resume AudioContext:', err);
    });
  }
  
  // Remove listeners after first interaction to prevent multiple calls
  document.removeEventListener('touchstart', resumeAudioHandler);
  document.removeEventListener('mousedown', resumeAudioHandler);
  document.removeEventListener('keydown', resumeAudioHandler);
};

// Audio Manager for MP3 sound effects
const AudioManager = {
  ctx: null,
  initialized: false,
  audioCache: {},

  init() {
    if (this.initialized) return;
    
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.initialized = true;
      
      // iOS Safari requires explicit resume after user interaction
      // Add one-time listener to resume on first interaction
      document.addEventListener('touchstart', resumeAudioHandler, { passive: true });
      document.addEventListener('mousedown', resumeAudioHandler, { passive: true });
      document.addEventListener('keydown', resumeAudioHandler, { passive: true });
      
    } catch (e) {
      console.error('Web Audio API not supported:', e);
    }
  },
  
  ensureContext() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },
  
  // Load and cache audio files
  loadAudioFile(name, url) {
    return new Promise((resolve, reject) => {
      if (this.audioCache[name]) {
        resolve(this.audioCache[name]);
        return;
      }
      
      // Ensure audio context is initialized
      this.init();
      
      if (!this.ctx) {
        console.error('AudioContext not available');
        reject(new Error('AudioContext not available'));
        return;
      }
      
      const request = new XMLHttpRequest();
      request.open('GET', url, true);
      request.responseType = 'arraybuffer';
      
      request.onload = () => {
        if (request.status !== 200) {
          console.error('Failed to load audio file, status:', request.status);
          reject(new Error('Failed to load audio file'));
          return;
        }
        
        this.ctx.decodeAudioData(request.response, (buffer) => {
          this.audioCache[name] = buffer;
          resolve(buffer);
        }, (error) => {
          console.error('Error decoding audio data:', error);
          reject(error);
        });
      };
      
      request.onerror = () => {
        console.error('Error loading audio file:', url);
        reject(new Error('Failed to load audio file'));
      };
      
      request.send();
    });
  },
  
  // Play cached audio buffer
  playAudio(name) {
    this.ensureContext();
    if (!this.ctx || !this.audioCache[name]) return;
    
    try {
      const source = this.ctx.createBufferSource();
      source.buffer = this.audioCache[name];
      
      const gainNode = this.ctx.createGain();
      gainNode.gain.value = 0.5; // Volume control
      
      source.connect(gainNode);
      gainNode.connect(this.ctx.destination);
      
      source.start(0);
    } catch (e) {
      console.error('Error playing audio:', e);
    }
  },
  
  // Preload all audio files
  preloadAudioFiles() {
    const audioFiles = [
      { name: 'fx_good', url: 'assets/fx_good.mp3' },
      { name: 'fx_intro', url: 'assets/fx_intro.mp3' },
      { name: 'fx_oof', url: 'assets/fx_oof.mp3' },
      { name: 'fx_lose', url: 'assets/fx_lose.mp3' },
      { name: 'fx_win', url: 'assets/fx_win.mp3' }
    ];
    
    return Promise.all(audioFiles.map(file => this.loadAudioFile(file.name, file.url)));
  },
  
  // Play sound effects
  playGood() {
    this.playAudio('fx_good');
  },
  
  playWrong() {
    this.playAudio('fx_oof');
  },
  
  playLose() {
    this.playAudio('fx_lose');
  },
  
  playWin() {
    this.playAudio('fx_win');
  },
  
  playIntro() {
    this.playAudio('fx_intro');
  },
  
  playSelect() {
    this.ensureContext();
    this.playTone(440, 0.1, 'sine', 0.2);
  },
  
  // Fallback tone generation (kept for compatibility)
  playTone(frequency, duration, type = 'sine', volume = 0.3) {
    this.ensureContext();
    if (!this.ctx) return;
    
    try {
      const oscillator = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.ctx.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = type;
      gainNode.gain.setValueAtTime(volume, this.ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
      
      oscillator.start(this.ctx.currentTime);
      oscillator.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.error('Error playing tone:', e);
    }
  }
};

// ============================================================================
// VICTORY DETECTION
// ============================================================================

function checkVictoryCondition() {
  const score = gameState.score;
  const lives = gameState.lives;

  // Gewonnen als: ALLE vragen goed beantwoord EN nog levens over
  const hasEnoughCorrect = score >= gameState.totalQuestions;
  const hasLives = lives > 0;

  return hasEnoughCorrect && hasLives;
}

// Victory flow: first party, then blur overlay, then game-over screen
function levelComplete() {
  const isVictory = checkVictoryCondition();
  const percentage = Math.round((gameState.score / gameState.totalQuestions) * 100);

  if (isVictory) {
    // Victory mode
    AudioManager.playWin();

    // Set stats for later display
    victoryStats.innerHTML = `
      <p style="font-size: 1.5rem; color: #4caf50;">🎉 GEWONNEN! 🎉</p>
      <p>Lijst: ${gameState.listName}</p>
      <p>Modus: ${gameState.gameMode === 'word' ? 'Woord → Betekenis' : 'Betekenis → Woord'}</p>
      <p>Score: ${gameState.score}/${gameState.totalQuestions} (${percentage}%)</p>
      <p>${gameState.lives} levens over!</p>
    `;

    // Stage 1: Start victory party immediately (camera orbit, grillworst spinning, confetti)
    startVictoryAnimation();

    // Stage 2: After 2500ms, show blur overlay with stats
    setTimeout(() => {
      victoryOverlay.classList.remove('hidden');
      victoryOverlay.classList.add('win-state');
    }, 2500);

    // Stage 3: After 5500ms total, hide everything and show game-over screen
    setTimeout(() => {
      // Stop victory party
      stopVictoryAnimation();

      // Hide victory overlay
      victoryOverlay.classList.add('hidden');
      victoryOverlay.classList.remove('win-state');

      // Hide game screen, show game-over screen
      gameScreen.classList.add('hidden');
      gameOverScreen.classList.remove('hidden');

      // Set game-over content
      endTitle.textContent = 'Gewonnen! 🎊';
      document.getElementById('final-stats').innerHTML = `
        <p style="font-size: 1.5rem; color: #4caf50;">🎉 GEWONNEN! 🎉</p>
        <p>Lijst: ${gameState.listName}</p>
        <p>Modus: ${gameState.gameMode === 'word' ? 'Woord → Betekenis' : 'Betekenis → Woord'}</p>
        <p>Score: ${gameState.score}/${gameState.totalQuestions} (${percentage}%)</p>
        <p>${gameState.lives} levens over!</p>
      `;
    }, 5500);

  } else {
    // Game over - niet genoeg vragen goed
    AudioManager.playLose();

    endTitle.textContent = 'Nog even oefenen! 📚';
    document.getElementById('final-stats').innerHTML = `
      <p>Lijst: ${gameState.listName}</p>
      <p>Modus: ${gameState.gameMode === 'word' ? 'Woord → Betekenis' : 'Betekenis → Woord'}</p>
      <p>Score: ${gameState.score}/${gameState.totalQuestions} (${percentage}%)</p>
      <p>Je hebt ${gameState.totalQuestions - gameState.score} vragen fout beantwoord.</p>
      <p style="margin-top: 15px; font-size: 0.9rem; color: #666;">
        Je moet ${gameState.totalQuestions} vragen goed beantwoorden om te winnen!
      </p>
    `;

    // Ensure victory overlay is hidden
    victoryOverlay.classList.add('hidden');
    victoryOverlay.classList.remove('win-state');

    gameScreen.classList.add('hidden');
    gameOverScreen.classList.remove('hidden');
  }
}

function gameOver() {
  const percentage = Math.round((gameState.score / gameState.totalQuestions) * 100);
  
  // Play lose sound when player runs out of lives
  AudioManager.playLose();
  
  endTitle.textContent = 'Game Over!';
  document.getElementById('final-stats').innerHTML = `
    <p>Lijst: ${gameState.listName}</p>
    <p>Modus: ${gameState.gameMode === 'word' ? 'Woord → Betekenis' : 'Betekenis → Woord'}</p>
    <p>Score: ${gameState.score}/${gameState.totalQuestions} (${percentage}%)</p>
    <p>Je levens zijn op! 💔</p>
  `;

  // Ensure victory overlay is hidden
  victoryOverlay.classList.add('hidden');
  victoryOverlay.classList.remove('win-state');
  
  gameScreen.classList.add('hidden');
  gameOverScreen.classList.remove('hidden');
}

// ============================================================================
// ANTWOORD VERWERKING
// ============================================================================

function handleOptionSelected(selectedIndex) {
  if (gameState.isAnimating || gameState.isWrongAnswerShown) return;
  
  gameState.isAnimating = true;
  highlightPlatform(selectedIndex);
  highlightCard(selectedIndex, 'selected');
  
  const isCorrect = selectedIndex === gameState.correctIndex;
  
  // Make sure the ThreeScene instance is available
  if (globalThis.threeSceneInstance) {
    animateJump(selectedIndex, () => {
      if (isCorrect) {
        handleCorrect(selectedIndex);
      } else {
        handleWrong(selectedIndex);
      }
    });
  } else {
    console.error('ThreeScene instance not available');
    gameState.isAnimating = false;
  }
}

function handleCorrect(platformIndex) {
  gameState.score++;
  updateUI();
  highlightPlatform(platformIndex);
  highlightCard(platformIndex, 'correct');
  showFeedback('Goed gedaan! 🎉');
  
  // Play good sound effect
  AudioManager.playGood();
  
  // Use the ThreeScene instance directly for animations
  if (globalThis.threeSceneInstance) {
    globalThis.threeSceneInstance.animateCorrectChoice(platformIndex);
    setTimeout(() => {
      gameState.currentIndex++;
      loadNextQuestion();
    }, 2000);
  } else {
    console.error('ThreeScene instance not available for correct animation');
    setTimeout(() => {
      gameState.currentIndex++;
      loadNextQuestion();
    }, 800);
  }
}

function handleWrong(platformIndex) {
  gameState.lives--;
  updateUI();
  highlightPlatform(platformIndex);
  highlightCard(platformIndex, 'wrong');
  showFeedback('Oef! ❌');
  gameState.isWrongAnswerShown = true;
  
  // Play wrong sound effect
  AudioManager.playWrong();
  
  // Use the ThreeScene instance directly for animations
  if (globalThis.threeSceneInstance) {
    globalThis.threeSceneInstance.animateWrongChoice(platformIndex);
    
    const currentWord = gameState.shuffledWords[gameState.currentIndex];
    const correctAnswer = gameState.gameMode === 'word' ? currentWord.correct : currentWord.word;
    
    setTimeout(() => {
      highlightPlatform(gameState.correctIndex);
      highlightCard(gameState.correctIndex, 'correct');
      showFeedback(`Juist: ${correctAnswer}`, 3000);
    }, 2000);
    
    setTimeout(() => {
      gameState.currentIndex++;
      loadNextQuestion();
    }, 4000);
  } else {
    console.error('ThreeScene instance not available for wrong animation');
    
    const currentWord = gameState.shuffledWords[gameState.currentIndex];
    const correctAnswer = gameState.gameMode === 'word' ? currentWord.correct : currentWord.word;
    
    setTimeout(() => {
      highlightPlatform(gameState.correctIndex);
      highlightCard(gameState.correctIndex, 'correct');
      showFeedback(`Juist: ${correctAnswer}`, 3000);
    }, 600);
    
    setTimeout(() => {
      gameState.currentIndex++;
      loadNextQuestion();
    }, 4000);
  }
}

// ============================================================================
// SCHERM NAVIGATIE
// ============================================================================

function selectList(list, name) {
  gameState.currentList = list;
  gameState.listName = name;
  testButtons.classList.add('hidden');
  modeSelection.classList.remove('hidden');
  selectedListName.textContent = `Geselecteerd: ${name}`;
}

function startGame(mode) {
  gameState.gameMode = mode;
  startScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');
  
  initThreeScene(threeContainer, {
    onOptionSelected: handleOptionSelected
  });
  
  setTimeout(() => {
    updateCameraPosition(0);
  }, 100);
  
  initGame();
  // Play intro sound when starting a new game
  AudioManager.playIntro();
}

function stopGame() {
  stopVictoryAnimation();
  disposeThreeScene();
  gameScreen.classList.add('hidden');
  gameOverScreen.classList.add('hidden');
  victoryOverlay.classList.add('hidden');
  victoryOverlay.classList.remove('win-state');
  startScreen.classList.remove('hidden');
  testButtons.classList.remove('hidden');
  modeSelection.classList.add('hidden');
  
  gameState.currentList = [];
  gameState.listName = '';
  gameState.currentIndex = 0;
  gameState.score = 0;
  gameState.lives = 3;
  gameState.shuffledWords = [];
  gameState.currentOptions = [];
  gameState.correctIndex = -1;
}

function playAgain() {
  stopVictoryAnimation();
  gameOverScreen.classList.add('hidden');
  victoryOverlay.classList.add('hidden');
  victoryOverlay.classList.remove('win-state');
  gameScreen.classList.remove('hidden');
  
  disposeThreeScene();
  initThreeScene(threeContainer, {
    onOptionSelected: handleOptionSelected
  });
  
  setTimeout(() => {
    updateCameraPosition(0);
  }, 100);
  
  initGame();
  // Play intro sound again when replaying
  AudioManager.playIntro();
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

// Preload audio files when the page loads
window.addEventListener('load', () => {
  AudioManager.preloadAudioFiles().then(() => {
    console.log('Audio files preloaded successfully');
  }).catch(error => {
    console.error('Error preloading audio files:', error);
  });
});

document.getElementById('nl-btn').addEventListener('click', () => {
  selectList(wordList, 'Toets 12 feb (Nederlands)');
});

document.getElementById('en-btn').addEventListener('click', () => {
  selectList(englishWordList, 'Toets 17 feb (Engels)');
});

document.getElementById('mode-word-btn').addEventListener('click', () => {
  startGame('word');
});

document.getElementById('mode-meaning-btn').addEventListener('click', () => {
  startGame('meaning');
});

document.getElementById('reset-btn').addEventListener('click', () => {
  stopGame();
});

document.getElementById('play-again-btn').addEventListener('click', () => {
  playAgain();
});

document.getElementById('home-btn').addEventListener('click', () => {
  stopGame();
});

answerCards.forEach((card, index) => {
  card.addEventListener('click', () => {
    if (!gameState.isAnimating && !gameState.isWrongAnswerShown) {
      handleOptionSelected(index);
    }
  });
  
  card.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (!gameState.isAnimating && !gameState.isWrongAnswerShown) {
      handleOptionSelected(index);
    }
  }, { passive: true });
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(registration => {
        console.log('SW registered: ', registration);
        
        // Luister naar updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Er is een update beschikbaar - toon melding
              showFeedback('🔄 Nieuwe versie beschikbaar! Herlaad de pagina.', 5000);
            }
          });
        });
      })
      .catch(registrationError => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

document.addEventListener('touchmove', (e) => {
  if (e.target.closest('#three-container')) {
    e.preventDefault();
  }
}, { passive: true });
