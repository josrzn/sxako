import { Color, PieceType, GameState } from './types';
import { getStatus, posToStr, SIZE } from './game';

const GLYPH: Record<Color, Record<PieceType, string>> = {
  white: { king: 'K', queen: 'Q', rook: 'R', bishop: 'B', knight: 'N', pawn: 'P' },
  black: { king: 'k', queen: 'q', rook: 'r', bishop: 'b', knight: 'n', pawn: 'p' },
};

// Square backgrounds: amber light / rich brown dark
const BG_LIGHT = '\x1b[48;5;222m'; // amber
const BG_DARK  = '\x1b[48;5;130m'; // rich brown
const RESET    = '\x1b[0m';

// Piece colours: bright white vs bright blue — both pop on warm amber/brown
const FG_WHITE = '\x1b[1;97m';  // bold bright white
const FG_BLACK = '\x1b[1;94m';  // bold bright blue

function squareBg(row: number, col: number): string {
  return (row + col) % 2 === 0 ? BG_LIGHT : BG_DARK;
}

export function renderBoard(state: GameState): string {
  const { board } = state;
  const lines: string[] = [];

  lines.push('');
  lines.push('    a   b   c   d   e  ');
  lines.push('  +---+---+---+---+---+');

  for (let row = 0; row < SIZE; row++) {
    const rank = SIZE - row;
    let line = `${rank} |`;
    for (let col = 0; col < SIZE; col++) {
      const piece = board[row][col];
      const bg = squareBg(row, col);
      if (piece) {
        const fg = piece.color === 'white' ? FG_WHITE : FG_BLACK;
        const ch = GLYPH[piece.color][piece.type];
        line += `${bg}${fg} ${ch} ${RESET}|`;
      } else {
        line += `${bg}   ${RESET}|`;
      }
    }
    line += ` ${rank}`;
    lines.push(line);
    lines.push('  +---+---+---+---+---+');
  }

  lines.push('    a   b   c   d   e  ');
  lines.push('');
  return lines.join('\n');
}

export function renderStatus(state: GameState): string {
  const status = getStatus(state);
  const turn = state.currentTurn === 'white' ? 'White' : 'Black';
  const moveNum = Math.ceil(state.moveHistory.length / 2);

  switch (status) {
    case 'checkmate': {
      const winner = state.currentTurn === 'white' ? 'Black' : 'White';
      return `\x1b[1;31mCheckmate!\x1b[0m ${winner} wins.`;
    }
    case 'stalemate':
      return `\x1b[1;33mStalemate!\x1b[0m Draw.`;
    case 'check':
      return `\x1b[1;31m${turn} is in check.\x1b[0m Move ${moveNum + 1} — ${turn} to move.`;
    default:
      return `Move ${moveNum + 1} — \x1b[1m${turn}\x1b[0m to move.`;
  }
}

export function renderHistory(state: GameState): string {
  if (state.moveHistory.length === 0) return '';
  const pairs: string[] = [];
  for (let i = 0; i < state.moveHistory.length; i += 2) {
    const n = Math.floor(i / 2) + 1;
    const w = state.moveHistory[i];
    const b = state.moveHistory[i + 1] ?? '';
    pairs.push(`${n}. ${w.padEnd(10)} ${b}`);
  }
  return '\nMove history:\n' + pairs.join('\n');
}

export function renderHelp(): string {
  return [
    '',
    '\x1b[1mCommands:\x1b[0m',
    '  <from><to>       Move a piece, e.g. \x1b[33md2d3\x1b[0m or \x1b[33md2 d3\x1b[0m',
    '  <from><to>=<p>   Promote a pawn, e.g. \x1b[33ma4a5=q\x1b[0m  (q r b n — default: q)',
    '  O-O-O            Queenside castling (when legal)',
    '  moves <sq>       Show legal moves for a piece, e.g. \x1b[33mmoves d2\x1b[0m',
    '  board            Redraw the board',
    '  history          Show move history',
    '  help             Show this help',
    '  quit / exit      Quit the game',
    '',
    '\x1b[1mPiece symbols:\x1b[0m  K/k King  Q/q Queen  R/r Rook  B/b Bishop  N/n Knight  P/p Pawn',
    '  uppercase = White,  lowercase = Black',
    '',
  ].join('\n');
}
