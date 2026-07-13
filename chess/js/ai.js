/**
 * ai.js — Chess AI engine
 * Minimax with Alpha-Beta pruning + piece-square tables
 */

const AI = (() => {
  'use strict';

  // ── Move ordering ──

  function scoreMove(state, move) {
    let score = 0;
    const piece = state.board[move.fromRow][move.fromCol];
    const target = state.board[move.toRow][move.toCol];

    // Prioritize captures — MVV-LVA (Most Valuable Victim - Least Valuable Attacker)
    if (target) {
      score += 10 * Chess.PIECE_VALUES[target.type] - Chess.PIECE_VALUES[piece.type];
    }

    // Bonus for promotions
    if (move.promotion) {
      score += Chess.PIECE_VALUES[move.promotion];
    }

    // Bonus for castling
    if (move.isCastling) score += 50;

    // Penalize moving to attacked squares (simple check)
    const newBoard = Chess.applyMoveRaw(state.board, move);
    if (Chess.isInCheck(newBoard, piece.color)) score -= 100;

    return score;
  }

  function orderMoves(state, moves) {
    return moves
      .map(m => ({ move: m, score: scoreMove(state, m) }))
      .sort((a, b) => b.score - a.score)
      .map(x => x.move);
  }

  // ── Quiescence search (capture-only, limited) ──

  function quiesce(state, alpha, beta, color, depth) {
    if (depth <= 0) return Chess.evaluateBoard(state.board) * color;

    const standPat = Chess.evaluateBoard(state.board) * color;
    if (standPat >= beta) return beta;
    if (standPat > alpha) alpha = standPat;

    const moves = Chess.getAllLegalMoves(state).filter(m =>
      state.board[m.toRow][m.toCol] || m.isEnPassant
    );
    const ordered = orderMoves(state, moves);

    for (const move of ordered) {
      const newState = Chess.applyMove(state, move);
      const score = -quiesce(newState, -beta, -alpha, -color, depth - 1);
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }

    return alpha;
  }

  // ── Negamax with Alpha-Beta ──

  function negamax(state, depth, alpha, beta, color) {
    if (depth === 0) {
      // Quiescence search at leaf
      return quiesce(state, alpha, beta, color, 2);
    }

    const moves = Chess.getAllLegalMoves(state);

    if (moves.length === 0) {
      if (Chess.isInCheck(state.board, state.turn)) {
        return -999999 + (3 - depth); // checkmate — prefer faster
      }
      return 0; // stalemate
    }

    const ordered = orderMoves(state, moves);

    for (const move of ordered) {
      const newState = Chess.applyMove(state, move);
      const score = -negamax(newState, depth - 1, -beta, -alpha, -color);
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }

    return alpha;
  }

  // ── Get best move ──

  function getBestMove(state, maxDepth = 2) {
    const moves = Chess.getAllLegalMoves(state);

    if (moves.length === 0) return null;
    if (moves.length === 1) return moves[0];

    const ordered = orderMoves(state, moves);
    const color = state.turn === Chess.WHITE ? 1 : -1;
    let bestMove = ordered[0];
    let bestScore = -Infinity;

    for (const move of ordered) {
      const newState = Chess.applyMove(state, move);
      const score = -negamax(newState, maxDepth - 1, -Infinity, Infinity, -color);

      // For easy mode (depth 1), add noise
      const noise = maxDepth === 1 ? Math.random() * 50 : 0;
      const finalScore = score + noise;

      if (finalScore > bestScore) {
        bestScore = finalScore;
        bestMove = move;
      }
    }

    return bestMove;
  }

  // ── Public API ──

  return {
    getBestMove,
    scoreMove,
    orderMoves,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AI;
}
