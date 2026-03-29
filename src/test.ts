/**
 * Quick engine smoke-tests – run with:  npx ts-node src/test.ts
 */
import { createInitialState, makeMove, getStatus, cloneBoard, isInCheck } from './game';
import { GameState } from './types';

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean) {
  if (condition) { console.log(`  ✓  ${label}`); passed++; }
  else           { console.error(`  ✗  ${label}`); failed++; }
}

// Helper: apply a sequence of moves given as "a2a3" strings, with optional
// promotion suffix already embedded in the string.
function playLine(moves: string[]): GameState | null {
  let state: GameState = createInitialState();
  for (const mv of moves) {
    const clean = mv.replace(/[\s=]/g, '');
    const from  = { row: 5 - parseInt(clean[1]), col: clean.charCodeAt(0) - 97 };
    const to    = { row: 5 - parseInt(clean[3]), col: clean.charCodeAt(2) - 97 };
    const promoChar = clean[4]?.toLowerCase();
    const promoteTo = promoChar === 'r' ? 'rook'
                    : promoChar === 'b' ? 'bishop'
                    : promoChar === 'n' ? 'knight'
                    : 'queen';
    const next = makeMove(state, from, to, promoteTo);
    if (!next) { console.error(`    move ${mv} rejected in line ${JSON.stringify(moves)}`); return null; }
    state = next;
  }
  return state;
}

// ── Pawn push ──────────────────────────────────────────────────────────────
console.log('\nPawn movement');
{
  const s = createInitialState();
  assert('white pawn can push one square', !!makeMove(s, {row:3,col:3}, {row:2,col:3}));
  assert('white pawn cannot push two from rank 2 (blocked by enemy)', !makeMove(s, {row:3,col:3}, {row:1,col:3}));
}

// ── Pawn capture ───────────────────────────────────────────────────────────
console.log('\nPawn capture');
{
  // After d2d3 / e4d3: black e-pawn captures white d-pawn
  const s = playLine(['d2d3']);
  if (s) {
    // Now it's black's turn; e4 pawn can capture d3 diagonally
    const next = makeMove(s, {row:1,col:4}, {row:2,col:3});
    assert('black pawn can capture diagonally', !!next);
  }
}

// ── En passant ─────────────────────────────────────────────────────────────
console.log('\nEn passant');
{
  // 1. a2a3  2. b4a3  3. b2b4(double push — ep=b3)  4. c4xb3 e.p.
  const s1 = playLine(['a2a3', 'b4a3', 'b2b4']);
  if (s1) {
    assert('en passant target set after double push', s1.enPassantTarget !== null);
    assert('ep target is b3', s1.enPassantTarget?.row === 2 && s1.enPassantTarget?.col === 1);
    // Black c4 captures en passant to b3, removing white b4 pawn
    const s2 = makeMove(s1, {row:1,col:2}, {row:2,col:1});
    assert('en passant capture accepted', !!s2);
    if (s2) {
      assert('captured pawn removed from b4', s2.board[1][1] === null);
      assert('black pawn landed on b3',       s2.board[2][1]?.type === 'pawn');
    }
    // En passant target cleared on next move
    const s3 = s2 ? makeMove(s2, {row:3,col:2}, {row:2,col:2}) : null; // c2c3 white
    assert('ep target cleared after non-double-push', s3?.enPassantTarget === null);
  }
}

// ── Pawn promotion ─────────────────────────────────────────────────────────
console.log('\nPromotion');
{
  // Build a state with white pawn already on rank 4 (row 1) about to step to rank 5.
  // We do it by direct board manipulation for simplicity.
  const s0 = createInitialState();
  // Clear d4 (row 1, col 3) by removing the black d-pawn and place white pawn there instead.
  const board = cloneBoard(s0.board);
  board[1][3] = { type: 'pawn', color: 'white' };   // white pawn at d4
  board[3][3] = null;                                 // remove white d2 pawn
  // d5 (row 0, col 3) has the black king — we move the black king away first
  board[0][3] = null;                                 // remove black king
  board[0][4] = null;                                 // remove black bishop (e5)
  // Place black king somewhere safe (won't be in check after promotion)
  board[2][4] = { type: 'king', color: 'black' };    // black king at e3
  const prState: GameState = {
    ...s0,
    board,
    currentTurn: 'white',
  };

  // d4→d5 is empty (we cleared it), promote to rook
  const after = makeMove(prState, {row:1,col:3}, {row:0,col:3}, 'rook');
  assert('promotion accepted', !!after);
  if (after) {
    assert('promoted piece is rook',       after.board[0][3]?.type === 'rook');
    assert('promoted piece is white',      after.board[0][3]?.color === 'white');
    assert('original square is empty',     after.board[1][3] === null);
    assert('notation contains =R',        after.moveHistory.at(-1)?.includes('=R') ?? false);
  }

  // Promote to knight
  const afterN = makeMove(prState, {row:1,col:3}, {row:0,col:3}, 'knight');
  assert('promotion to knight accepted',  !!afterN);
  if (afterN) assert('promoted to knight', afterN.board[0][3]?.type === 'knight');
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed\n`);
if (failed) process.exit(1);
