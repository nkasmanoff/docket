// SERVER-ONLY. Maps each game slug to its generation spec: the rules + difficulty
// levers, the JSON schema text, few-shot examples, validator, and bundled
// fallback. Imported only by the API route, never by client components.

import { MODEL, FAST_MODEL } from "./ai-config";
import type { ValidationResult } from "./types";

import { validateCrossed } from "./validators/crossed";
import { validateHolding } from "./validators/holding";
import { validateBrief } from "./validators/brief";
import { validateObjection } from "./validators/objection";
import { validateElements } from "./validators/elements";
import { validateIssueSpotter } from "./validators/issue-spotter";
import { validateHunt } from "./validators/hunt";
import { validateMaxim } from "./validators/maxim";

import crossedFallback from "@/content/crossed/fallback.json";
import holdingFallback from "@/content/holding/fallback.json";
import briefFallback from "@/content/brief/fallback.json";
import objectionFallback from "@/content/objection/fallback.json";
import elementsFallback from "@/content/elements/fallback.json";
import issueFallback from "@/content/issue-spotter/fallback.json";
import huntFallback from "@/content/hunt/fallback.json";
import maximFallback from "@/content/maxim/fallback.json";

import { ALLOWED_COUNT } from "./allowed-words";

export interface GameSpec {
  rules: string;
  schemaText: string;
  examples: unknown[];
  fallback: unknown;
  validate: (data: unknown) => ValidationResult<unknown>;
  model: string;
}

