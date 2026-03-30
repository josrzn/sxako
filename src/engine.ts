import { GameState, PieceType } from './types';
import type { Position } from './types';
import { allLegalMoves, makeMove, getStatus } from './game';

// ---------------------------------------------------------------------------
// Material values (centipawns)
// ---------------------------------------------------------------------------

const PIECE_VALUE: Record<PieceType, number> = {
  pawn:   100,
  knight: 300,
  bishop: 325,
  rook:   500,
  queen:  900,
  king:  20000,
};

// ---------------------------------------------------------------------------
// Piece-square tables
// Row 0 = rank 5 (top / black's back rank), row 4 = rank 1 (bottom / white's).
// Written from White's perspective; Black's pieces use the vertically-mirrored row.
// ---------------------------------------------------------------------------

const PST: Record<PieceType, number[][]> = {
  pawn: [
    [  0,   0,   0,   0,   0],  // rank 5 — promotion rank (already promoted)
    [ 80,  80,  80,  80,  80],  // rank 4 — one step from queening
    [ 30,  30,  40,  40,  30],  // rank 3
    [  5,   5,  10,  10,   5],  // rank 2 — starting rank
    [  0,   0,   0,   0,   0],  // rank 1 — unreachable for a pawn
  ],
  knight: [
    [-50, -40, -30, -40, -50],
    [-40, -20,   0, -20, -40],
    [-30,   0,  20,   0, -30],
    [-30,   5,  20,   5, -30],
    [-50, -40, -30, -40, -50],
  ],
  bishop: [
    [-20, -10, -10, -10, -20],
    [-10,   5,   0,   5, -10],
    [-10,  10,  10,  10, -10],
    [-10,   5,   5,   5, -10],
    [-20, -10, -10, -10, -20],
  ],
  rook: [
    [  0,   0,   0,   0,   0],
    [  5,  10,  10,  10,   5],
    [ -5,   0,   0,   0,  -5],
    [ -5,   0,   0,   0,  -5],
    [  0,   0,   5,  10,  -5],
  ],
  queen: [
    [-20, -10,  -5,  -5, -20],
    [-10,   0,   5,   0, -10],
    [ -5,   5,  10,   5,  -5],
    [ -5,   0,   5,   5,  -5],
    [-20, -10,  -5,  -5, -20],
  ],
  king: [
    [-30, -40, -50, -40, -30],
    [-30, -40, -50, -40, -30],
    [-20, -30, -40, -30, -20],
    [-10, -20, -30, -20, -10],
    [ 20,  30,   0,  30,  20],  // safety bonus on back rank / after castling
  ],
};

// ---------------------------------------------------------------------------
// Static evaluation (positive = White advantage)
// ---------------------------------------------------------------------------

function evaluate(state: GameState): number {
  let score = 0;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const p = state.board[r][c];
      if (!p) continue;
      const pstRow = p.color === 'white' ? r : 4 - r;
      const bonus  = PIECE_VALUE[p.type] + PST[p.type][pstRow][c];
      score += p.color === 'white' ? bonus : -bonus;
    }
  }
  return score;
}

// ---------------------------------------------------------------------------
// Move ordering — MVV-LVA (Most Valuable Victim / Least Valuable Attacker)
// ---------------------------------------------------------------------------

function mvvLva(state: GameState, from: Position, to: Position): number {
  const victim   = state.board[to.row][to.col];
  const attacker = state.board[from.row][from.col];
  if (!victim) return 0;
  return PIECE_VALUE[victim.type] * 10 - (attacker ? PIECE_VALUE[attacker.type] : 0);
}

function sortMoves(
  state: GameState,
  moves: Array<{ from: Position; to: Position }>,
): Array<{ from: Position; to: Position }> {
  return [...moves].sort((a, b) => mvvLva(state, b.from, b.to) - mvvLva(state, a.from, a.to));
}

// ---------------------------------------------------------------------------
// Alpha-beta search
// ---------------------------------------------------------------------------

function search(state: GameState, depth: number, alpha: number, beta: number): number {
  const status = getStatus(state);
  if (status === 'checkmate') {
    // Prefer quicker checkmates: reward depth remaining
    return state.currentTurn === 'white' ? -99000 - depth : 99000 + depth;
  }
  if (status === 'stalemate') return 0;
  if (depth === 0) return evaluate(state);

  const moves = sortMoves(state, allLegalMoves(state));

  if (state.currentTurn === 'white') {
    let best = -Infinity;
    for (const { from, to } of moves) {
      const next = makeMove(state, from, to, 'queen'); // engine always promotes to queen
      if (!next) continue;
      best  = Math.max(best, search(next, depth - 1, alpha, beta));
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break; // β-cutoff
    }
    return best;
  } else {
    let best = Infinity;
    for (const { from, to } of moves) {
      const next = makeMove(state, from, to, 'queen');
      if (!next) continue;
      best = Math.min(best, search(next, depth - 1, alpha, beta));
      beta = Math.min(beta, best);
      if (beta <= alpha) break; // α-cutoff
    }
    return best;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getBestMove(
  state: GameState,
  depth = 4,
): { from: Position; to: Position } | null {
  const moves = sortMoves(state, allLegalMoves(state));
  if (moves.length === 0) return null;

  const maximising = state.currentTurn === 'white';
  let bestMove  = moves[0];
  let bestScore = maximising ? -Infinity : Infinity;

  for (const { from, to } of moves) {
    const next = makeMove(state, from, to, 'queen');
    if (!next) continue;
    const score = search(next, depth - 1, -Infinity, Infinity);
    if (maximising ? score > bestScore : score < bestScore) {
      bestScore = score;
      bestMove  = { from, to };
    }
  }

  return bestMove;
}
