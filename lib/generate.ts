import Anthropic from "@anthropic-ai/sdk";
import {
  MODEL,
  MAX_TOKENS,
  GENERATION_TIMEOUT_MS,
  MAX_RETRIES,
  hasApiKey,
} from "./ai-config";
import type { GenParams, ValidationResult } from "./types";

export interface GenerateOptions<T> {
  game: string;
  schemaText: string; // required JSON shape, as text, included in the prompt
  rules: string; // game rules + difficulty levers
  examples: unknown[]; // 1-2 few-shot example puzzles
  params: GenParams;
  validate: (data: unknown) => ValidationResult<T>;
  fallback: unknown; // bundled offline puzzle for this game
  model?: string;
}

export interface GenerateResult<T> {
  puzzle: T;
  source: "generated" | "fallback";
  difficulty: number;
}

const DIFFICULTY_RUBRIC = `DIFFICULTY RUBRIC (1-5):
1 — Foundational. The most common, first-week terms. No traps.
2 — Easy. Common terms; at most one mild distractor.
3 — Medium. Mix of common and moderately obscure; some adjacent-doctrine traps.
4 — Hard. Obscure terms and dense traps that read like a neighboring doctrine.
5 — Brutal. Maximum trap density / obscurity; tests fine discrimination only an exam-ready student makes.`;

const TRUST_CLAUSE = `ACCURACY REQUIREMENTS (non-negotiable, this is bar prep):
- Ground every answer in well-settled black-letter UBE/NY law.
- Prefer primary authority: the Federal Rules of Evidence, statutes, and majority common-law rules.
- AVOID niche, split-authority, or jurisdiction-dependent calls. If a point is genuinely contested, do not use it.
- When NY diverges from the majority/UBE rule, only rely on the NY rule if the subject is explicitly an NY distinction.`;

// The system prompt holds everything that is static for a given game: rules,
// rubric, accuracy clause, schema, and few-shot examples. We mark it
// cache_control: ephemeral so that within the 5-min cache window — every retry,
// and every other generation for the same game — the large prefix is billed as
// a cache read (~10% of input price) instead of full input. The variable
// request parameters deliberately live in the user message (below) so they
// never break this cacheable prefix.
function buildSystemBlocks<T>(
  opts: GenerateOptions<T>,
): Anthropic.Beta.PromptCaching.PromptCachingBetaTextBlockParam[] {
  const { rules, schemaText, examples } = opts;

  const exampleBlock =
    examples.length > 0
      ? `\n\nEXAMPLE PUZZLE(S) (for format and quality calibration only — produce a NEW, different puzzle):\n${examples
          .map((e, i) => `Example ${i + 1}:\n${JSON.stringify(e)}`)
          .join("\n\n")}`
      : "";

  const text = `You are the puzzle generator for "Docket", a NY bar-exam study game.

${rules}

${DIFFICULTY_RUBRIC}

${TRUST_CLAUSE}

REQUIRED JSON SHAPE:
${schemaText}
${exampleBlock}

OUTPUT CONTRACT: Return ONLY a single valid JSON object matching the schema. No prose, no markdown, no code fences.`;

  return [{ type: "text", text, cache_control: { type: "ephemeral" } }];
}

// The per-request parameters change call-to-call, so they go in the user
// message — keeping the cached system prefix byte-identical across requests.
function buildParamsBlock(params: GenParams): string {
  const recent =
    params.recentScore !== undefined
      ? `The user recently scored ${params.recentScore} (0-1 normalized) on this game. If they're consistently doing well (>0.8), increase trap density and obscurity; if they're struggling (<0.5), ease off.`
      : `No recent score available; target the requested difficulty directly.`;

  return `REQUEST PARAMETERS:
- Subject: ${params.subject ?? "Mixed"}
- Difficulty: ${params.difficulty}
- Mode: ${params.mode}
- ${recent}`;
}

// Strip stray markdown code fences and isolate the JSON object.
function extractJson(text: string): string {
  let t = text.trim();
  // Remove ```json ... ``` or ``` ... ``` fences
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  // If there's leading/trailing prose, grab the outermost {...}
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    t = t.slice(first, last + 1);
  }
  return t.trim();
}

export async function generatePuzzle<T>(
  opts: GenerateOptions<T>,
): Promise<GenerateResult<T>> {
  const model = opts.model ?? MODEL;

  // Offline / incident path: validate and serve the bundled fallback.
  const serveFallback = (): GenerateResult<T> => {
    const v = opts.validate(opts.fallback);
    if (!v.ok) {
      throw new Error(
        `Fallback puzzle for "${opts.game}" failed validation: ${v.error}`,
      );
    }
    const fbDifficulty =
      typeof (opts.fallback as { difficulty?: unknown }).difficulty === "number"
        ? (opts.fallback as { difficulty: number }).difficulty
        : opts.params.difficulty;
    return { puzzle: v.value, source: "fallback", difficulty: fbDifficulty };
  };

  if (!hasApiKey()) {
    return serveFallback();
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const system = buildSystemBlocks(opts);
  const paramsBlock = buildParamsBlock(opts.params);

  let lastError = "";
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const userText =
      attempt === 0
        ? `${paramsBlock}\n\nGenerate the puzzle now. Return only the JSON object.`
        : `${paramsBlock}\n\nYour last output failed validation: ${lastError}. Return corrected JSON only — a single valid JSON object, no prose.`;

    try {
      const resp = await client.beta.promptCaching.messages.create(
        {
          model,
          max_tokens: MAX_TOKENS,
          system,
          messages: [{ role: "user", content: userText }],
        },
        { timeout: GENERATION_TIMEOUT_MS },
      );

      const text = resp.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");

      let parsed: unknown;
      try {
        parsed = JSON.parse(extractJson(text));
      } catch (e) {
        lastError = `Output was not valid JSON: ${(e as Error).message}`;
        continue;
      }

      const v = opts.validate(parsed);
      if (v.ok) {
        return {
          puzzle: v.value,
          source: "generated",
          difficulty: opts.params.difficulty,
        };
      }
      lastError = v.error;
    } catch (e) {
      // Network / API / timeout error — record and let the loop retry, then fall back.
      lastError = `API error: ${(e as Error).message}`;
    }
  }

  // Exhausted retries: serve the validated fallback.
  return serveFallback();
}
