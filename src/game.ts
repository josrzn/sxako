import { Color, PieceType, Board, Position, CastlingRights, GameState, GameStatus } from './types';

export const SIZE = 5;

// ---------------------------------------------------------------------------
// Board initialisation
// ---------------------------------------------------------------------------

// Back-rank order (left→right, files a–e):  R  N  Q  K  B
// White occupies row 4 (rank 1); black mirrors identically on row 0 (rank 5).
// Both kings sit on file d (col 3), both rooks on file a (col 0).
const BACK_RANK: PieceType[] = ['rook', 'knight', 'queen', 'king', 'bishop'];

export function createInitialBoard(): Board {
  const board: Board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  for (let col = 0; col < SIZE; col++) {
    board[4][col] = { type: BACK_RANK[col], color: 'white' };
    board[3][col] = { type: 'pawn',          color: 'white' }; // rank 2
    board[1][col] = { type: 'pawn',          color: 'black' }; // rank 4
    board[0][col] = { type: BACK_RANK[col], color: 'black' };
  }
  return board;
}

export function createInitialState(): GameState {
  return {
    board: createInitialBoard(),
    currentTurn: 'white',
    castlingRights: { white: true, black: true },
    enPassantTarget: null,
    moveHistory: [],
  };
}

// ---------------------------------------------------------------------------
// Coordinate helpers
// ---------------------------------------------------------------------------

export function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < SIZE && col >= 0 && col < SIZE;
}

/** "d1" → { row: 4, col: 3 }   |   "b5" → { row: 0, col: 1 } */
export function parsePosition(s: string): Position | null {
  if (s.length !== 2) return null;
  const col = s.charCodeAt(0) - 97; // 'a' = 97
  const rank = parseInt(s[1], 10);
  if (isNaN(rank) || col < 0 || col >= SIZE || rank < 1 || rank > SIZE) return null;
  return { row: SIZE - rank, col };
}

/** { row: 4, col: 3 } → "d1" */
export function posToStr(pos: Position): string {
  return String.fromCharCode(97 + pos.col) + (SIZE - pos.row);
}

// ---------------------------------------------------------------------------
// Board utilities
// ---------------------------------------------------------------------------

export function cloneBoard(board: Board): Board {
  return board.map(row => [...row]);
}

function applyMove(board: Board, from: Position, to: Position): Board {
  const b = cloneBoard(board);
  b[to.row][to.col] = b[from.row][from.col];
  b[from.row][from.col] = null;
  return b;
}

export function findKing(board: Board, color: Color): Position | null {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const p = board[r][c];
      if (p && p.type === 'king' && p.color === color) return { row: r, col: c };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Pseudo-legal move generation (ignores leaving own king in check)
//
// forAttack = true  →  return squares the piece *attacks* (used by isAttacked).
//                      For pawns this means diagonals only, unconditionally.
// forAttack = false →  return squares the piece can legally *move to*
//                      (pawns: forward pushes + diagonal captures if occupied).
//                      En-passant squares are handled separately in getLegalMoves.
// ---------------------------------------------------------------------------

function pseudoLegal(board: Board, pos: Position, forAttack = false): Position[] {
  const piece = board[pos.row][pos.col];
  if (!piece) return [];

  const { row, col } = pos;
  const { type, color } = piece;
  const result: Position[] = [];

  const push = (r: number, c: number) => {
    if (!inBounds(r, c)) return;
    const target = board[r][c];
    if (!target || target.color !== color) result.push({ row: r, col: c });
  };

  const slide = (dr: number, dc: number) => {
    let r = row + dr, c = col + dc;
    while (inBounds(r, c)) {
      const target = board[r][c];
      if (target) {
        if (target.color !== color) result.push({ row: r, col: c });
        break;
      }
      result.push({ row: r, col: c });
      r += dr; c += dc;
    }
  };

  switch (type) {
    case 'rook':
      slide(1, 0); slide(-1, 0); slide(0, 1); slide(0, -1);
      break;

    case 'bishop':
      slide(1, 1); slide(1, -1); slide(-1, 1); slide(-1, -1);
      break;

    case 'queen':
      slide(1, 0); slide(-1, 0); slide(0, 1); slide(0, -1);
      slide(1, 1); slide(1, -1); slide(-1, 1); slide(-1, -1);
      break;

    case 'knight':
      for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
        push(row + dr, col + dc);
      }
      break;

    case 'king':
      for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
        push(row + dr, col + dc);
      }
      break;

    case 'pawn': {
      // White moves up (dir = -1), black moves down (dir = +1).
      const dir      = color === 'white' ? -1 : 1;
      const startRow = color === 'white' ? 3  : 1;

      if (forAttack) {
        // Attack squares = the two diagonals, regardless of occupancy.
        for (const dc of [-1, 1]) {
          if (inBounds(row + dir, col + dc)) result.push({ row: row + dir, col: col + dc });
        }
      } else {
        // Forward push(es) — only onto empty squares.
        const fwd = row + dir;
        if (inBounds(fwd, col) && !board[fwd][col]) {
          result.push({ row: fwd, col });
          if (row === startRow) {
            const fwd2 = row + 2 * dir;
            if (inBounds(fwd2, col) && !board[fwd2][col]) result.push({ row: fwd2, col });
          }
        }
        // Diagonal captures — only onto occupied enemy squares (en passant added later).
        for (const dc of [-1, 1]) {
          const cr = row + dir, cc = col + dc;
          if (inBounds(cr, cc)) {
            const t = board[cr][cc];
            if (t && t.color !== color) result.push({ row: cr, col: cc });
          }
        }
      }
      break;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Attack / check detection
// ---------------------------------------------------------------------------

export function isAttacked(board: Board, pos: Position, byColor: Color): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const p = board[r][c];
      if (p && p.color === byColor) {
        // Use forAttack=true so pawn diagonals are checked unconditionally.
        if (pseudoLegal(board, { row: r, col: c }, true)
              .some(m => m.row === pos.row && m.col === pos.col)) return true;
      }
    }
  }
  return false;
}

