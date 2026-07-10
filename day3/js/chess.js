/**
 * chess.js — Core chess game logic
 * Board: 8x8 array, null = empty, { type, color } = piece
 * Colors: 'w' (white), 'b' (black)
 * Types: 'k' (king), 'q' (queen), 'r' (rook), 'b' (bishop), 'n' (knight), 'p' (pawn)
 */

const Chess = (() => {
  'use strict';

  const WHITE = 'w';
  const BLACK = 'b';

  const PIECE_VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

  // Piece-Square Tables (from white's perspective, flipped for black)
  const PST = {
    p: [ // Pawn
       0,  0,  0,  0,  0,  0,  0,  0,
      50, 50, 50, 50, 50, 50, 50, 50,
      10, 10, 20, 30, 30, 20, 10, 10,
       5,  5, 10, 25, 25, 10,  5,  5,
       0,  0,  0, 20, 20,  0,  0,  0,
       5, -5,-10,  0,  0,-10, -5,  5,
       5, 10, 10,-20,-20, 10, 10,  5,
       0,  0,  0,  0,  0,  0,  0,  0
    ],
    n: [ // Knight
      -50,-40,-30,-30,-30,-30,-40,-50,
      -40,-20,  0,  0,  0,  0,-20,-40,
      -30,  0, 10, 15, 15, 10,  0,-30,
      -30,  5, 15, 20, 20, 15,  5,-30,
      -30,  0, 15, 20, 20, 15,  0,-30,
      -30,  5, 10, 15, 15, 10,  5,-30,
      -40,-20,  0,  5,  5,  0,-20,-40,
      -50,-40,-30,-30,-30,-30,-40,-50
    ],
    b: [ // Bishop
      -20,-10,-10,-10,-10,-10,-10,-20,
      -10,  0,  0,  0,  0,  0,  0,-10,
      -10,  0,  5, 10, 10,  5,  0,-10,
      -10,  5,  5, 10, 10,  5,  5,-10,
      -10,  0, 10, 10, 10, 10,  0,-10,
      -10, 10, 10, 10, 10, 10, 10,-10,
      -10,  5,  0,  0,  0,  0,  5,-10,
      -20,-10,-10,-10,-10,-10,-10,-20
    ],
    r: [ // Rook
       0,  0,  0,  0,  0,  0,  0,  0,
       5, 10, 10, 10, 10, 10, 10,  5,
      -5,  0,  0,  0,  0,  0,  0, -5,
      -5,  0,  0,  0,  0,  0,  0, -5,
      -5,  0,  0,  0,  0,  0,  0, -5,
      -5,  0,  0,  0,  0,  0,  0, -5,
      -5,  0,  0,  0,  0,  0,  0, -5,
       0,  0,  0,  5,  5,  0,  0,  0
    ],
    q: [ // Queen
      -20,-10,-10, -5, -5,-10,-10,-20,
      -10,  0,  0,  0,  0,  0,  0,-10,
      -10,  0,  5,  5,  5,  5,  0,-10,
       -5,  0,  5,  5,  5,  5,  0, -5,
        0,  0,  5,  5,  5,  5,  0, -5,
      -10,  5,  5,  5,  5,  5,  0,-10,
      -10,  0,  5,  0,  0,  0,  0,-10,
      -20,-10,-10, -5, -5,-10,-10,-20
    ],
    k: [ // King (middlegame)
      -30,-40,-40,-50,-50,-40,-40,-30,
      -30,-40,-40,-50,-50,-40,-40,-30,
      -30,-40,-40,-50,-50,-40,-40,-30,
      -30,-40,-40,-50,-50,-40,-40,-30,
      -20,-30,-30,-40,-40,-30,-30,-20,
      -10,-20,-20,-20,-20,-20,-20,-10,
       20, 20,  0,  0,  0,  0, 20, 20,
       20, 30, 10,  0,  0, 10, 30, 20
    ]
  };

  // ── Board creation ──

  function createBoard() {
    return [
      [r('r'), r('n'), r('b'), r('q'), r('k'), r('b'), r('n'), r('r')],
      [r('p'), r('p'), r('p'), r('p'), r('p'), r('p'), r('p'), r('p')],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [r('p', 'w'), r('p', 'w'), r('p', 'w'), r('p', 'w'), r('p', 'w'), r('p', 'w'), r('p', 'w'), r('p', 'w')],
      [r('r', 'w'), r('n', 'w'), r('b', 'w'), r('q', 'w'), r('k', 'w'), r('b', 'w'), r('n', 'w'), r('r', 'w')],
    ];
  }

  function r(type, color = BLACK) {
    return { type, color };
  }

  function cloneBoard(board) {
    return board.map(row => row.map(cell => cell ? { ...cell } : null));
  }

  // ── Coordinate helpers ──

  function inBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }

  function idxToCoord(idx) { return { row: Math.floor(idx / 8), col: idx % 8 }; }

  function coordToIdx(row, col) { return row * 8 + col; }

  function toAlgebraic(row, col) {
    return String.fromCharCode(97 + col) + (8 - row);
  }

  function fromAlgebraic(alg) {
    return { row: 8 - parseInt(alg[1]), col: alg.charCodeAt(0) - 97 };
  }

  // ── Find king ──

  function findKing(board, color) {
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (board[r][c] && board[r][c].type === 'k' && board[r][c].color === color)
          return { row: r, col: c };
    return null;
  }

  // ── Is square attacked by color? ──

  function isSquareAttacked(board, row, col, attackerColor) {
    const directions = {
      n: [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]],
      k: [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]],
    };

    // Knight attacks
    for (const [dr, dc] of directions.n) {
      const nr = row + dr, nc = col + dc;
      if (inBounds(nr, nc) && board[nr][nc] && board[nr][nc].type === 'n' && board[nr][nc].color === attackerColor)
        return true;
    }

    // King attacks
    for (const [dr, dc] of directions.k) {
      const nr = row + dr, nc = col + dc;
      if (inBounds(nr, nc) && board[nr][nc] && board[nr][nc].type === 'k' && board[nr][nc].color === attackerColor)
        return true;
    }

    // Sliding pieces + pawns
    const slides = [
      { dr: -1, dc: -1, pieces: ['b', 'q'] },
      { dr: -1, dc:  0, pieces: ['r', 'q'] },
      { dr: -1, dc:  1, pieces: ['b', 'q'] },
      { dr:  0, dc: -1, pieces: ['r', 'q'] },
      { dr:  0, dc:  1, pieces: ['r', 'q'] },
      { dr:  1, dc: -1, pieces: ['b', 'q'] },
      { dr:  1, dc:  0, pieces: ['r', 'q'] },
      { dr:  1, dc:  1, pieces: ['b', 'q'] },
    ];

    for (const { dr, dc, pieces } of slides) {
      for (let i = 1; i < 8; i++) {
        const nr = row + dr * i, nc = col + dc * i;
        if (!inBounds(nr, nc)) break;
        const piece = board[nr][nc];
        if (piece) {
          if (piece.color === attackerColor && pieces.includes(piece.type)) return true;
          break;
        }
      }
    }

    // Pawn attacks
    const pawnDir = attackerColor === WHITE ? 1 : -1;
    for (const dc of [-1, 1]) {
      const nr = row + pawnDir, nc = col + dc;
      if (inBounds(nr, nc) && board[nr][nc] && board[nr][nc].type === 'p' && board[nr][nc].color === attackerColor)
        return true;
    }

    return false;
  }

  // ── Is king in check? ──

  function isInCheck(board, color) {
    const king = findKing(board, color);
    if (!king) return true; // king captured = definitely in check
    return isSquareAttacked(board, king.row, king.col, color === WHITE ? BLACK : WHITE);
  }

  // ── Generate pseudo-legal moves for a piece ──

  function generateRawMoves(board, row, col) {
    const piece = board[row][col];
    if (!piece) return [];

    const moves = [];
    const { type, color } = piece;
    const enemy = color === WHITE ? BLACK : WHITE;
    const forward = color === WHITE ? -1 : 1;
    const startRow = color === WHITE ? 6 : 1;
    const promoRow = color === WHITE ? 0 : 7;

    function addMove(tr, tc, promo = null) {
      if (!inBounds(tr, tc)) return;
      const target = board[tr][tc];
      if (target && target.color === color) return; // can't capture own piece
      moves.push({ fromRow: row, fromCol: col, toRow: tr, toCol: tc, promotion: promo });
    }

    function slide(dr, dc) {
      for (let i = 1; i < 8; i++) {
        const nr = row + dr * i, nc = col + dc * i;
        if (!inBounds(nr, nc)) break;
        const target = board[nr][nc];
        if (target) {
          if (target.color === enemy) addMove(nr, nc);
          break;
        }
        addMove(nr, nc);
      }
    }

    switch (type) {
      case 'p': {
        // Forward one
        const fr = row + forward;
        if (inBounds(fr, col) && !board[fr][col]) {
          if (fr === promoRow) {
            for (const pt of ['q', 'r', 'b', 'n']) addMove(fr, col, pt);
          } else {
            addMove(fr, col);
          }
          // Forward two from start
          const fr2 = row + 2 * forward;
          if (row === startRow && !board[fr2][col]) addMove(fr2, col);
        }
        // Captures
        for (const dc of [-1, 1]) {
          const fc = col + dc;
          if (inBounds(fr, fc)) {
            const target = board[fr][fc];
            if (target && target.color === enemy) {
              if (fr === promoRow) {
                for (const pt of ['q', 'r', 'b', 'n']) addMove(fr, fc, pt);
              } else {
                addMove(fr, fc);
              }
            }
          }
        }
        break;
      }

      case 'n':
        for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]])
          addMove(row + dr, col + dc);
        break;

      case 'b':
        for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) slide(dr, dc);
        break;

      case 'r':
        for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) slide(dr, dc);
        break;

      case 'q':
        for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]) slide(dr, dc);
        break;

      case 'k':
        for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]])
          addMove(row + dr, col + dc);
        break;
    }

    return moves;
  }

  // ── Generate legal moves ──

  function generateLegalMoves(board, row, col, castlingRights = null, enPassantTarget = null) {
    const piece = board[row][col];
    if (!piece) return [];

    const rawMoves = generateRawMoves(board, row, col);
    const legalMoves = rawMoves.filter(move => {
      const newBoard = applyMoveRaw(board, move);
      return !isInCheck(newBoard, piece.color);
    });

    // Add castling moves for king
    if (piece.type === 'k' && castlingRights) {
      const cr = castlingRights[piece.color] || {};
      const rank = piece.color === WHITE ? 7 : 0;

      // Kingside
      if (cr.k &&
          !board[rank][5] && !board[rank][6] &&
          board[rank][7] && board[rank][7].type === 'r' && board[rank][7].color === piece.color &&
          !isSquareAttacked(board, rank, 4, piece.color === WHITE ? BLACK : WHITE) &&
          !isSquareAttacked(board, rank, 5, piece.color === WHITE ? BLACK : WHITE) &&
          !isSquareAttacked(board, rank, 6, piece.color === WHITE ? BLACK : WHITE)) {
        legalMoves.push({ fromRow: rank, fromCol: 4, toRow: rank, toCol: 6, isCastling: 'k' });
      }

      // Queenside
      if (cr.q &&
          !board[rank][3] && !board[rank][2] && !board[rank][1] &&
          board[rank][0] && board[rank][0].type === 'r' && board[rank][0].color === piece.color &&
          !isSquareAttacked(board, rank, 4, piece.color === WHITE ? BLACK : WHITE) &&
          !isSquareAttacked(board, rank, 3, piece.color === WHITE ? BLACK : WHITE) &&
          !isSquareAttacked(board, rank, 2, piece.color === WHITE ? BLACK : WHITE)) {
        legalMoves.push({ fromRow: rank, fromCol: 4, toRow: rank, toCol: 2, isCastling: 'q' });
      }
    }

    // Add en passant for pawns
    if (piece.type === 'p' && enPassantTarget) {
      const { row: epRow, col: epCol } = enPassantTarget;
      const forward = piece.color === WHITE ? -1 : 1;
      if (row + forward === epRow && Math.abs(col - epCol) === 1) {
        const move = { fromRow: row, fromCol: col, toRow: epRow, toCol: epCol, isEnPassant: true };
        const newBoard = applyMoveRaw(board, move);
        if (!isInCheck(newBoard, piece.color)) {
          legalMoves.push(move);
        }
      }
    }

    return legalMoves;
  }

  // ── Apply move (returns new board, doesn't validate) ──

  function applyMoveRaw(board, move) {
    const newBoard = cloneBoard(board);
    const piece = newBoard[move.fromRow][move.fromCol];

    // En passant capture
    if (move.isEnPassant) {
      newBoard[move.fromRow][move.toCol] = null; // captured pawn beside
    }

    // Move piece
    newBoard[move.toRow][move.toCol] = piece;
    newBoard[move.fromRow][move.fromCol] = null;

    // Promotion
    if (move.promotion) {
      newBoard[move.toRow][move.toCol] = { type: move.promotion, color: piece.color };
    }

    // Castling - move rook too
    if (move.isCastling === 'k') {
      newBoard[move.toRow][5] = newBoard[move.toRow][7];
      newBoard[move.toRow][7] = null;
    } else if (move.isCastling === 'q') {
      newBoard[move.toRow][3] = newBoard[move.toRow][0];
      newBoard[move.toRow][0] = null;
    }

    return newBoard;
  }

  // ── Apply move with full state update ──

  function applyMove(state, move) {
    const piece = state.board[move.fromRow][move.fromCol];
    const captured = move.isEnPassant
      ? { type: 'p', color: piece.color === WHITE ? BLACK : WHITE }
      : state.board[move.toRow][move.toCol];

    const newState = {
      board: applyMoveRaw(state.board, move),
      turn: state.turn === WHITE ? BLACK : WHITE,
      castlingRights: JSON.parse(JSON.stringify(state.castlingRights)),
      enPassantTarget: null,
      halfMoveClock: (piece.type === 'p' || captured) ? 0 : state.halfMoveClock + 1,
      fullMoveNumber: state.turn === BLACK ? state.fullMoveNumber + 1 : state.fullMoveNumber,
      moveHistory: [...state.moveHistory, move],
      capturedPieces: {
        w: [...state.capturedPieces.w],
        b: [...state.capturedPieces.b],
      },
    };

    // Update castling rights
    const cr = newState.castlingRights;
    if (piece.type === 'k') {
      cr[piece.color] = {};
    }
    if (piece.type === 'r') {
      // If rook moved from its starting corner, remove that side's castling right
      const rank = piece.color === WHITE ? 7 : 0;
      if (move.fromRow === rank && move.fromCol === 0) cr[piece.color].q = false;
      if (move.fromRow === rank && move.fromCol === 7) cr[piece.color].k = false;
    }
    // If rook captured on its starting corner
    if (move.toRow === 0 && move.toCol === 0) cr.b.q = false;
    if (move.toRow === 0 && move.toCol === 7) cr.b.k = false;
    if (move.toRow === 7 && move.toCol === 0) cr.w.q = false;
    if (move.toRow === 7 && move.toCol === 7) cr.w.k = false;

    // Set en passant target
    if (piece.type === 'p' && Math.abs(move.toRow - move.fromRow) === 2) {
      const epRow = (move.fromRow + move.toRow) / 2;
      newState.enPassantTarget = { row: epRow, col: move.fromCol };
    }

    // Track captured pieces
    if (captured) {
      newState.capturedPieces[captured.color].push(captured);
    }

    return newState;
  }

  // ── Create initial state ──

  function createInitialState() {
    return {
      board: createBoard(),
      turn: WHITE,
      castlingRights: {
        w: { k: true, q: true },
        b: { k: true, q: true },
      },
      enPassantTarget: null,
      halfMoveClock: 0,
      fullMoveNumber: 1,
      moveHistory: [],
      capturedPieces: { w: [], b: [] },
    };
  }

  // ── Get all legal moves for a color ──

  function getAllLegalMoves(state) {
    const moves = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = state.board[r][c];
        if (piece && piece.color === state.turn) {
          moves.push(...generateLegalMoves(state.board, r, c, state.castlingRights, state.enPassantTarget));
        }
      }
    }
    return moves;
  }

  // ── Game status ──

  function getGameStatus(state) {
    const moves = getAllLegalMoves(state);
    const inCheck = isInCheck(state.board, state.turn);

    if (moves.length === 0) {
      if (inCheck) return { status: 'checkmate', winner: state.turn === WHITE ? BLACK : WHITE };
      return { status: 'stalemate' };
    }

    if (state.halfMoveClock >= 100) return { status: 'draw', reason: '50-move rule' };

    // Threefold repetition check
    if (state.moveHistory.length >= 8) {
      // Simplified: count current position occurrences
      let reps = 1;
      // Real threefold would need position hashing — skip for now
      if (reps >= 3) return { status: 'draw', reason: 'threefold repetition' };
    }

    // Insufficient material
    if (isInsufficientMaterial(state.board)) return { status: 'draw', reason: 'insufficient material' };

    if (inCheck) return { status: 'check' };

    return { status: 'playing' };
  }

  function isInsufficientMaterial(board) {
    const pieces = [];
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (board[r][c]) pieces.push(board[r][c]);

    if (pieces.length === 2) return true; // K vs K
    if (pieces.length === 3) {
      // K+B vs K or K+N vs K
      return pieces.some(p => p.type === 'b' || p.type === 'n');
    }
    if (pieces.length === 4) {
      // K+B vs K+B same color bishops
      const bishops = pieces.filter(p => p.type === 'b');
      if (bishops.length === 2 && bishops[0].color !== bishops[1].color) {
        // Check same square color
        const bSquares = [];
        for (let r = 0; r < 8; r++)
          for (let c = 0; c < 8; c++)
            if (board[r][c] && board[r][c].type === 'b')
              bSquares.push((r + c) % 2);
        if (bSquares[0] === bSquares[1]) return true;
      }
    }
    return false;
  }

  // ── Evaluation ──

  function evaluateBoard(board) {
    let score = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (!piece) continue;
        const val = PIECE_VALUES[piece.type];
        const pstIdx = piece.color === WHITE ? r * 8 + c : (7 - r) * 8 + c;
        const pstVal = PST[piece.type] ? PST[piece.type][pstIdx] : 0;
        const total = val + pstVal;
        score += piece.color === WHITE ? total : -total;
      }
    }
    return score;
  }

  // ── Move notation ──

  function moveToAlgebraic(state, move) {
    const piece = state.board[move.fromRow][move.fromCol];
    const captured = move.isEnPassant ? state.board[move.fromRow][move.toCol] : state.board[move.toRow][move.toCol];

    let notation = '';

    if (move.isCastling === 'k') return 'O-O';
    if (move.isCastling === 'q') return 'O-O-O';

    // Piece letter
    if (piece.type !== 'p') notation += piece.type.toUpperCase();

    // Disambiguation
    if (piece.type !== 'p' && piece.type !== 'k') {
      const others = [];
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = state.board[r][c];
          if (p && p.type === piece.type && p.color === piece.color && (r !== move.fromRow || c !== move.fromCol)) {
            const pmoves = generateLegalMoves(state.board, r, c, state.castlingRights, state.enPassantTarget);
            if (pmoves.some(m => m.toRow === move.toRow && m.toCol === move.toCol)) {
              others.push({ row: r, col: c });
            }
          }
        }
      }
      if (others.length > 0) {
        if (others.every(o => o.col !== move.fromCol)) notation += String.fromCharCode(97 + move.fromCol);
        else if (others.every(o => o.row !== move.fromRow)) notation += (8 - move.fromRow);
        else notation += toAlgebraic(move.fromRow, move.fromCol);
      }
    }

    if (captured) {
      if (piece.type === 'p') notation += String.fromCharCode(97 + move.fromCol);
      notation += 'x';
    }

    notation += toAlgebraic(move.toRow, move.toCol);

    if (move.promotion) notation += '=' + move.promotion.toUpperCase();

    // Check/checkmate suffix
    const newState = applyMove(state, move);
    if (isInCheck(newState.board, newState.turn)) {
      notation += getAllLegalMoves(newState).length === 0 ? '#' : '+';
    }

    return notation;
  }

  // ── Public API ──

  return {
    WHITE, BLACK,
    PIECE_VALUES, PST,
    createBoard, cloneBoard,
    createInitialState,
    generateLegalMoves, getAllLegalMoves,
    applyMoveRaw, applyMove,
    isInCheck, isSquareAttacked,
    getGameStatus, evaluateBoard,
    moveToAlgebraic,
    toAlgebraic, fromAlgebraic,
    inBounds, findKing,
    isInsufficientMaterial,
  };
})();

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Chess;
}
