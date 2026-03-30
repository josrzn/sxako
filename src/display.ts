import { Color, PieceType, GameState } from './types';
import { getStatus, posToStr, SIZE } from './game';

const GLYPH: Record<Color, Record<PieceType, string>> = {
  white: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' },
  black: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' },
};

const LABEL: Record<PieceType, string> = {
  king: 'K', queen: 'Q', rook: 'R', bishop: 'B', knight: 'N', pawn: 'P',
};

// Square backgrounds: classic wood tones
const BG_LIGHT = '\x1b[48;5;179m'; // warm sand / light wood
const BG_DARK  = '\x1b[48;5;94m';  // dark walnut
const RESET    = '\x1b[0m';

// Piece colours: cyan (white side) vs red (black side) — both visible on any square
const FG_WHITE = '\x1b[1;96m';  // bold bright cyan
const FG_BLACK = '\x1b[1;91m';  // bold bright red
const FG_DIM   = '\x1b[2;37m';  // dim grey for label row

function squareBg(row: number, col: number): string {
  return (row + col) % 2 === 0 ? BG_LIGHT : BG_DARK;
}

export function renderBoard(state: GameState): string {
  const { board } = state;
  const lines: string[] = [];
  const SEP = '  +-----+-----+-----+-----+-----+';

  lines.push('');
  lines.push('      a     b     c     d     e  ');
  lines.push(SEP);

  for (let row = 0; row < SIZE; row++) {
    const rank = SIZE - row;

    // Top line: glyph
    let glyphLine = `${rank} |`;
    // Bottom line: dim letter label
    let labelLine = `  |`;

    for (let col = 0; col < SIZE; col++) {
      const piece = board[row][col];
      const bg = squareBg(row, col);
      if (piece) {
        const fg    = piece.color === 'white' ? FG_WHITE : FG_BLACK;
        const glyph = GLYPH[piece.color][piece.type];
        const lbl   = (piece.color === 'white' ? LABEL[piece.type] : LABEL[piece.type].toLowerCase());
        glyphLine += `${bg}${fg}  ${glyph}  ${RESET}|`;
        labelLine += `${bg}${FG_DIM}  ${lbl}  ${RESET}|`;
      } else {
        glyphLine += `${bg}     ${RESET}|`;
        labelLine += `${bg}     ${RESET}|`;
      }
    }

    glyphLine += ` ${rank}`;
    lines.push(glyphLine);
    lines.push(labelLine);
    lines.push(SEP);
  }

  lines.push('      a     b     c     d     e  ');
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
    '\x1b[1mPieces:\x1b[0m  K/k King  Q/q Queen  R/r Rook  B/b Bishop  N/n Knight  P/p Pawn',
    '  Each square shows the Unicode glyph + a letter label underneath for clarity.',
    '  \x1b[1;96mCyan = White side\x1b[0m,  \x1b[1;91mRed = Black side\x1b[0m',
    '',
  ].join('\n');
}
