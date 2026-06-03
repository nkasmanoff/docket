import type { HoldingPuzzle, ValidationResult } from "../types";
import { isAllowedWord } from "../allowed-words";

export function validateHolding(data: unknown): ValidationResult<HoldingPuzzle> {
  const p = data as HoldingPuzzle;
  if (!p || typeof p !== "object") return fail("not an object");
  if (typeof p.answer !== "string") return fail("answer must be a string");
  const ans = p.answer.toUpperCase();
  if (!/^[A-Z]{5}$/.test(ans))
    return fail("answer must be exactly 5 letters A-Z");
  if (!isAllowedWord(ans))
    return fail(`answer "${ans}" is not in the allowed-words list, so it would be unguessable`);
  if (typeof p.definition !== "string" || !p.definition.trim())
    return fail("definition is required");
  return { ok: true, value: { ...p, answer: ans } };
}

function fail(error: string): ValidationResult<never> {
  return { ok: false, error };
}
