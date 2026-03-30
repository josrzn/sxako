# Sxako — 5×5 Chess

A fully playable 5×5 chess game in TypeScript, for two players sharing one terminal.

## Setup

```bash
npm install
npm start
```

Requires Node.js ≥ 16 and npm.

---

## The Board

```
  a b c d e
5 r n q k b   ← Black (back rank)
4 p p p p p   ← Black pawns
3 . . . . .
2 P P P P P   ← White pawns
1 R N Q K B   ← White (back rank)
  a b c d e
```

Each side has **10 pieces**: Rook · Knight · Queen · King · Bishop on the back rank, and 5 Pawns on the second rank.

| Symbol | Piece  |
|--------|--------|
| K / k  | King   |
| Q / q  | Queen  |
| R / r  | Rook   |
| B / b  | Bishop |
| N / n  | Knight |
| P / p  | Pawn   |

Uppercase = White, lowercase = Black.

---

## Rules

All standard chess rules apply on the reduced board, with the following notes.

### Piece movement

| Piece  | Moves |
|--------|-------|
| King   | One square in any direction |
| Queen  | Any number of squares — horizontally, vertically, or diagonally |
| Rook   | Any number of squares horizontally or vertically |
| Bishop | Any number of squares diagonally |
| Knight | L-shape: 2 squares in one direction + 1 square perpendicular |
| Pawn   | Forward one square; two squares from its starting rank; captures one square diagonally forward |

### Castling

Only **queenside castling** is available (there is no room for kingside castling on a 5-file board).

**Conditions** (same as standard chess):

- Neither the King nor the Rook (a-file) may have moved previously.
- Squares **b** and **c** on the back rank must be vacant.
- The King must not be in check, must not pass through an attacked square (c), and must not land in check (b).

**Result:** King moves **d → b**, Rook moves **a → c**.

This applies identically to both colours (both kings start on file d, both rooks start on file a).

### En passant

When a pawn advances two squares from its starting rank, an adjacent enemy pawn on the same rank may capture it as if it had only moved one square. This right expires immediately if not taken on the very next move.

### Pawn promotion

When a pawn reaches the far rank (rank 5 for White, rank 1 for Black) it **must** promote. By default it becomes a Queen; any other piece can be chosen by appending `=<piece>` to the move.

### Check, checkmate & stalemate

- **Check** — the King is under attack; the player must resolve it immediately.
- **Checkmate** — the King is in check with no legal escape; the opponent wins.
- **Stalemate** — the player has no legal moves but is not in check; the game is a draw.

---

## Commands

| Input | Action |
|-------|--------|
| `d2d3` or `d2 d3` | Move a piece from d2 to d3 |
| `a4b5=q` | Move and promote to Queen (`q` `r` `b` `n` are valid; default is `q`) |
| `O-O-O` or `0-0-0` | Queenside castling (when legal) |
| `moves <sq>` | Show all legal moves for the piece on that square, e.g. `moves d1` |
| `board` | Redraw the board |
| `history` | Show the move history |
| `help` | Show in-game command reference |
| `quit` / `exit` | Quit the game |

---

## Running the tests

```bash
npx ts-node src/test.ts
```

Runs 16 engine unit tests covering pawn pushes, diagonal captures, en passant, and promotion.
