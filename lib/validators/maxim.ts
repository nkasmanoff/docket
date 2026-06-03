import type { MaximPuzzle, ValidationResult } from "../types";

export function validateMaxim(data: unknown): ValidationResult<MaximPuzzle> {
  const p = data as MaximPuzzle;
  if (!p || typeof p !== "object") return fail("not an object");
  if (!Array.isArray(p.tilePool) || p.tilePool.length === 0)
    return fail("tilePool required");
  if (!Array.isArray(p.maxims) || p.maxims.length < 4)
    return fail("need >=4 maxims");

  const pool = new Map<string, number>();
  for (const t of p.tilePool) {
    if (typeof t !== "string" || !t.trim()) return fail("tiles must be strings");
    pool.set(t, (pool.get(t) ?? 0) + 1);
  }

  for (const m of p.maxims) {
    if (typeof m.phrase !== "string" || !m.phrase.trim())
      return fail("each maxim needs a phrase");
    if (typeof m.meaning !== "string" || !m.meaning.trim())
      return fail(`maxim "${m.phrase}" needs a meaning`);
    if (!Array.isArray(m.tiles) || m.tiles.length === 0)
      return fail(`maxim "${m.phrase}" needs tiles`);
    // Every tile must exist in the pool (multiplicity-aware).
    const need = new Map<string, number>();
    for (const t of m.tiles) need.set(t, (need.get(t) ?? 0) + 1);
    for (const [t, n] of need) {
      if ((pool.get(t) ?? 0) < n)
        return fail(`maxim "${m.phrase}" uses tile "${t}" not in tilePool`);
    }
  }

  if (!Array.isArray(p.ranks) || p.ranks.length === 0)
    return fail("ranks required");
  const thresholds = p.ranks.map((r) => r.threshold);
  if (!thresholds.includes(0)) return fail("ranks need a 0-threshold entry");
  for (let i = 1; i < thresholds.length; i++) {
    if (thresholds[i] < thresholds[i - 1])
      return fail("ranks must be sorted ascending by threshold");
  }
  return { ok: true, value: p };
}

function fail(error: string): ValidationResult<never> {
  return { ok: false, error };
}
