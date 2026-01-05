// app.js
// Hoofdlogica voor het Grillworstje 3D spel.
// Ondersteunt twee woordenlijsten (NL en EN) en twee spelmodi.

import { wordList } from './words.js';
import { englishWordList } from './words_en.js';
import { 
  initThreeScene, 
  disposeThreeScene,
  updateCamera,
  highlightPlatform,
  spawnConfetti,
  animateJump,
  animateCorrect,
  animateWrong,
  resetGrillworstje,
  resetPlatforms
} from './threeScene.js';

// ============================================================================
// GAME STATE
// ============================================================================
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
  isWrongAnswerShown: false
};

// DOM elements
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

/**
 * Reset spel state en start nieuw spel.
 */
function initGame() {
  // Reset speelstate (behoud woordenlijst)
  gameState.currentIndex = 0;
  gameState.score = 0;
  gameState.lives = 3;
  gameState.isAnimating = false;
  gameState.isWrongAnswerShown = false;
  
  // Controleer of er een woordenlijst is
  if (!gameState.currentList || gameState.currentList.length === 0) {
    console.error('Geen woordenlijst beschikbaar!');
    return;
  }
  
  // Shuffle de woordenlijst
  gameState.shuffledWords = shuffleArray([...gameState.currentList]);
  
  // Reset Three.js scene en UI
  resetPlatforms();
  resetGrillworstje();
  resetAnswerCards();
  
  // Laad eerste vraag
  loadNextQuestion();
  updateUI();
}

/**
 * Laad de volgende vraag.
 */
function loadNextQuestion() {
  // Controleer of er een lijst is
  if (!gameState.currentList || gameState.currentList.length === 0) {
    console.error('currentList is leeg!');
    return;
  }
  
  // Check of alle woorden beantwoord zijn
  if (gameState.currentIndex >= gameState.shuffledWords.length) {
    gameState.shuffledWords = shuffleArray([...gameState.currentList]);
    gameState.currentIndex = 0;
  }
  
  const currentWord = gameState.shuffledWords[gameState.currentIndex];
  
  // Genereer opties
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
  if (gameState.gameMode === 'word') {
    wordDisplay.textContent = currentWord.word;
    if (modeIndicator) modeIndicator.textContent = 'Kies de juiste betekenis:';
  } else {
    wordDisplay.textContent = currentWord.correct;
    if (modeIndicator) modeIndicator.textContent = 'Kies het juiste woord:';
  }
  
  updateAnswerCards(gameState.currentOptions);
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
// ANTWOORD VERWERKING
// ============================================================================

function handleOptionSelected(selectedIndex) {
  if (gameState.isAnimating || gameState.isWrongAnswerShown) return;
  
  gameState.isAnimating = true;
  highlightPlatform(selectedIndex);
  highlightCard(selectedIndex, 'selected');
  
  const isCorrect = selectedIndex === gameState.correctIndex;
  
  animateJump(selectedIndex, () => {
    if (isCorrect) {
      handleCorrect(selectedIndex);
    } else {
      handleWrong(selectedIndex);
    }
  });
}

function handleCorrect(platformIndex) {
  gameState.score++;
  updateUI();
  highlightPlatform(platformIndex);
  highlightCard(platformIndex, 'correct');
  spawnConfetti();
  showFeedback('Goed gedaan! 🎉');
  
  animateCorrect(platformIndex, () => {
    setTimeout(() => {
      gameState.currentIndex++;
      loadNextQuestion();
    }, 1200);
  });
}

function handleWrong(platformIndex) {
  gameState.lives--;
  updateUI();
  highlightPlatform(platformIndex);
  highlightCard(platformIndex, 'wrong');
  showFeedback('Oef! ❌');
  gameState.isWrongAnswerShown = true;
  
  animateWrong(platformIndex, () => {
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
  });
}

function gameOver() {
  const totalQuestions = gameState.currentList.length;
  const percentage = Math.round((gameState.score / totalQuestions) * 100);
  
  document.getElementById('final-stats').innerHTML = `
    <p>Lijst: ${gameState.listName}</p>
    <p>Modus: ${gameState.gameMode === 'word' ? 'Woord → Betekenis' : 'Betekenis → Woord'}</p>
    <p>Score: ${gameState.score}/${totalQuestions} (${percentage}%)</p>
  `;
  
  gameScreen.classList.add('hidden');
  gameOverScreen.classList.remove('hidden');
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
  
  setTimeout(() => updateCamera(), 100);
  initGame();
}

/**
 * Ga terug naar startscherm (volledige reset inclusief woordenlijst).
 */
function stopGame() {
  disposeThreeScene();
  gameScreen.classList.add('hidden');
  startScreen.classList.remove('hidden');
  testButtons.classList.remove('hidden');
  modeSelection.classList.add('hidden');
  
  // Reset alles inclusief woordenlijst
  gameState.currentList = [];
  gameState.listName = '';
  gameState.currentIndex = 0;
  gameState.score = 0;
  gameState.lives = 3;
  gameState.shuffledWords = [];
  gameState.currentOptions = [];
  gameState.correctIndex = -1;
}

/**
 * Speel opnieuw (behoud woordenlijst, herstart spel).
 */
function playAgain() {
  gameOverScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');
  
  // Reset Three.js
  disposeThreeScene();
  initThreeScene(threeContainer, {
    onOptionSelected: handleOptionSelected
  });
  
  setTimeout(() => updateCamera(), 100);
  initGame();
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

document.getElementById('nl-btn').addEventListener('click', () => {
  selectList(wordList, 'Toets 8 jan (Nederlands)');
});

document.getElementById('en-btn').addEventListener('click', () => {
  selectList(englishWordList, 'Toets 9 jan (Engels)');
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

// Antwoord kaarten
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
  }, { passive: false });
});

// Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(registration => {
        console.log('SW registered: ', registration);
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
}, { passive: false });
