import { NextRequest, NextResponse } from "next/server";
import { REGISTRY } from "@/lib/games-registry";
import { generatePuzzle } from "@/lib/generate";
import { cacheKey, getCached, setCached } from "@/lib/puzzle-cache";
import { dailyParamsFor } from "@/lib/daily-rotation";
import { takeToken } from "@/lib/rate-limit";
import { dateKey } from "@/lib/date";
import type { GenParams, Mode, Subject, Difficulty, PuzzleMeta } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

// Per-game incident kill switch: set e.g. FORCE_FALLBACK_brief=1 to serve only
// the bundled fallback for that game (no live generation).
function forceFallback(game: string): boolean {
  const flag = process.env[`FORCE_FALLBACK_${game}`];
  return flag === "1" || flag === "true";
}

function getSessionId(req: NextRequest): { id: string; setCookie: boolean } {
  const existing = req.cookies.get("docket_sid")?.value;
  if (existing) return { id: existing, setCookie: false };
  const id = crypto.randomUUID();
  return { id, setCookie: true };
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ game: string }> },
) {
  const { game } = await ctx.params;
  const spec = REGISTRY[game];
  if (!spec) {
    return NextResponse.json({ error: `Unknown game: ${game}` }, { status: 404 });
  }

  const { id: sessionId, setCookie } = getSessionId(req);
  if (!takeToken(sessionId)) {
    return NextResponse.json(
      { error: "Rate limit: too many puzzles too fast. Try again shortly." },
      { status: 429 },
    );
  }

  let body: Partial<GenParams> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const mode: Mode = body.mode === "daily" ? "daily" : "practice";
  const day = dateKey();

  // Build the authoritative params. Daily mode ignores client subject/difficulty
  // and uses the fixed rotation so everyone shares the same puzzle.
  let params: GenParams;
  if (mode === "daily") {
    const fixed = dailyParamsFor(game, day);
    params = { mode, subject: fixed.subject, difficulty: fixed.difficulty };
  } else {
    const difficulty = clampDifficulty(body.difficulty);
    const subject =
      body.subject && body.subject !== ("Mixed" as Subject)
        ? (body.subject as Subject)
        : undefined;
    params = {
      mode,
      subject,
      difficulty,
      recentScore:
        typeof body.recentScore === "number" ? body.recentScore : undefined,
    };
  }

  const key = cacheKey(game, params);
  const cached = getCached<{ puzzle: unknown; source: string; difficulty: number }>(key);
  if (cached) {
    const res = NextResponse.json(cached);
    if (setCookie) setSid(res, sessionId);
    return res;
  }

  let result;
  try {
    if (forceFallback(game)) {
      const v = spec.validate(spec.fallback);
      if (!v.ok) throw new Error(`fallback invalid: ${v.error}`);
      result = { puzzle: v.value, source: "fallback" as const, difficulty: params.difficulty };
    } else {
      result = await generatePuzzle({
        game,
        schemaText: spec.schemaText,
        rules: spec.rules,
        examples: spec.examples,
        params,
        validate: spec.validate,
        fallback: spec.fallback,
        model: spec.model,
      });
    }
  } catch (e) {
    return NextResponse.json(
      { error: `Generation failed: ${(e as Error).message}` },
      { status: 500 },
    );
  }

  // Stamp authoritative meta over whatever the model (or fallback) returned.
  const meta: PuzzleMeta = {
    game,
    dateKey: day,
    mode,
    subject: params.subject,
    difficulty: result.difficulty,
  };
  const puzzle = { ...(result.puzzle as object), ...meta };

  const payload = { puzzle, source: result.source, difficulty: result.difficulty };
  setCached(key, payload, mode);

  const res = NextResponse.json(payload);
  if (setCookie) setSid(res, sessionId);
  return res;
}

function setSid(res: NextResponse, id: string) {
  res.cookies.set("docket_sid", id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

function clampDifficulty(d: unknown): Difficulty {
  const n = typeof d === "number" ? Math.round(d) : 3;
  return (Math.min(5, Math.max(1, n)) as Difficulty) || 3;
}