export function isInCheck(board: Board, color: Color): boolean {
  const king = findKing(board, color);
  if (!king) return false;
  const opp: Color = color === 'white' ? 'black' : 'white';
  return isAttacked(board, king, opp);
}

// ---------------------------------------------------------------------------
// Castling
// ---------------------------------------------------------------------------
// Layout:  col  0   1   2   3   4
//                R  [p]  [p]  K   B    (after pawns placed)
// Queens-side castling: King d→b (col 3→1), Rook a→c (col 0→2).
// b and c must be empty; king may not pass through or land in check.
// ---------------------------------------------------------------------------

function backRankRow(color: Color): number {
  return color === 'white' ? 4 : 0;
}

function queensideCastlingMove(state: GameState): Position | null {
  const { board, currentTurn, castlingRights } = state;
  if (!castlingRights[currentTurn]) return null;

  const row = backRankRow(currentTurn);
  const kingPiece = board[row][3];
  const rookPiece = board[row][0];

  if (!kingPiece || kingPiece.type !== 'king' || kingPiece.color !== currentTurn) return null;
  if (!rookPiece || rookPiece.type !== 'rook' || rookPiece.color !== currentTurn) return null;

  if (board[row][1] || board[row][2]) return null; // b and c must be vacant

  const opp: Color = currentTurn === 'white' ? 'black' : 'white';

  if (isAttacked(board, { row, col: 3 }, opp)) return null; // king in check
  if (isAttacked(board, { row, col: 2 }, opp)) return null; // transit square attacked

  // Verify landing square is safe after the full castle.
  const after = cloneBoard(board);
  after[row][1] = { type: 'king', color: currentTurn };
  after[row][2] = { type: 'rook', color: currentTurn };
  after[row][3] = null;
  after[row][0] = null;
  if (isAttacked(after, { row, col: 1 }, opp)) return null;

  return { row, col: 1 };
}

// ---------------------------------------------------------------------------
// Legal move generation
// ---------------------------------------------------------------------------

export function getLegalMoves(state: GameState, pos: Position): Position[] {
  const piece = state.board[pos.row][pos.col];
  if (!piece || piece.color !== state.currentTurn) return [];

  const legal = pseudoLegal(state.board, pos).filter(to => {
    const b = applyMove(state.board, pos, to);
    return !isInCheck(b, piece.color);
  });

  // En passant for pawns.
  if (piece.type === 'pawn' && state.enPassantTarget) {
    const ep  = state.enPassantTarget;
    const dir = piece.color === 'white' ? -1 : 1;
    if (ep.row === pos.row + dir && Math.abs(ep.col - pos.col) === 1) {
      // Simulate: move our pawn to ep, remove captured pawn (same row, ep col).
      const testBoard = cloneBoard(state.board);
      testBoard[ep.row][ep.col]  = piece;
      testBoard[pos.row][pos.col] = null;
      testBoard[pos.row][ep.col]  = null; // captured pawn
      if (!isInCheck(testBoard, piece.color)) legal.push(ep);
    }
  }

  // Queenside castling destination for king.
  if (piece.type === 'king') {
    const castleTo = queensideCastlingMove(state);
    if (castleTo) legal.push(castleTo);
  }

  return legal;
}

