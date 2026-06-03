import type { CrossedPuzzle, ValidationResult } from "../types";

export function validateCrossed(data: unknown): ValidationResult<CrossedPuzzle> {
  const p = data as CrossedPuzzle;
  if (!p || typeof p !== "object") return fail("not an object");
  if (!Array.isArray(p.groups) || p.groups.length !== 4)
    return fail("must have exactly 4 groups");

  const seenDiff = new Set<number>();
  const seenMembers = new Set<string>();

  for (const g of p.groups) {
    if (!g || typeof g.name !== "string" || !g.name.trim())
      return fail("each group needs a name");
    if (![1, 2, 3, 4].includes(g.difficulty))
      return fail(`group "${g.name}" difficulty must be 1-4`);
    if (seenDiff.has(g.difficulty))
      return fail("group difficulties 1-4 must not repeat");
    seenDiff.add(g.difficulty);
    if (!Array.isArray(g.members) || g.members.length !== 4)
      return fail(`group "${g.name}" must have exactly 4 members`);
    for (const m of g.members) {
      if (typeof m !== "string" || !m.trim())
        return fail("members must be non-empty strings");
      if (m.length > 28) return fail(`member "${m}" exceeds 28 chars`);
      const lc = m.toLowerCase().trim();
      if (seenMembers.has(lc)) return fail(`duplicate member "${m}"`);
      seenMembers.add(lc);
    }
    if (typeof g.teach !== "string" || !g.teach.trim())
      return fail(`group "${g.name}" missing teach`);
  }
  if (seenMembers.size !== 16) return fail("must have 16 unique members");
  return { ok: true, value: p };
}

function fail(error: string): ValidationResult<never> {
  return { ok: false, error };
}
