export type Color = 'white' | 'black';
export type PieceType = 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn';

export interface Piece {
  type: PieceType;
  color: Color;
}

export type Board = (Piece | null)[][];

export interface Position {
  row: number; // 0 = rank 5 (top/black), 4 = rank 1 (bottom/white)
  col: number; // 0 = file a (left),      4 = file e (right)
}

export interface CastlingRights {
  white: boolean; // white queenside (Ra1 + Kd1)
  black: boolean; // black queenside (Ra5 + Kd5)
}

export interface GameState {
  board: Board;
  currentTurn: Color;
  castlingRights: CastlingRights;
  enPassantTarget: Position | null; // square a pawn can capture into via en passant
  moveHistory: string[];
}

export type GameStatus = 'playing' | 'check' | 'checkmate' | 'stalemate';