export function allLegalMoves(state: GameState): Array<{ from: Position; to: Position }> {
  const moves: Array<{ from: Position; to: Position }> = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const p = state.board[r][c];
      if (p && p.color === state.currentTurn) {
        const from = { row: r, col: c };
        for (const to of getLegalMoves(state, from)) moves.push({ from, to });
      }
    }
  }
  return moves;
}

// ---------------------------------------------------------------------------
// Move execution
// ---------------------------------------------------------------------------

const PIECE_LETTER: Record<PieceType, string> = {
  king: 'K', queen: 'Q', rook: 'R', bishop: 'B', knight: 'N', pawn: 'P',
};

export function makeMove(
  state: GameState,
  from: Position,
  to: Position,
  promoteTo: PieceType = 'queen',
): GameState | null {
  const piece = state.board[from.row][from.col];
  if (!piece || piece.color !== state.currentTurn) return null;

  const legal = getLegalMoves(state, from);
  if (!legal.some(m => m.row === to.row && m.col === to.col)) return null;

  const newCR: CastlingRights = { ...state.castlingRights };
  let newBoard = cloneBoard(state.board);
  let notation: string;
  let newEP: Position | null = null;

  // ── Queenside castling ────────────────────────────────────────────────────
  const row = backRankRow(state.currentTurn);
  const isCastle = piece.type === 'king' && from.col === 3 && to.col === 1 && from.row === row;

  if (isCastle) {
    newBoard[row][1] = { type: 'king', color: state.currentTurn };
    newBoard[row][2] = { type: 'rook', color: state.currentTurn };
    newBoard[row][3] = null;
    newBoard[row][0] = null;
    notation = 'O-O-O';
    newCR[state.currentTurn] = false;

  } else {
    // ── En passant ──────────────────────────────────────────────────────────
    const isEP = piece.type === 'pawn'
      && state.enPassantTarget !== null
      && to.row === state.enPassantTarget.row
      && to.col === state.enPassantTarget.col
      && state.board[to.row][to.col] === null; // moving to empty square diagonally

    newBoard = applyMove(state.board, from, to);
    if (isEP) newBoard[from.row][to.col] = null; // remove the captured pawn

    // ── Promotion ───────────────────────────────────────────────────────────
    const isPromotion = piece.type === 'pawn' && (to.row === 0 || to.row === SIZE - 1);
    if (isPromotion) newBoard[to.row][to.col] = { type: promoteTo, color: state.currentTurn };

    // ── Notation ────────────────────────────────────────────────────────────
    const captured = isEP || state.board[to.row][to.col] !== null;
    const sep = captured ? 'x' : '-';
    notation = PIECE_LETTER[piece.type] + posToStr(from) + sep + posToStr(to);
    if (isPromotion) notation += `=${PIECE_LETTER[promoteTo]}`;
    if (isEP) notation += ' e.p.';

    // ── Castling-rights bookkeeping ─────────────────────────────────────────
    if (piece.type === 'king') newCR[state.currentTurn] = false;
    if (piece.type === 'rook' && from.col === 0 && from.row === row) newCR[state.currentTurn] = false;

    const capturedPiece = state.board[to.row][to.col];
    if (capturedPiece && capturedPiece.type === 'rook') {
      const opp: Color = state.currentTurn === 'white' ? 'black' : 'white';
      const oppRow = backRankRow(opp);
      if (to.row === oppRow && to.col === 0) newCR[opp] = false;
    }

    // ── En-passant target for next move ─────────────────────────────────────
    if (piece.type === 'pawn' && Math.abs(to.row - from.row) === 2) {
      newEP = { row: (from.row + to.row) / 2, col: from.col };
    }
  }

  const nextTurn: Color = state.currentTurn === 'white' ? 'black' : 'white';

  return {
    board: newBoard,
    currentTurn: nextTurn,
    castlingRights: newCR,
    enPassantTarget: newEP,
    moveHistory: [...state.moveHistory, notation],
  };
}

// ---------------------------------------------------------------------------
// Game status
// ---------------------------------------------------------------------------

export function getStatus(state: GameState): GameStatus {
  const moves   = allLegalMoves(state);
  const inCheck = isInCheck(state.board, state.currentTurn);

  if (moves.length === 0) return inCheck ? 'checkmate' : 'stalemate';
  return inCheck ? 'check' : 'playing';
}
