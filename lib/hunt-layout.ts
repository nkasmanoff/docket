import type { HuntPuzzle, HuntPayload, HuntWord } from "./types";

// ---------------------------------------------------------------------------
// Local grid generator for The Hunt. We do NOT trust the model to lay out a
// valid Strands grid. The model returns only { theme, spangram, words, teach }.
// This module tiles the whole board so that:
//   - the spangram is a connected path touching opposite (left/right) edges,
//   - every theme word is a connected, non-overlapping path,
//   - the union of all paths covers EVERY cell (Strands tiles the whole grid).
//
// Strategy: a boustrophedon ("snake") fill. In snake order consecutive cells
// are always orthogonally adjacent (including the turn at each row end), so any
// word laid along it is contiguous. Total letters must equal rows*cols, so we
// pick grid dimensions from the factor pairs of the total letter count. Placing
// the spangram first guarantees it covers row 0 from col 0 to col cols-1 when
// its length >= cols, satisfying "touches opposite edges".
// ---------------------------------------------------------------------------

const MIN_SIDE = 4;
const MAX_SIDE = 10;
const PREF_COLS = 6;

interface Dims {
  rows: number;
  cols: number;
}

function pickDims(total: number, spangramLen: number): Dims | null {
  const candidates: Dims[] = [];
  for (let cols = MIN_SIDE; cols <= Math.min(MAX_SIDE, spangramLen); cols++) {
    if (total % cols !== 0) continue;
    const rows = total / cols;
    if (rows < MIN_SIDE || rows > MAX_SIDE) continue;
    candidates.push({ rows, cols });
  }
  if (candidates.length === 0) return null;
  // Prefer cols near the default 6 and a portrait-ish board (rows >= cols).
  candidates.sort((a, b) => {
    const ascore = Math.abs(a.cols - PREF_COLS) + (a.rows < a.cols ? 2 : 0);
    const bscore = Math.abs(b.cols - PREF_COLS) + (b.rows < b.cols ? 2 : 0);
    return ascore - bscore;
  });
  return candidates[0];
}

// Snake-order list of [row,col] coordinates.
function snakeOrder(rows: number, cols: number): [number, number][] {
  const out: [number, number][] = [];
  for (let r = 0; r < rows; r++) {
    if (r % 2 === 0) {
      for (let c = 0; c < cols; c++) out.push([r, c]);
    } else {
      for (let c = cols - 1; c >= 0; c--) out.push([r, c]);
    }
  }
  return out;
}

export interface LayoutResult {
  ok: true;
  puzzle: Omit<HuntPuzzle, keyof import("./types").PuzzleMeta>;
}
export interface LayoutError {
  ok: false;
  error: string;
}

export function layoutHunt(
  payload: HuntPayload,
): LayoutResult | LayoutError {
  const spangram = payload.spangram.toUpperCase().replace(/[^A-Z]/g, "");
  const themeWords = payload.words
    .map((w) => w.toUpperCase().replace(/[^A-Z]/g, ""))
    .filter((w) => w.length > 0 && w !== spangram);

  if (!spangram) return { ok: false, error: "spangram missing or empty" };
  if (themeWords.length < 3)
    return { ok: false, error: "need at least 3 theme words plus a spangram" };

  const all = [spangram, ...themeWords];
  const total = all.reduce((s, w) => s + w.length, 0);

  const dims = pickDims(total, spangram.length);
  if (!dims) {
    return {
      ok: false,
      error: `cannot tile ${total} letters into a clean grid (spangram length ${spangram.length}); return a different word set whose total letters factor into a 4-10 sided rectangle with the spangram at least as long as one side`,
    };
  }
  const { rows, cols } = dims;

  // Order words so the spangram is laid first (covers the top row, spanning
  // left↔right edges). Remaining theme words follow in given order.
  const order = [spangram, ...themeWords];
  const snake = snakeOrder(rows, cols);

  const grid: string[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ""),
  );
  const words: HuntWord[] = [];

  let idx = 0;
  for (const w of order) {
    const path: [number, number][] = [];
    for (const ch of w) {
      const cell = snake[idx++];
      const [r, c] = cell;
      grid[r][c] = ch;
      path.push([r, c]);
    }
    words.push({
      word: w,
      path,
      ...(w === spangram ? { isSpangram: true } : {}),
    });
  }

  // Sanity: spangram must touch opposite edges (left col 0 and right col cols-1,
  // OR top row 0 and bottom row rows-1).
  const span = words.find((w) => w.isSpangram)!;
  if (!touchesOppositeEdges(span.path, rows, cols)) {
    return {
      ok: false,
      error: "spangram did not span opposite edges; need a longer spangram",
    };
  }

  const gridStrings = grid.map((row) => row.join(""));

  return {
    ok: true,
    puzzle: {
      rows,
      cols,
      grid: gridStrings,
      theme: payload.theme,
      words,
      teach: payload.teach,
    },
  };
}

