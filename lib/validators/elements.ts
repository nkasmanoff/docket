import type { ElementsPuzzle, ValidationResult } from "../types";

export function validateElements(
  data: unknown,
): ValidationResult<ElementsPuzzle> {
  const p = data as ElementsPuzzle;
  if (!p || typeof p !== "object") return fail("not an object");
  if (!Array.isArray(p.rounds) || p.rounds.length !== 3)
    return fail("must have exactly 3 rounds");
  for (const r of p.rounds) {
    if (!r || typeof r.claim !== "string" || !r.claim.trim())
      return fail("each round needs a claim");
    if (!Array.isArray(r.required) || r.required.length === 0)
      return fail(`round "${r.claim}" needs required elements`);
    if (!Array.isArray(r.distractors) || r.distractors.length === 0)
      return fail(`round "${r.claim}" needs distractors`);
    const req = new Set(r.required.map((x) => x.toLowerCase().trim()));
    for (const d of r.distractors) {
      if (req.has(d.toLowerCase().trim()))
        return fail(`distractor "${d}" overlaps required set in "${r.claim}"`);
    }
    if (typeof r.ruleStatement !== "string" || !r.ruleStatement.trim())
      return fail(`round "${r.claim}" needs a ruleStatement`);
  }
  return { ok: true, value: p };
}

function fail(error: string): ValidationResult<never> {
  return { ok: false, error };
}
