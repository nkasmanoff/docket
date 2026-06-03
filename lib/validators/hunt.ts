import type { HuntPuzzle, HuntPayload, ValidationResult } from "../types";
import { layoutHunt, validateHuntGrid } from "../hunt-layout";

// The model returns a small payload; this validator runs the LOCAL layout
// generator and returns a full, structurally-valid puzzle. If layout fails it
// returns ok:false so the engine retries with a different word set. It also
// accepts an already-laid-out puzzle (the committed fallback has a grid).
export function validateHunt(data: unknown): ValidationResult<HuntPuzzle> {
  const obj = data as Record<string, unknown>;
  if (!obj || typeof obj !== "object") return fail("not an object");

  // Already laid out (fallback path): validate the grid directly.
  if (Array.isArray(obj.grid)) {
    const err = validateHuntGrid(obj as unknown as HuntPuzzle);
    if (err) return fail(err);
    return { ok: true, value: obj as unknown as HuntPuzzle };
  }

  // Payload path: validate the small shape, then lay it out.
  const payload = obj as unknown as HuntPayload;
  if (typeof payload.theme !== "string" || !payload.theme.trim())
    return fail("theme required");
  if (typeof payload.spangram !== "string" || !payload.spangram.trim())
    return fail("spangram required");
  if (!Array.isArray(payload.words) || payload.words.length < 4)
    return fail("need 4+ theme words");
  if (!payload.teach || typeof payload.teach !== "object")
    return fail("teach required");

  const laid = layoutHunt(payload);
  if (!laid.ok) return fail(laid.error);

  // Stamp placeholder meta; the route overrides with authoritative meta.
  const full = {
    game: "hunt",
    dateKey: "",
    mode: "practice",
    difficulty: 3,
    ...laid.puzzle,
  } as HuntPuzzle;

  const err = validateHuntGrid(full);
  if (err) return fail(`layout produced invalid grid: ${err}`);
  return { ok: true, value: full };
}

function fail(error: string): ValidationResult<never> {
  return { ok: false, error };
}
