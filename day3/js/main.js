/**
 * main.js — Entry point, mode management, game flow control, chess clock
 */

(function() {
  'use strict';

  // ── DOM refs ──
  const canvas = document.getElementById('chess-canvas');
  const modeSelect = document.getElementById('mode-select');
  const difficultySelect = document.getElementById('difficulty-select');
  const difficultyGroup = document.getElementById('difficulty-group');
  const btnNewGame = document.getElementById('btn-new-game');
  const btnUndo = document.getElementById('btn-undo');
  const btnFlip = document.getElementById('btn-flip');
  const turnIndicator = document.getElementById('turn-indicator');
  const statusText = document.getElementById('status-text');
  const capturedWhite = document.getElementById('captured-white');
  const capturedBlack = document.getElementById('captured-black');
  const moveList = document.getElementById('move-list');
  const gameOverModal = document.getElementById('game-over-modal');
  const gameOverText = document.getElementById('game-over-text');
  const btnPlayAgain = document.getElementById('btn-play-again');
  const btnResign = document.getElementById('btn-resign');
  const clockWhite = document.getElementById('clock-white');
  const clockBlack = document.getElementById('clock-black');
  const timeControlSelect = document.getElementById('time-control');
  const clockEnabledCheck = document.getElementById('clock-enabled');

  // ── State ──
  let gameState = null;
  let gameStatus = null;
  let gameMode = 'pvp';
  let aiDifficulty = 'medium';
  let aiColor = 'b';
  let aiThinking = false;
  let undoStack = [];

  // ── Clock state ──
  let clock = { w: 600, b: 600 };     // seconds remaining
  let clockInitial = 600;              // initial time in seconds
  let clockIncrement = 3;              // seconds added per move
  let clockInterval = null;
  let clockRunning = false;
  let clockActive = null;              // 'w' or 'b'
  let clockEnabled = true;

  // ── Time control presets ──
  const TIME_PRESETS = {
    '1+0':  { initial: 60,   inc: 0  },
    '3+0':  { initial: 180,  inc: 0  },
    '3+2':  { initial: 180,  inc: 2  },
    '5+3':  { initial: 300,  inc: 3  },
    '10+0': { initial: 600,  inc: 0  },
    '10+5': { initial: 600,  inc: 5  },
    '15+10':{ initial: 900,  inc: 10 },
    '30+0': { initial: 1800, inc: 0  },
  };

  // ── Initialize ──

  function init() {
    // Read initial mode from select
    gameMode = modeSelect.value;
    difficultyGroup.style.display = gameMode === 'pvai' ? 'flex' : 'none';
    aiDifficulty = difficultySelect.value;

    UI.init(canvas, {
      onMove: handlePlayerMove,
    });

    btnNewGame.addEventListener('click', newGame);
    btnUndo.addEventListener('click', undo);
    btnFlip.addEventListener('click', () => UI.flipBoard());
    btnPlayAgain.addEventListener('click', () => { hideGameOver(); newGame(); });

    btnResign.addEventListener('click', resign);

    clockEnabledCheck.addEventListener('change', () => {
      clockEnabled = clockEnabledCheck.checked;
      toggleClockUI();
      if (!clockEnabled) {
        stopClock();
      } else {
        // Resume clock for current player
        if (gameState && gameStatus.status === 'playing') {
          startClock(gameState.turn);
        }
      }
      updateClockDisplay();
    });

    modeSelect.addEventListener('change', (e) => {
      gameMode = e.target.value;
      difficultyGroup.style.display = gameMode === 'pvai' ? 'flex' : 'none';
      newGame();
    });

    difficultySelect.addEventListener('change', (e) => {
      aiDifficulty = e.target.value;
      if (gameMode === 'pvai') newGame();
    });

    timeControlSelect.addEventListener('change', () => {
      const preset = TIME_PRESETS[timeControlSelect.value];
      if (preset) {
        clockInitial = preset.initial;
        clockIncrement = preset.inc;
        resetClock();
      }
    });

    window.addEventListener('resize', () => UI.resize());

    clockEnabled = clockEnabledCheck.checked;
    toggleClockUI();
    resetClock();
    newGame();
  }

  // ── Clock ──

  function resetClock() {
    stopClock();
    clock = { w: clockInitial, b: clockInitial };
    clockActive = null;
    updateClockDisplay();
  }

  function startClock(color) {
    if (!clockEnabled) return;
    stopClock();
    clockActive = color;
    clockRunning = true;
    // Update active panel styling
    document.getElementById('clock-white-panel').classList.toggle('active', color === 'w');
    document.getElementById('clock-black-panel').classList.toggle('active', color === 'b');
    clockInterval = setInterval(tick, 1000);
  }

  function stopClock() {
    if (clockInterval) {
      clearInterval(clockInterval);
      clockInterval = null;
    }
    clockRunning = false;
    clockActive = null;
    document.getElementById('clock-white-panel').classList.remove('active');
    document.getElementById('clock-black-panel').classList.remove('active');
  }

  function tick() {
    if (!clockActive || !clockRunning) return;

    clock[clockActive] = Math.max(0, clock[clockActive] - 1);
    updateClockDisplay();

    if (clock[clockActive] <= 0) {
      // Time's up — opponent wins
      stopClock();
      const winner = clockActive === 'w' ? 'b' : 'w';
      gameStatus = { status: 'checkmate', winner };
      UI.setState(gameState, gameStatus);
      updateHUD();
      showGameOver('超时! ' + (winner === 'w' ? '♔ 白方' : '♚ 黑方') + ' 获胜 (对手超时)');
    }
  }

  function updateClockDisplay() {
    if (!clockEnabled) {
      clockWhite.textContent = '--:--';
      clockBlack.textContent = '--:--';
      return;
    }
    clockWhite.textContent = formatTime(clock.w);
    clockBlack.textContent = formatTime(clock.b);

    // Flash low time (< 30s)
    clockWhite.classList.toggle('low-time', clock.w <= 30 && clockActive === 'w');
    clockBlack.classList.toggle('low-time', clock.b <= 30 && clockActive === 'b');
  }

  function formatTime(seconds) {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  }

  // ── New game ──

  function newGame() {
    gameState = Chess.createInitialState();
    gameStatus = { status: 'playing' };
    undoStack = [];
    aiThinking = false;
    UI.setState(gameState, gameStatus);
    UI.setLastMove(null);
    updateHUD();
    hideGameOver();
    resetClock();
    moveList.innerHTML = '';

    // Start clock for white
    if (gameState.turn === 'w') {
      startClock('w');
    }

    // If PvAI and AI is white, AI makes first move
    if (gameMode === 'pvai' && gameState.turn === aiColor) {
      scheduleAIMove();
    }
  }

  // ── Handle player move ──

  function handlePlayerMove(move) {
    if (aiThinking) return;
    if (gameStatus && (gameStatus.status === 'checkmate' || gameStatus.status === 'stalemate' || gameStatus.status === 'draw')) return;

    // Stop player's clock, add increment
    stopClock();
    const playerColor = gameState.turn;
    clock[playerColor] += clockIncrement;

    // Compute notation BEFORE applying move (piece still at fromRow/fromCol)
    const notation = Chess.moveToAlgebraic(gameState, move);
    const preMoveState = gameState;

    // Save for undo
    undoStack.push(JSON.parse(JSON.stringify(gameState)));

    if (move.chosenPromotion) {
      move.promotion = move.chosenPromotion;
    }

    gameState = Chess.applyMove(gameState, move);
    gameStatus = Chess.getGameStatus(gameState);
    UI.setState(gameState, gameStatus);
    UI.setLastMove(move);
    updateHUD();
    addMoveToHistory(move, notation, preMoveState);

    if (gameStatus.status === 'checkmate' || gameStatus.status === 'stalemate' || gameStatus.status === 'draw') {
      stopClock();
      updateClockDisplay();
      showGameOver();
      return;
    }

    // Start opponent's clock
    startClock(gameState.turn);

    // Trigger AI if in PvAI mode
    if (gameMode === 'pvai' && gameState.turn === aiColor) {
      scheduleAIMove();
    }
  }

  // ── AI move ──

  function scheduleAIMove() {
    aiThinking = true;
    updateHUD();

    // Small delay so UI can update
    setTimeout(() => {
      try {
        const depth = aiDifficulty === 'easy' ? 1 : aiDifficulty === 'medium' ? 2 : 3;
        const aiMove = AI.getBestMove(gameState, depth);

        if (aiMove) {
          // Compute notation BEFORE applying
          const aiNotation = Chess.moveToAlgebraic(gameState, aiMove);

          // Stop AI's clock, add increment
          stopClock();
          clock[gameState.turn] += clockIncrement;

          undoStack.push(JSON.parse(JSON.stringify(gameState)));
          gameState = Chess.applyMove(gameState, aiMove);
          gameStatus = Chess.getGameStatus(gameState);

          UI.setState(gameState, gameStatus);
          UI.setLastMove(aiMove);
          updateHUD();
          addMoveToHistory(aiMove, aiNotation);

          if (gameStatus.status === 'checkmate' || gameStatus.status === 'stalemate' || gameStatus.status === 'draw') {
            stopClock();
            updateClockDisplay();
            showGameOver();
          } else {
            // Start opponent's clock
            startClock(gameState.turn);
          }
        } else {
          console.warn('AI returned no move — possible stalemate');
          // AI has no legal moves — re-evaluate game status
          gameStatus = Chess.getGameStatus(gameState);
          updateHUD();
          if (gameStatus.status !== 'playing') {
            stopClock();
            showGameOver();
          }
        }
      } catch (err) {
        console.error('AI error:', err);
      }

      aiThinking = false;
      updateHUD();
    }, 150);
  }

  // ── Resign ──

  function resign() {
    if (!gameState || (gameStatus && gameStatus.status !== 'playing')) return;
    if (aiThinking) return;

    const loser = gameState.turn;
    const winner = loser === 'w' ? 'b' : 'w';
    stopClock();
    gameStatus = { status: 'checkmate', winner };
    UI.setState(gameState, gameStatus);
    updateHUD();
    updateClockDisplay();
    showGameOver(`${loser === 'w' ? '♔ 白方' : '♚ 黑方'} 认输 — ${winner === 'w' ? '♔ 白方' : '♚ 黑方'} 获胜`);
  }

  // ── Clock visibility ──

  function toggleClockUI() {
    const panels = [
      document.getElementById('clock-white-panel'),
      document.getElementById('clock-black-panel'),
    ];
    const timeCtrl = document.getElementById('time-control');
    panels.forEach(p => p.classList.toggle('clock-hidden', !clockEnabled));
    if (timeCtrl) timeCtrl.classList.toggle('clock-hidden', !clockEnabled);
  }

  // ── Undo ──

  function undo() {
    if (aiThinking) return;

    const steps = (gameMode === 'pvai' && undoStack.length >= 2) ? 2 : 1;

    for (let i = 0; i < steps; i++) {
      if (undoStack.length === 0) break;
      gameState = undoStack.pop();
    }

    gameStatus = Chess.getGameStatus(gameState);
    UI.setLastMove(gameState.moveHistory.length > 0
      ? gameState.moveHistory[gameState.moveHistory.length - 1]
      : null);
    UI.setState(gameState, gameStatus);
    updateHUD();
    hideGameOver();

    // Remove moves from display
    for (let i = 0; i < steps; i++) {
      if (moveList.lastChild) moveList.removeChild(moveList.lastChild);
    }

    // Resume clock
    stopClock();
    startClock(gameState.turn);
  }

  // ── HUD ──

  function updateHUD() {
    if (!gameState) return;

    const turnColor = gameState.turn === 'w' ? '白方' : '黑方';
    const turnSymbol = gameState.turn === 'w' ? '♔' : '♚';

    if (gameStatus.status === 'checkmate') {
      const winner = gameStatus.winner === 'w' ? '♔ 白方' : '♚ 黑方';
      turnIndicator.textContent = `${winner} 将杀获胜!`;
      statusText.textContent = '将死';
    } else if (gameStatus.status === 'stalemate') {
      turnIndicator.textContent = '🤝 无子可动';
      statusText.textContent = '和棋 — 逼和';
    } else if (gameStatus.status === 'draw') {
      turnIndicator.textContent = '🤝 和棋';
      statusText.textContent = gameStatus.reason || '和棋';
    } else if (gameStatus.status === 'check') {
      turnIndicator.textContent = `${turnSymbol} ${turnColor} — 将军!`;
      statusText.textContent = aiThinking ? '🤖 AI 思考中...' : '将军!';
    } else {
      turnIndicator.textContent = `${turnSymbol} ${turnColor}回合`;
      statusText.textContent = aiThinking
        ? '🤖 AI 思考中...'
        : (gameMode === 'pvai' && gameState.turn === aiColor ? '等待 AI 走棋...' : '你的回合');
    }

    // Captured pieces
    capturedWhite.textContent = gameState.capturedPieces.w.length
      ? gameState.capturedPieces.w.map(p => getPieceSymbol(p)).join(' ') : '—';
    capturedBlack.textContent = gameState.capturedPieces.b.length
      ? gameState.capturedPieces.b.map(p => getPieceSymbol(p)).join(' ') : '—';

    btnUndo.disabled = undoStack.length === 0 || aiThinking;

    updateClockDisplay();
  }

  function addMoveToHistory(move, notation) {
    // move was just applied, so turn has flipped — the mover was the previous turn
    const isWhiteMover = gameState.turn === 'b'; // after white's move, turn is black

    if (isWhiteMover) {
      const row = document.createElement('div');
      row.className = 'move-row';
      row.innerHTML = `<span class="move-num">${gameState.fullMoveNumber}.</span><span class="move-white">${notation}</span>`;
      moveList.appendChild(row);
    } else {
      const rows = moveList.children;
      if (rows.length > 0) {
        const lastRow = rows[rows.length - 1];
        const blackSpan = document.createElement('span');
        blackSpan.className = 'move-black';
        blackSpan.textContent = notation;
        lastRow.appendChild(blackSpan);
      } else {
        const row = document.createElement('div');
        row.className = 'move-row';
        row.innerHTML = `<span class="move-num">${gameState.fullMoveNumber - 1}.</span><span class="move-white">...</span><span class="move-black">${notation}</span>`;
        moveList.appendChild(row);
      }
    }

    moveList.scrollTop = moveList.scrollHeight;
  }

  function getPieceSymbol(piece) {
    const map = {
      k: { w: '♔', b: '♚' }, q: { w: '♕', b: '♛' },
      r: { w: '♖', b: '♜' }, b: { w: '♗', b: '♝' },
      n: { w: '♘', b: '♞' }, p: { w: '♙', b: '♟' },
    };
    return map[piece.type]?.[piece.color] || '?';
  }

  // ── Game over ──

  function showGameOver(customMsg) {
    let msg = customMsg || '';
    if (!customMsg) {
      if (gameStatus.status === 'checkmate') {
        msg = `${gameStatus.winner === 'w' ? '♔ 白方' : '♚ 黑方'} 将杀获胜!`;
      } else if (gameStatus.status === 'stalemate') {
        msg = '🤝 无子可动 — 和棋 (逼和)';
      } else if (gameStatus.status === 'draw') {
        msg = `🤝 和棋 — ${gameStatus.reason || ''}`;
      }
    }
    gameOverText.textContent = msg;
    gameOverModal.style.display = 'flex';
  }

  function hideGameOver() {
    gameOverModal.style.display = 'none';
  }

  // ── Start ──
  init();
})();
