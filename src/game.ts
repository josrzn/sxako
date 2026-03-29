import { Color, PieceType, Piece, Board, Position, CastlingRights, GameState, GameStatus } from './types';

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
    board[0][col] = { type: BACK_RANK[col], color: 'black' };
  }
  return board;
}

export function createInitialState(): GameState {
  return {
    board: createInitialBoard(),
    currentTurn: 'white',
    castlingRights: { white: true, black: true },
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
// ---------------------------------------------------------------------------

function pseudoLegal(board: Board, pos: Position): Position[] {
  const piece = board[pos.row][pos.col];
  if (!piece) return [];

  const { row, col, } = pos;
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
        const moves = pseudoLegal(board, { row: r, col: c });
        if (moves.some(m => m.row === pos.row && m.col === pos.col)) return true;
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
//                R   N   Q   K   B
// Queens-side castling (both colours):
//   King d→b  (col 3 → col 1),  Rook a→c  (col 0 → col 2)
//   Squares b and c (cols 1, 2) must be vacant.
//   King must not be in check on d, c, or b.
// ---------------------------------------------------------------------------

function castlingTarget(color: Color): number {
  return color === 'white' ? 4 : 0; // back-rank row
}

function queensideCastlingMove(state: GameState): Position | null {
  const { board, currentTurn, castlingRights } = state;
  if (!castlingRights[currentTurn]) return null;

  const row = castlingTarget(currentTurn);
  const kingPiece = board[row][3];
  const rookPiece = board[row][0];

  if (!kingPiece || kingPiece.type !== 'king' || kingPiece.color !== currentTurn) return null;
  if (!rookPiece || rookPiece.type !== 'rook' || rookPiece.color !== currentTurn) return null;

  // Squares b and c must be empty
  if (board[row][1] || board[row][2]) return null;

  const opp: Color = currentTurn === 'white' ? 'black' : 'white';

  // King must not be in check on its current square, on c (passing through), or on b (landing)
  if (isAttacked(board, { row, col: 3 }, opp)) return null;
  if (isAttacked(board, { row, col: 2 }, opp)) return null;

  // Check landing square after moving king
  const afterCastle = cloneBoard(board);
  afterCastle[row][1] = { type: 'king', color: currentTurn };
  afterCastle[row][2] = { type: 'rook', color: currentTurn };
  afterCastle[row][3] = null;
  afterCastle[row][0] = null;
  if (isAttacked(afterCastle, { row, col: 1 }, opp)) return null;

  return { row, col: 1 }; // king's destination
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

  // Append castling destination for king
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
        for (const to of getLegalMoves(state, from)) {
          moves.push({ from, to });
        }
      }
    }
  }
  return moves;
}

// ---------------------------------------------------------------------------
// Move execution
// ---------------------------------------------------------------------------

const PIECE_LETTER: Record<PieceType, string> = {
  king: 'K', queen: 'Q', rook: 'R', bishop: 'B', knight: 'N',
};

export function makeMove(state: GameState, from: Position, to: Position): GameState | null {
  const piece = state.board[from.row][from.col];
  if (!piece || piece.color !== state.currentTurn) return null;

  const legal = getLegalMoves(state, from);
  if (!legal.some(m => m.row === to.row && m.col === to.col)) return null;

  const newCR: CastlingRights = { ...state.castlingRights };
  let newBoard = cloneBoard(state.board);
  let notation: string;

  // Detect queenside castling: king moves from col 3 to col 1
  const row = castlingTarget(state.currentTurn);
  const isCastle = piece.type === 'king' && from.col === 3 && to.col === 1 && from.row === row;

  if (isCastle) {
    newBoard[row][1] = { type: 'king', color: state.currentTurn };
    newBoard[row][2] = { type: 'rook', color: state.currentTurn };
    newBoard[row][3] = null;
    newBoard[row][0] = null;
    notation = 'O-O-O';
    newCR[state.currentTurn] = false;
  } else {
    const captured = state.board[to.row][to.col];
    newBoard = applyMove(state.board, from, to);

    const sep = captured ? 'x' : '-';
    notation = PIECE_LETTER[piece.type] + posToStr(from) + sep + posToStr(to);

    // Lose castling rights when king or rook moves
    if (piece.type === 'king') newCR[state.currentTurn] = false;
    if (piece.type === 'rook' && from.col === 0 && from.row === row) newCR[state.currentTurn] = false;

    // Lose castling rights when rook is captured on its starting square
    if (captured && captured.type === 'rook') {
      const opp: Color = state.currentTurn === 'white' ? 'black' : 'white';
      const oppRow = castlingTarget(opp);
      if (to.row === oppRow && to.col === 0) newCR[opp] = false;
    }
  }

  const nextTurn: Color = state.currentTurn === 'white' ? 'black' : 'white';

  return {
    board: newBoard,
    currentTurn: nextTurn,
    castlingRights: newCR,
    moveHistory: [...state.moveHistory, notation],
  };
}

// ---------------------------------------------------------------------------
// Game status
// ---------------------------------------------------------------------------

export function getStatus(state: GameState): GameStatus {
  const moves = allLegalMoves(state);
  const inCheck = isInCheck(state.board, state.currentTurn);

  if (moves.length === 0) return inCheck ? 'checkmate' : 'stalemate';
  return inCheck ? 'check' : 'playing';
}
