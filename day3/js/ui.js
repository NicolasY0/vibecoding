/**
 * ui.js — Canvas-based chessboard with Lichess cburnett SVG pieces
 */

const UI = (() => {
  'use strict';

  // ── Piece image paths ──
  const PIECE_IMAGES = {
    k: { w: 'assets/pieces/wK.6a015951.svg', b: 'assets/pieces/bK.b83f0a15.svg' },
    q: { w: 'assets/pieces/wQ.c3dc7fce.svg', b: 'assets/pieces/bQ.b60573d7.svg' },
    r: { w: 'assets/pieces/wR.53013fc8.svg', b: 'assets/pieces/bR.7b4fa825.svg' },
    b: { w: 'assets/pieces/wB.b7d1a118.svg', b: 'assets/pieces/bB.77e9debf.svg' },
    n: { w: 'assets/pieces/wN.ef4cde0a.svg', b: 'assets/pieces/bN.28c70309.svg' },
    p: { w: 'assets/pieces/wP.0596b7ce.svg', b: 'assets/pieces/bP.09539f32.svg' },
  };

  // ── Loaded Image objects ──
  const loadedImages = {};   // 'w_k' -> Image, etc.
  let imagesReady = false;

  // ── State ──
  let canvas, ctx;
  let boardSize, sqSize, offsetX, offsetY;
  let selectedSq = null;
  let legalMoves = [];
  let lastMove = null;
  let flipped = false;
  let gameState = null;
  let gameStatus = null;

  // Callbacks
  let onMoveCallback = null;

  // ── Preload all piece images ──

  function preloadImages() {
    return new Promise((resolve) => {
      const types = ['k', 'q', 'r', 'b', 'n', 'p'];
      const colors = ['w', 'b'];
      let total = 12, loaded = 0;

      for (const type of types) {
        for (const color of colors) {
          const img = new Image();
          const key = color + '_' + type;
          img.onload = () => {
            loaded++;
            if (loaded >= total) { imagesReady = true; resolve(); }
          };
          img.onerror = () => {
            loaded++;
            console.warn('Failed to load piece image:', PIECE_IMAGES[type][color]);
            if (loaded >= total) { imagesReady = true; resolve(); }
          };
          img.src = PIECE_IMAGES[type][color];
          loadedImages[key] = img;
        }
      }
    });
  }

  // ── Initialization ──

  async function init(canvasEl, callbacks = {}) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    onMoveCallback = callbacks.onMove || null;
    await preloadImages();
    resize();
    canvas.addEventListener('click', handleClick);
  }

  function resize() {
    if (!canvas) return;
    const maxW = Math.min(canvas.parentElement.clientWidth - 32, 480);
    boardSize = maxW;
    sqSize = boardSize / 8;
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = Math.max(boardSize + 60, 480);
    offsetX = (canvas.width - boardSize) / 2;
    offsetY = 30;
    render();
  }

  // ── Coordinate mapping ──

  function canvasToBoard(cx, cy) {
    const col = Math.floor((cx - offsetX) / sqSize);
    const row = Math.floor((cy - offsetY) / sqSize);
    if (col < 0 || col > 7 || row < 0 || row > 7) return null;
    return flipped ? { row: 7 - row, col: 7 - col } : { row, col };
  }

  function boardToCanvas(row, col) {
    const dr = flipped ? 7 - row : row;
    const dc = flipped ? 7 - col : col;
    return { x: offsetX + dc * sqSize, y: offsetY + dr * sqSize };
  }

  // ── Click handler ──

  let handleClick = function(e) {
    if (!gameState || (gameStatus && gameStatus.status === 'checkmate')) return;

    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const sq = canvasToBoard(cx, cy);
    if (!sq) { clearSelection(); return; }

    const { row, col } = sq;
    const piece = gameState.board[row][col];

    if (selectedSq) {
      if (selectedSq.row === row && selectedSq.col === col) { clearSelection(); return; }

      const move = legalMoves.find(m => m.toRow === row && m.toCol === col);
      if (move) {
        if (move.promotion && !move.chosenPromotion) {
          showPromotionDialog(move, (chosen) => {
            move.chosenPromotion = chosen;
            move.promotion = chosen;
            executeMove(move);
          });
          return;
        }
        executeMove(move);
        return;
      }

      if (piece && piece.color === gameState.turn) {
        selectPiece(row, col);
      } else {
        clearSelection();
      }
    } else {
      if (piece && piece.color === gameState.turn) {
        selectPiece(row, col);
      }
    }
  };

  function executeMove(move) {
    lastMove = move;
    clearSelection();
    if (onMoveCallback) onMoveCallback(move);
  }

  function selectPiece(row, col) {
    selectedSq = { row, col };
    legalMoves = Chess.generateLegalMoves(
      gameState.board, row, col,
      gameState.castlingRights, gameState.enPassantTarget
    );
    render();
  }

  function clearSelection() {
    selectedSq = null;
    legalMoves = [];
    render();
  }

  // ── Promotion dialog ──

  let promoCallback = null;
  let promoMove = null;
  let promoAreas = [];

  function showPromotionDialog(move, callback) {
    promoMove = move;
    promoCallback = callback;
    render();
  }

  function handlePromoClick(pieceType) {
    if (promoCallback) {
      promoCallback(pieceType);
      promoCallback = null;
      promoMove = null;
    }
  }

  // ── Set state ──

  function setState(state, status) {
    gameState = state;
    gameStatus = status;
    selectedSq = null;
    legalMoves = [];
    render();
  }

  function setLastMove(move) { lastMove = move; }

  // ── Render ──

  function render() {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawBoard();
    if (gameState) {
      drawPieces();
      drawHighlights();
      if (promoMove && promoCallback) drawPromotionDialog();
    }
  }

  // ── Lichess brown board ──

  function drawBoard() {
    const light = '#F0D9B5';  // Lichess brown light
    const dark = '#B58863';   // Lichess brown dark

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const { x, y } = boardToCanvas(r, c);
        ctx.fillStyle = (r + c) % 2 === 0 ? light : dark;
        ctx.fillRect(x, y, sqSize, sqSize);

        // Coordinates inside board (Lichess style)
        if (c === 0) {
          ctx.fillStyle = (r + c) % 2 === 0 ? '#B08860' : '#E8CFA5';
          ctx.font = `bold ${Math.max(10, sqSize * 0.18)}px "Noto Sans SC", sans-serif`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          const label = flipped ? String(r + 1) : String(8 - r);
          ctx.fillText(label, x + 3, y + 2);
        }
        if (r === 7) {
          ctx.fillStyle = (r + c) % 2 === 0 ? '#B08860' : '#E8CFA5';
          ctx.font = `bold ${Math.max(10, sqSize * 0.18)}px "Noto Sans SC", sans-serif`;
          ctx.textAlign = 'right';
          ctx.textBaseline = 'bottom';
          const label = flipped ? String.fromCharCode(104 - c) : String.fromCharCode(97 + c);
          ctx.fillText(label, x + sqSize - 3, y + sqSize - 2);
        }
      }
    }
  }

  // ── Pieces using SVG images ──

  function drawPieces() {
    if (!imagesReady) return;

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = gameState.board[r][c];
        if (!piece) continue;
        const { x, y } = boardToCanvas(r, c);
        const img = loadedImages[piece.color + '_' + piece.type];
        if (img && img.complete && img.naturalWidth > 0) {
          // Slight padding so pieces fill the square nicely
          const pad = sqSize * 0.06;
          ctx.drawImage(img, x + pad, y + pad, sqSize - pad * 2, sqSize - pad * 2);
        } else {
          // Fallback: Unicode
          const unicode = { k: { w: '♔', b: '♚' }, q: { w: '♕', b: '♛' },
            r: { w: '♖', b: '♜' }, b: { w: '♗', b: '♝' },
            n: { w: '♘', b: '♞' }, p: { w: '♙', b: '♟' } };
          ctx.fillStyle = piece.color === 'b' ? '#2C1810' : '#FFF8F0';
          ctx.font = `${sqSize * 0.8}px Georgia, serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(unicode[piece.type][piece.color], x + sqSize / 2, y + sqSize / 2);
        }
      }
    }
  }

  // ── Highlights ──

  function drawHighlights() {
    // Last move
    if (lastMove) {
      for (const sq of [{ r: lastMove.fromRow, c: lastMove.fromCol }, { r: lastMove.toRow, c: lastMove.toCol }]) {
        const { x, y } = boardToCanvas(sq.r, sq.c);
        ctx.fillStyle = 'rgba(155, 199, 0, 0.41)';  // Lichess green highlight
        ctx.fillRect(x, y, sqSize, sqSize);
      }
    }

    // Selected square
    if (selectedSq) {
      const { x, y } = boardToCanvas(selectedSq.row, selectedSq.col);
      ctx.fillStyle = 'rgba(155, 199, 0, 0.35)';
      ctx.fillRect(x, y, sqSize, sqSize);
    }

    // Legal moves
    for (const move of legalMoves) {
      const { x, y } = boardToCanvas(move.toRow, move.toCol);
      const target = gameState.board[move.toRow][move.toCol];
      const isCapture = target || move.isEnPassant;

      if (isCapture) {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.lineWidth = sqSize * 0.08;
        ctx.beginPath();
        ctx.arc(x + sqSize / 2, y + sqSize / 2, sqSize * 0.35, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
        ctx.beginPath();
        ctx.arc(x + sqSize / 2, y + sqSize / 2, sqSize * 0.14, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // King in check
    if (gameState && Chess.isInCheck(gameState.board, gameState.turn)) {
      const king = Chess.findKing(gameState.board, gameState.turn);
      if (king) {
        const { x, y } = boardToCanvas(king.row, king.col);
        ctx.fillStyle = 'rgba(220, 70, 50, 0.50)';
        ctx.fillRect(x, y, sqSize, sqSize);
      }
    }
  }

  // ── Promotion dialog ──

  function drawPromotionDialog() {
    if (!promoMove || !imagesReady) return;

    const { x, y } = boardToCanvas(promoMove.toRow, promoMove.toCol);
    const color = gameState.turn;
    const options = [
      { type: 'q', label: '后' },
      { type: 'r', label: '车' },
      { type: 'b', label: '象' },
      { type: 'n', label: '马' },
    ];

    const panelW = sqSize * 1.1;
    const panelH = sqSize * 4;
    const panelX = x + sqSize / 2 - panelW / 2;
    const startY = y;

    // Overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Panel
    ctx.fillStyle = '#262421';
    ctx.fillRect(panelX, startY, panelW, panelH);
    ctx.strokeStyle = '#404040';
    ctx.lineWidth = 2;
    ctx.strokeRect(panelX, startY, panelW, panelH);

    const areas = [];
    for (let i = 0; i < options.length; i++) {
      const oy = startY + i * sqSize;
      const img = loadedImages[color + '_' + options[i].type];

      // Row background
      ctx.fillStyle = i % 2 === 0 ? '#302C2A' : '#262421';
      ctx.fillRect(panelX + 2, oy + 2, panelW - 4, sqSize - 4);

      if (img && img.complete && img.naturalWidth > 0) {
        const pad = sqSize * 0.12;
        ctx.drawImage(img, panelX + pad, oy + pad, sqSize - pad * 2, sqSize - pad * 2);
      }

      // Label
      ctx.fillStyle = '#B0A090';
      ctx.font = `bold ${Math.max(10, sqSize * 0.16)}px "Noto Sans SC", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(options[i].label, panelX + panelW / 2, oy + sqSize - 4);

      areas.push({ x: panelX, y: oy, w: panelW, h: sqSize, type: options[i].type });
    }
    promoAreas = areas;
  }

  // ── Override click for promo dialog ──

  const origHandleClick = handleClick;
  handleClick = function(e) {
    if (promoMove && promoCallback) {
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      for (const area of promoAreas) {
        if (cx >= area.x && cx <= area.x + area.w && cy >= area.y && cy <= area.y + area.h) {
          handlePromoClick(area.type);
          render();
          return;
        }
      }
      return;
    }
    origHandleClick(e);
  };

  // ── Public ──

  function flipBoard() {
    flipped = !flipped;
    render();
  }

  return {
    init,
    setState,
    setLastMove,
    resize,
    render,
    flipBoard,
    clearSelection,
  };
})();