export const REGISTRY: Record<string, GameSpec> = {
  crossed: {
    model: MODEL,
    validate: validateCrossed,
    fallback: crossedFallback,
    examples: [crossedFallback],
    schemaText: `{ "groups": [ { "name": string, "difficulty": 1|2|3|4, "members": [string x4], "teach": string } x4 ] }`,
    rules: `GAME: "Crossed" — a Connections-style puzzle of 16 bar-exam terms in 4 groups of 4 from {subject} (or mixed if subject omitted). Each group shares a precise legal category. THE POINT (and the main difficulty lever) is the overlap: include terms whose surface topic suggests the WRONG group (e.g., a defense that reads like an element), so the puzzle tests discrimination between adjacent doctrines. Higher difficulty = more such traps and more obscure terms. Assign group difficulty 1=most obvious … 4=trickiest. Every member <= 28 characters; all 16 members unique. teach = one-sentence rule takeaway per group.`,
  },

  holding: {
    model: FAST_MODEL,
    validate: validateHolding,
    fallback: holdingFallback,
    examples: [holdingFallback],
    schemaText: `{ "answer": string (exactly 5 uppercase letters), "definition": string, "example": string }`,
    rules: `GAME: "Holding" — a Wordle whose answer is a 5-letter legal term. Choose ONE common 5-letter legal/English word as the answer (e.g. VENUE, PROXY, ESTOP, WAIVE, FRAUD, ARSON, TRUST, DOWER, LEASE, TITLE). It MUST be a real, common 5-letter word so a player could plausibly guess it. Provide a one-sentence definition and a short usage example. Difficulty {1-5} controls how common vs. obscure the term is. The answer must be exactly five letters A-Z, uppercase.`,
  },

  brief: {
    model: FAST_MODEL,
    validate: validateBrief,
    fallback: briefFallback,
    examples: [briefFallback],
    schemaText: `{ "size": 5, "blocked": [[row,col],...], "clues": [ { "num": number, "dir": "across"|"down", "clue": string, "answer": string (<=5 letters), "row": number (0-4), "col": number (0-4) } ... ], "teach": { "<ANSWER>": string, ... } }`,
    rules: `GAME: "The Brief" — a self-consistent 5x5 mini crossword. All answers are real legal terms of length <= 5 (e.g. TORT, VENUE, PROXY, ESTOP, WRIT, LIEN, JURY, BAIL, MOOT, WAIVE, FRAUD, ARSON, GAVEL, VOID, OATH, LEASE, TITLE, DEED). Clues are definition/element/Latin-maxim style. Coordinates are 0-indexed; row 0 is the top, col 0 is the left. An across answer occupies (row, col..col+len-1); a down answer occupies (row..row+len-1, col). CROSSING LETTERS MUST AGREE — mentally fill the grid and verify every intersection before returning. Every non-blocked cell must be covered by at least one answer. Difficulty {1-5} controls answer obscurity and clue indirection. Provide a one-line teach per answer, keyed by the UPPERCASE answer.`,
  },

  objection: {
    model: MODEL,
    validate: validateObjection,
    fallback: objectionFallback,
    examples: [objectionFallback],
    schemaText: `{ "items": [ { "scenario": string, "ruling": "Sustained"|"Overruled", "groundsOptions": [string x4], "correctGrounds": string (must be one of groundsOptions), "explanation": string } x8 ] }`,
    rules: `GAME: "Objection!" — 8 trial-evidence items grounded in the Federal Rules of Evidence (note NY distinctions only when the subject flags it). Each item: a concise courtroom scenario; the correct ruling (Sustained/Overruled); exactly 4 plausible grounds with exactly one correct; and a one-sentence rule citing the operative principle. RAISE THE ACCURACY BAR: use only well-settled, non-split rulings — avoid close calls and jurisdiction-dependent edge cases. Difficulty {1-5} controls subtlety (layered hearsay, exceptions within exceptions at higher levels). correctGrounds must be exactly one of the four groundsOptions strings.`,
  },

  elements: {
    model: MODEL,
    validate: validateElements,
    fallback: elementsFallback,
    examples: [elementsFallback],
    schemaText: `{ "rounds": [ { "claim": string, "required": [string,...], "distractors": [string,...], "ruleStatement": string } x3 ] }`,
    rules: `GAME: "Elements" — 3 claims/crimes from {subject}. For each, give the EXACT required elements (majority common-law / UBE rule) plus 3-4 distractor tiles drawn from ADJACENT doctrines (the trap — e.g. an element of a neighboring claim). Distractors must NOT be actual elements of the claim. Provide the canonical one-sentence rule statement. Difficulty {1-5} controls how close the distractors are to the real elements.`,
  },

  "issue-spotter": {
    model: MODEL,
    validate: validateIssueSpotter,
    fallback: issueFallback,
    examples: [issueFallback],
    schemaText: `{ "rounds": [ { "facts": string (<=900 chars), "subject": Subject, "options": [ { "label": string, "present": boolean, "why": string } x ~8 (6-9, with >=2 present and >=2 absent) ] } x2 ] }`,
    rules: `GAME: "Issue Spotter" — 2 short bar-style fact patterns in {subject} (3-6 sentences each). For each, list ~8 candidate legal issues: a realistic mix of genuinely-raised issues (present:true) and plausible red-herrings the facts do NOT support (present:false), each with a one-line rationale grounded in the facts. Each round needs at least 2 present and at least 2 absent. Use settled doctrine. Difficulty {1-5} controls fact-pattern subtlety and how tempting the red-herrings are.`,
  },

  hunt: {
    model: MODEL,
    validate: validateHunt,
    fallback: huntFallback,
    // Few-shot uses the small PAYLOAD shape, not the full laid-out grid.
    examples: [
      {
        theme: "Hearsay Exceptions",
        spangram: "EXCEPTIONS",
        words: ["EXCITED", "DYING", "BUSINESS", "PRESENT", "STATEMENT"],
        teach: {
          EXCITED: "Excited utterance: statement on a startling event while under its stress.",
          DYING: "Dying declaration: belief of imminent death, about its cause.",
          BUSINESS: "Business records kept in the regular course of business.",
          PRESENT: "Present sense impression: describing an event as it happens.",
          STATEMENT: "A hearsay statement is an out-of-court assertion offered for its truth.",
          EXCEPTIONS: "Hearsay exceptions admit reliable out-of-court statements.",
        },
      },
    ],
    schemaText: `Return ONLY this small payload (a LOCAL algorithm builds the grid): { "theme": string, "spangram": string (one word naming the theme, letters only, fairly long), "words": [5-7 single words, letters only, no spaces], "teach": { "<WORD>": string, ... including the spangram } }`,
    rules: `GAME: "The Hunt" — a Strands-style themed word search. Pick a single bar-exam study set as the theme (e.g. 'Hearsay Exceptions', 'Intentional Torts', 'Article 9 Collateral'). Return ONLY: theme, 5-7 single-word theme members (UPPERCASE letters only, no spaces), one spangram word that names the theme (also letters only, and at least as long as a typical grid side ~6+), and a one-line teach per word AND for the spangram. Difficulty {1-5} controls obscurity of the theme and members. Do NOT attempt to lay out a grid — a local algorithm does that. Pick words whose total letter count can tile a rectangle (favor 5-7 words plus a 6-9 letter spangram).`,
  },

  maxim: {
    model: MODEL,
    validate: validateMaxim,
    fallback: maximFallback,
    examples: [maximFallback],
    schemaText: `{ "tilePool": [string,...], "maxims": [ { "phrase": string, "tiles": [string,...] (ordered, all in tilePool), "meaning": string } (>=4) ], "ranks": [ { "name": string, "threshold": number } ] (ascending, include a 0-threshold entry) }`,
    rules: `GAME: "Maxim" — pick 5-7 well-known Latin legal maxims relevant to the bar (e.g. res ipsa loquitur, respondeat superior, stare decisis, habeas corpus, mens rea, actus reus). Break each into ordered word-tiles and pool ALL tiles together (overlap and shared tiles encouraged). Provide a plain-English meaning per maxim. Difficulty {1-5} controls maxim obscurity and pool size (more decoy tiles at higher difficulty). Every tile a maxim uses must appear in tilePool. Provide ranks (e.g. Clerk/Associate/Partner) sorted ascending by threshold (0..1), including a 0-threshold entry.`,
  },
};

// Note: allowed-words list size, surfaced so the Holding prompt could reference
// it if desired. Imported to keep the dependency explicit.
export const _allowedWordCount = ALLOWED_COUNT;
