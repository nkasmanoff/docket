import type { IssueSpotterPuzzle, ValidationResult } from "../types";

export function validateIssueSpotter(
  data: unknown,
): ValidationResult<IssueSpotterPuzzle> {
  const p = data as IssueSpotterPuzzle;
  if (!p || typeof p !== "object") return fail("not an object");
  if (!Array.isArray(p.rounds) || p.rounds.length !== 2)
    return fail("must have exactly 2 rounds");
  for (const r of p.rounds) {
    if (!r || typeof r.facts !== "string" || !r.facts.trim())
      return fail("each round needs facts");
    if (r.facts.length > 900) return fail("facts too long (>900 chars)");
    if (!Array.isArray(r.options) || r.options.length < 6 || r.options.length > 9)
      return fail("each round needs 6-9 options");
    let present = 0;
    let absent = 0;
    for (const o of r.options) {
      if (typeof o.label !== "string" || !o.label.trim())
        return fail("each option needs a label");
      if (typeof o.present !== "boolean")
        return fail("each option needs present:boolean");
      if (typeof o.why !== "string" || !o.why.trim())
        return fail(`option "${o.label}" needs a why`);
      o.present ? present++ : absent++;
    }
    if (present < 2) return fail("each round needs >=2 present issues");
    if (absent < 2) return fail("each round needs >=2 red-herrings");
  }
  return { ok: true, value: p };
}

function fail(error: string): ValidationResult<never> {
  return { ok: false, error };
}
