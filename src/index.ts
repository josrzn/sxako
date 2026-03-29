import * as readline from 'readline';
import {
  createInitialState,
  getLegalMoves,
  makeMove,
  getStatus,
  parsePosition,
  posToStr,
  SIZE,
} from './game';
import { renderBoard, renderStatus, renderHistory, renderHelp } from './display';
import { GameState, PieceType, Position } from './types';

// ---------------------------------------------------------------------------
// Parse a move command into { from, to } or detect castling / special tokens
// ---------------------------------------------------------------------------

const PROMO_MAP: Record<string, PieceType> = {
  q: 'queen', r: 'rook', b: 'bishop', n: 'knight',
};

function parseMove(input: string, state: GameState): { from: Position; to: Position; promoteTo: PieceType } | null {
  const s = input.trim();

  // Castling notation
  if (s === 'O-O-O' || s === '0-0-0') {
    const row = state.currentTurn === 'white' ? 4 : 0;
    return { from: { row, col: 3 }, to: { row, col: 1 }, promoteTo: 'queen' };
  }

  // Strip spaces and dashes, then optional promotion suffix: "d2d3" / "a4b5=q" / "a4b5q"
  const clean = s.replace(/[\s\-]/g, '');
  // Match: <from(2)><to(2)>[=?<piece>]
  const m = clean.match(/^([a-e][1-5])([a-e][1-5])(?:=?([qrbn]))?$/i);
  if (m) {
    const from = parsePosition(m[1]);
    const to   = parsePosition(m[2]);
    if (from && to) {
      const promoteTo: PieceType = m[3] ? (PROMO_MAP[m[3].toLowerCase()] ?? 'queen') : 'queen';
      return { from, to, promoteTo };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main game loop
// ---------------------------------------------------------------------------

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  // Buffer incoming lines so fast piped input is never lost between rl.question calls.
  const lineQueue: string[] = [];
  let lineWaiter: ((line: string) => void) | null = null;
  let closed = false;

  rl.on('line', line => {
    if (lineWaiter) {
      const fn = lineWaiter;
      lineWaiter = null;
      fn(line);
    } else {
      lineQueue.push(line);
    }
  });

  rl.on('close', () => { closed = true; if (lineWaiter) { const fn = lineWaiter; lineWaiter = null; fn(''); } });

  const prompt = (msg: string): Promise<string> => {
    process.stdout.write(msg);
    if (lineQueue.length > 0) return Promise.resolve(lineQueue.shift()!);
    if (closed) return Promise.resolve('');
    return new Promise(resolve => { lineWaiter = resolve; });
  };

  console.log('\x1b[1;32m');
  console.log('  ███████╗██╗  ██╗ █████╗ ██╗  ██╗ ██████╗ ');
  console.log('  ██╔════╝╚██╗██╔╝██╔══██╗██║ ██╔╝██╔═══██╗');
  console.log('  ███████╗ ╚███╔╝ ███████║█████╔╝ ██║   ██║');
  console.log('  ╚════██║ ██╔██╗ ██╔══██║██╔═██╗ ██║   ██║');
  console.log('  ███████║██╔╝ ██╗██║  ██║██║  ██╗╚██████╔╝');
  console.log('  ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ');
  console.log('\x1b[0m');
  console.log('  5×5 Chess  —  Rook · Knight · Queen · King · Bishop + 5 Pawns per side');
  console.log('  Queenside castling available  (King d→b, Rook a→c)');
  console.log(renderHelp());

  let state = createInitialState();

  console.log(renderBoard(state));
  console.log(renderStatus(state));

  while (true) {
    const status = getStatus(state);

    if (status === 'checkmate' || status === 'stalemate') {
      console.log(renderBoard(state));
      console.log(renderStatus(state));
      if (state.moveHistory.length > 0) console.log(renderHistory(state));
      break;
    }

    let raw: string;
    try {
      raw = await prompt('\n> ');
    } catch {
      break; // EOF / Ctrl-D
    }

    const cmd = raw.trim().toLowerCase();

    if (cmd === '' ) continue;
    if (cmd === 'quit' || cmd === 'exit') {
      console.log('Goodbye!');
      break;
    }
    if (cmd === 'help') {
      console.log(renderHelp());
      continue;
    }
    if (cmd === 'board') {
      console.log(renderBoard(state));
      console.log(renderStatus(state));
      continue;
    }
    if (cmd === 'history') {
      console.log(renderHistory(state) || 'No moves yet.');
      continue;
    }

    // "moves <square>"
    const movesMatch = cmd.match(/^moves?\s+([a-e][1-5])$/);
    if (movesMatch) {
      const pos = parsePosition(movesMatch[1]);
      if (!pos) { console.log('Invalid square.'); continue; }
      const piece = state.board[pos.row][pos.col];
      if (!piece) { console.log(`No piece on ${movesMatch[1]}.`); continue; }
      if (piece.color !== state.currentTurn) {
        console.log(`That is a ${piece.color} piece; it is ${state.currentTurn}'s turn.`);
        continue;
      }
      const legal = getLegalMoves(state, pos);
      if (legal.length === 0) {
        console.log(`No legal moves for the piece on ${movesMatch[1]}.`);
      } else {
        const targets = legal.map(posToStr).sort().join('  ');
        console.log(`Legal moves for ${piece.color} ${piece.type} on ${movesMatch[1]}:  ${targets}`);
      }
      continue;
    }

    // Move input (also accept uppercase O-O-O as typed)
    const moveInput = raw.trim();
    const parsed = parseMove(moveInput, state);
    if (!parsed) {
      console.log('Unrecognised command. Type \x1b[33mhelp\x1b[0m for instructions.');
      continue;
    }

    const { from, to } = parsed;
    const piece = state.board[from.row]?.[from.col];
    if (!piece) {
      console.log(`No piece on ${posToStr(from)}.`);
      continue;
    }
    if (piece.color !== state.currentTurn) {
      console.log(`It is ${state.currentTurn}'s turn.`);
      continue;
    }

    const next = makeMove(state, from, to, parsed.promoteTo);
    if (!next) {
      const legal = getLegalMoves(state, from);
      if (legal.length === 0) {
        console.log(`The ${piece.type} on ${posToStr(from)} has no legal moves.`);
      } else {
        const targets = legal.map(posToStr).sort().join('  ');
        console.log(`Illegal move. Legal moves for this piece: ${targets}`);
      }
      continue;
    }

    state = next;
    const lastMove = state.moveHistory[state.moveHistory.length - 1];
    console.log(`\nPlayed: \x1b[33m${lastMove}\x1b[0m`);
    console.log(renderBoard(state));
    console.log(renderStatus(state));
  }

  rl.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
