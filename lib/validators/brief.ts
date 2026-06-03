import type { BriefPuzzle, CrosswordClue, ValidationResult } from "../types";

// Strict structural validator. Generated crosswords are easily inconsistent, so
// this is also the generation gate — expect and rely on retries.
export function validateBrief(data: unknown): ValidationResult<BriefPuzzle> {
  const p = data as BriefPuzzle;
  if (!p || typeof p !== "object") return fail("not an object");
  if (p.size !== 5) return fail("size must be 5");
  if (!Array.isArray(p.clues) || p.clues.length === 0)
    return fail("clues required");
  if (!Array.isArray(p.blocked)) return fail("blocked must be an array");
  if (!p.teach || typeof p.teach !== "object") return fail("teach required");

  const N = 5;
  const blocked = new Set(p.blocked.map(([r, c]) => `${r},${c}`));
  const grid: (string | null)[][] = Array.from({ length: N }, () =>
    Array.from({ length: N }, () => null),
  );

  for (const clue of p.clues) {
    const err = checkClue(clue);
    if (err) return fail(err);
    const ans = clue.answer.toUpperCase();
    for (let i = 0; i < ans.length; i++) {
      const r = clue.dir === "down" ? clue.row + i : clue.row;
      const c = clue.dir === "across" ? clue.col + i : clue.col;
      if (r < 0 || r >= N || c < 0 || c >= N)
        return fail(`answer "${ans}" runs outside the 5x5 grid`);
      if (blocked.has(`${r},${c}`))
        return fail(`answer "${ans}" overlaps a blocked cell`);
      const existing = grid[r][c];
      if (existing !== null && existing !== ans[i])
        return fail(
          `crossing conflict at (${r},${c}): "${existing}" vs "${ans[i]}" from "${ans}"`,
        );
      grid[r][c] = ans[i];
    }
    if (!p.teach[ans] && !p.teach[clue.answer])
      return fail(`teach missing for answer "${ans}"`);
  }

  // Every non-blocked cell must be covered by some answer.
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (blocked.has(`${r},${c}`)) continue;
      if (grid[r][c] === null)
        return fail(`cell (${r},${c}) is neither blocked nor covered by a clue`);
    }
  }
  return { ok: true, value: p };
}

function checkClue(clue: CrosswordClue): string | null {
  if (!clue || typeof clue !== "object") return "clue is not an object";
  if (clue.dir !== "across" && clue.dir !== "down")
    return "clue dir must be across|down";
  if (typeof clue.answer !== "string" || !/^[A-Za-z]+$/.test(clue.answer))
    return "answer must be letters only";
  if (clue.answer.length > 5) return `answer "${clue.answer}" exceeds 5 letters`;
  if (typeof clue.clue !== "string" || !clue.clue.trim())
    return "clue text required";
  if (typeof clue.row !== "number" || typeof clue.col !== "number")
    return "clue needs numeric row/col";
  if (typeof clue.num !== "number") return "clue needs a num";
  return null;
}

function fail(error: string): ValidationResult<never> {
  return { ok: false, error };
}
