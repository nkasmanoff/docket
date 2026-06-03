import type { ObjectionPuzzle, ValidationResult } from "../types";

export function validateObjection(
  data: unknown,
): ValidationResult<ObjectionPuzzle> {
  const p = data as ObjectionPuzzle;
  if (!p || typeof p !== "object") return fail("not an object");
  if (!Array.isArray(p.items) || p.items.length !== 8)
    return fail("must have exactly 8 items");
  for (const it of p.items) {
    if (!it || typeof it.scenario !== "string" || !it.scenario.trim())
      return fail("each item needs a scenario");
    if (it.ruling !== "Sustained" && it.ruling !== "Overruled")
      return fail(`ruling must be Sustained|Overruled, got "${it.ruling}"`);
    if (!Array.isArray(it.groundsOptions) || it.groundsOptions.length !== 4)
      return fail("each item needs exactly 4 groundsOptions");
    if (new Set(it.groundsOptions).size !== 4)
      return fail("groundsOptions must be distinct");
    if (!it.groundsOptions.includes(it.correctGrounds))
      return fail(`correctGrounds "${it.correctGrounds}" not in groundsOptions`);
    if (typeof it.explanation !== "string" || !it.explanation.trim())
      return fail("each item needs an explanation");
  }
  return { ok: true, value: p };
}

function fail(error: string): ValidationResult<never> {
  return { ok: false, error };
}