function touchesOppositeEdges(
  path: [number, number][],
  rows: number,
  cols: number,
): boolean {
  let left = false,
    right = false,
    top = false,
    bottom = false;
  for (const [r, c] of path) {
    if (c === 0) left = true;
    if (c === cols - 1) right = true;
    if (r === 0) top = true;
    if (r === rows - 1) bottom = true;
  }
  return (left && right) || (top && bottom);
}

// Full structural validator for an already-laid-out Hunt puzzle (used for the
// committed fallback and as a final gate).
export function validateHuntGrid(p: HuntPuzzle): string | null {
  if (!p || typeof p !== "object") return "not an object";
  if (typeof p.rows !== "number" || typeof p.cols !== "number")
    return "rows/cols required";
  if (!Array.isArray(p.grid) || p.grid.length !== p.rows)
    return "grid must have `rows` rows";
  for (const row of p.grid) {
    if (typeof row !== "string" || row.length !== p.cols)
      return "every grid row must be `cols` long";
  }
  if (!Array.isArray(p.words) || p.words.length < 4)
    return "need spangram + theme words";

  const owner: (string | null)[][] = Array.from({ length: p.rows }, () =>
    Array.from({ length: p.cols }, () => null),
  );
  let spangrams = 0;

  for (const w of p.words) {
    if (typeof w.word !== "string" || !Array.isArray(w.path))
      return "bad word entry";
    if (w.path.length !== w.word.length)
      return `path length != word length for "${w.word}"`;
    if (w.isSpangram) spangrams++;
    for (let i = 0; i < w.path.length; i++) {
      const [r, c] = w.path[i];
      if (r < 0 || r >= p.rows || c < 0 || c >= p.cols)
        return `"${w.word}" path out of bounds`;
      if (owner[r][c] !== null)
        return `cell (${r},${c}) used by more than one word`;
      owner[r][c] = w.word;
      if (p.grid[r][c] !== w.word[i])
        return `grid letter mismatch for "${w.word}" at (${r},${c})`;
      if (i > 0) {
        const [pr, pc] = w.path[i - 1];
        if (Math.abs(pr - r) > 1 || Math.abs(pc - c) > 1)
          return `"${w.word}" path not contiguous at step ${i}`;
      }
    }
    if (!p.teach || !p.teach[w.word]) return `teach missing for "${w.word}"`;
  }

  if (spangrams !== 1) return "exactly one spangram required";

  // Full coverage: every cell owned.
  for (let r = 0; r < p.rows; r++)
    for (let c = 0; c < p.cols; c++)
      if (owner[r][c] === null) return `cell (${r},${c}) not covered`;

  const span = p.words.find((w) => w.isSpangram)!;
  if (!touchesOppositeEdges(span.path, p.rows, p.cols))
    return "spangram does not span opposite edges";

  return null;
}
