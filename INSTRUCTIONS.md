# Docket — Build Prompts for Claude Code (live-generation edition)

A daily-puzzle site for NY bar exam prep, modeled on the *format* of the NYT Games site (daily puzzle, streaks, shareable result grid), with original branding. **Puzzles are not pre-authored. Each puzzle is generated on demand by calling Claude (Opus) through the Anthropic API when the user opens the game, calibrated to a difficulty the app works out by asking the user a couple of quick questions first.**

## How to use this document

- **Run Prompt 0 first.** It scaffolds the app, the design system, the shared mechanics (streaks, share grid, results modal), **and the generation engine** (the server route that prompts Opus, validates the JSON it returns, retries, and falls back). Every game prompt assumes Prompt 0 ran.
- Then feed the game prompts **one at a time**, in any order. Each one now specifies only its *deltas*: the JSON schema Opus must return, the difficulty levers, the calibration questions to ask the user, and a worked example puzzle (used as a few-shot example **and** as the offline fallback).
- **"Docket"** is a placeholder brand. Swap it. Don't use the NYT name, logos, or visual design.
- **Accuracy is still the product.** A model-generated "sustained/overruled" can be wrong, and this is bar prep. Read the "Trust & accuracy" section in Prompt 0 — generation does not remove the need for review, it changes where review happens.

---

## Architecture overview (read before Prompt 0)

**Runtime flow for every game:**

1. User opens a game → a short **Calibrator** screen asks 1–3 questions (subject focus + how hard). Answers are remembered in localStorage so repeat visits can one-tap skip.
2. The app POSTs those params to an **internal server route** (`/api/puzzle/<game>`). The route — never the browser — calls the Anthropic API.
3. The server builds a prompt = game rules + the required JSON schema + 1–2 example puzzles + the difficulty/subject params + the user's recent score for that game (so difficulty self-adjusts), and asks Opus to return **only** a JSON object.
4. The server parses the JSON, runs the game's **validator** (the same validators that would have checked hand-authored puzzles). Invalid → retry up to 2× feeding the error back → still invalid → serve the bundled **fallback** example puzzle.
5. The validated puzzle JSON goes to the client and the game renders. Play, completion, streak, and share all work exactly as in the static design.

**Two modes (this matters — personalization breaks the shared-daily mechanic):**

- **Daily** — fixed subject rotation + fixed difficulty for the day. Generated **once** server-side on the first request of the day, cached, and served identically to everyone. This preserves "puzzle #N," comparable share grids, and any future leaderboard.
- **Practice** — personalized. The Calibrator drives subject + difficulty and Claude calibrates per request. Not comparable across users; the share grid still works as a personal result. This is where the "Claude figures out how hard" experience lives.

**Hard requirements baked into the prompts:**

- **API key is server-side only** (`ANTHROPIC_API_KEY` env var). Never `NEXT_PUBLIC_*`, never called from the client. The client only ever hits our own `/api/puzzle/*` route.
- **Model:** use `claude-opus-4-8` (Anthropic's most capable current model) for generation. For the cheap, high-volume word games (Holding, The Brief) `claude-sonnet-4-6` is a fine, much cheaper alternative. Model IDs are pinned snapshots that get superseded — confirm the current ID at https://docs.claude.com/en/docs/about-claude/models before launch and keep it in one config constant.
- **Cost & latency are real.** Every open in Practice mode is an Opus call (a few seconds, real cost). Mitigations, all specced in Prompt 0: cache the Daily once for everyone; cache Practice results by a hash of params with a short TTL so refresh doesn't re-bill; rate-limit per session; use Sonnet for the word games; show a themed loading state during generation.

---

# PROMPT 0 — Foundation, shared systems & generation engine

```
You are building "Docket," a daily-puzzle web app for NY bar exam prep. Puzzles are generated at runtime by calling the Anthropic API (Claude Opus), not stored as a fixed library. This first task sets up the project, the design system, the shared game mechanics, AND the generation engine. Later tasks add individual games as thin routes that plug into this engine.

TECH STACK
- Next.js (App Router) + TypeScript + Tailwind CSS. Deployable to Vercel.
- Server: Next.js Route Handlers (app/api/.../route.ts) for all Anthropic calls. Use the official `@anthropic-ai/sdk` npm package.
- Per-user state (streaks, completion, calibration profile, cached results) in localStorage. No accounts in v1.
- Use `npm`.

ENVIRONMENT & SECURITY (critical)
- Read the key from process.env.ANTHROPIC_API_KEY on the server only. NEVER expose it to the client and NEVER prefix it with NEXT_PUBLIC_. The browser calls only our own /api/puzzle/* routes; it must never call api.anthropic.com directly.
- Add a .env.example with ANTHROPIC_API_KEY= and a README note to set it in Vercel project env vars.
- Centralize the model ID in /lib/ai-config.ts: export const MODEL = "claude-opus-4-8"; const FAST_MODEL = "claude-sonnet-4-6"; (these are pinned snapshots — leave a comment to verify at docs.claude.com).

PROJECT STRUCTURE
- /app — routes; /app/page.tsx is the games index; each game at /app/games/<slug>/page.tsx.
- /app/api/puzzle/[game]/route.ts — the generation endpoint (POST).
- /components — shared UI. /lib — shared logic. /content/<slug>/fallback.json — one offline fallback puzzle per game.
- /lib/types.ts — shared types. /lib/validators/<slug>.ts — one validator per game.

DESIGN SYSTEM ("courthouse meets crossword"; not generic-AI)
- Tokens: ink (#1a1a2e) text/headers; parchment (#f4f1ea) page bg; surface (#fff) cards; brass (#b08d57) accent; semantic correct #2e7d32, partial #c9a227, wrong #9e9e9e, error #c0392b.
- Type: a serif display (e.g. "Source Serif 4") for headings/titles; "Inter" for UI; monospace only for the share grid. Square-ish tiles, 8px radius, 1px low-opacity ink hairlines, generous whitespace. No purple gradients/glassmorphism/default-shadcn look.
- Component kit in /components: Button, Tile, Modal, Toast, IconButton, PageShell (brand wordmark header + back link, centered max-w-lg column).

THE GENERATION ENGINE (the core of this task)
1. /lib/ai-config.ts — model constants (above).
2. /lib/generate.ts — the shared generator. Export:
   generatePuzzle<T>(opts: {
     game: string;
     schemaText: string;        // the required JSON shape, as text, included in the prompt
     rules: string;             // game rules + difficulty levers, supplied by each game
     examples: unknown[];       // 1-2 few-shot example puzzles
     params: GenParams;         // subject(s), difficulty 1-5, mode, recentScore?
     validate: (data: unknown) => { ok: true; value: T } | { ok: false; error: string };
     model?: string;            // default MODEL; word games may pass FAST_MODEL
   }): Promise<{ puzzle: T; source: "generated" | "fallback"; difficulty: number }>
   Behavior:
   - Build a system prompt: the game rules, an explicit difficulty rubric, the schemaText, and a hard instruction: "Return ONLY a single valid JSON object matching the schema. No prose, no markdown, no code fences." Include the examples as prior assistant turns or clearly-labeled samples. Include params (subject, difficulty, and "the user recently scored {recentScore}; if they're consistently doing well, increase trap density / obscurity, otherwise ease off").
   - Call the Anthropic Messages API server-side with a sensible max_tokens.
   - Extract text from the response content blocks, strip any stray ```json fences, JSON.parse inside try/catch.
   - Run validate(). On parse or validation failure, retry up to 2 more times, appending the previous error to the prompt ("Your last output failed validation: <error>. Return corrected JSON only.").
   - On final failure, load /content/<game>/fallback.json, validate it (must pass), and return it with source:"fallback".
3. /app/api/puzzle/[game]/route.ts — POST handler. Reads { mode, subject, difficulty, recentScore } from the body, dispatches to the right game module's rules+schema+examples+validator (register games in /lib/games-registry.ts), calls generatePuzzle, returns the puzzle JSON. Add basic per-session rate limiting (e.g. token-bucket keyed on an anon session cookie) and a 25s timeout.
4. CACHING — /lib/puzzle-cache.ts:
   - Daily mode: cache key = `${game}:daily:${dateKey}`. First request of the day generates; everyone else gets the cached copy. Use an in-memory LRU for v1; leave a clearly-marked seam to swap in Vercel KV/Redis for multi-instance correctness.
   - Practice mode: cache key = `${game}:practice:${hash(subject+difficulty)}:${dateKey}` with a short TTL, so a refresh doesn't re-bill the same puzzle.

DIFFICULTY CALIBRATION — "Claude figures out how hard" (build this generically)
- /components/Calibrator.tsx — a pre-puzzle screen shown in Practice mode. Each game supplies its own questions (subject options + a difficulty proxy). Default questions if a game supplies none: (1) "What do you want to drill?" (subject buttons) (2) "How are you feeling on this?" → Shaky / Getting there / Solid → maps to difficulty 2 / 3 / 4. Persist answers as a per-game profile in localStorage; on return, show a compact "Evidence · Getting there · [change]" bar with one-tap regenerate instead of re-asking.
- The chosen difficulty (1-5) and subject go into params. ALSO pass the user's recent average score for this game (from the stats hook) as recentScore so the model auto-nudges difficulty over time. This is the adaptive half of "figuring out how hard."
- Daily mode skips the Calibrator and uses that day's fixed subject+difficulty from a rotation defined in /lib/daily-rotation.ts.

SHARED MECHANICS (build once, reuse everywhere)
- /lib/useGameStats.ts — per game: played, wins, currentStreak, maxStreak, lastPlayedDate, per-day completion state (finished puzzles re-open the results modal, not a fresh board), recent scores (for adaptive difficulty), and the full result object per day (to regenerate the share grid). Streak counts consecutive calendar days in America/New_York.
- /lib/share.ts — buildShareText({ gameName, dateKey, mode, gridLines, scoreLine }) → NYT-style text: title (brand + game + #N for Daily, or "Practice" for Practice), an emoji grid each game supplies, and a footer URL. ShareButton copies to clipboard / uses navigator.share on mobile; shows a "Copied!" toast.
- /components/ResultsModal.tsx — outcome, emoji grid preview, streak + win%, a "Learn it" panel (each game passes teaching takeaways), ShareButton, and (Daily mode) a countdown to the next puzzle.
- /components/PuzzleLoader.tsx — the glue: runs Calibrator (Practice) → POSTs to /api/puzzle/<game> → shows a themed loading state ("Drafting today's puzzle…", respect prefers-reduced-motion) → renders the game with the returned puzzle, or an error card with a Retry button if even the fallback fails.
- /app/page.tsx — brand header + responsive grid of game cards (icon, name, one-liner, and a Play / In-progress / Done ✓ badge).

TRUST & ACCURACY (do not skip)
- Generation moves review from "before publish" to "guardrails at runtime." Implement: (a) the schema validator per game (structural correctness); (b) a generation system-prompt clause requiring the model to ground answers in well-settled black-letter UBE/NY law and to prefer primary authority (FRE, statutes, common-law majority rules), avoiding niche or split-authority calls; (c) a per-item "report a problem" button that logs the puzzle JSON for human review; (d) a feature flag to force fallback-only (no live generation) per game, for incidents.
- Keep all law in the generated JSON + the teaching takeaways; never hardcode legal claims in components.

SHARED TYPES (/lib/types.ts) — extend per game:
  export type Subject = "Torts"|"Contracts"|"Property"|"CivPro"|"ConLaw"|"CrimLaw"|"CrimPro"|"Evidence"|"BizOrgs"|"Wills"|"FamilyLaw"|"NYDistinction";
  export type Mode = "daily" | "practice";
  export interface GenParams { mode: Mode; subject?: Subject; difficulty: 1|2|3|4|5; recentScore?: number; }
  export interface PuzzleMeta { game: string; dateKey: string; mode: Mode; subject?: Subject; difficulty: number; }

ACCESSIBILITY: full keyboard play, visible focus, ARIA on tiles/modal, respect prefers-reduced-motion, never color-only state cues.

ACCEPTANCE CRITERIA
- `npm run dev` boots; home renders game cards.
- A demo game route proves the full loop: Calibrator → POST /api/puzzle/demo → Opus returns JSON → validate → render → completion writes stats → results modal → share copies. With ANTHROPIC_API_KEY unset OR generation failing, the demo still renders from /content/demo/fallback.json and labels itself "Practice puzzle (offline)."
- Confirm in code review that the key is never bundled to the client (grep the client bundle).
```

---

## How each game prompt works now

Every game below is a **thin plug-in** to the Prompt 0 engine. Each one gives Claude Code four things: the **schema** Opus must emit, the **generation rules + difficulty levers**, the **Calibrator questions**, and a **worked example** that doubles as the few-shot sample and the `/content/<slug>/fallback.json`. The UI/UX, share grid, validator wiring, stats, and results modal all reuse Prompt 0. The example puzzles below are illustrative black-letter law — **verify with a licensed attorney before launch.**

---

# PROMPT 1 — "Crossed" (Connections for law) — flagship

```
Add the "Crossed" game to Docket (Prompt 0 built the engine, design, stats, share, results, PuzzleLoader, Calibrator — reuse all). Route: /app/games/crossed. Register it in the games registry.

GAMEPLAY: sort 16 legal terms into 4 hidden groups of 4. Select exactly 4 → submit. Correct → locks as a colored solved row (yellow=easy → green → blue → purple=trickiest), labeled with the category. Wrong → shake + deselect; if 3/4 right, "One away…" toast. 4 mistakes allowed; on the 4th, auto-reveal. Win = all 4 groups found. Full keyboard play.

THE POINT: the pedagogy is the overlap — include terms that look like they belong to one doctrine but belong to another (issue-spotting). This is a key difficulty lever.

SCHEMA (add to types; this is the JSON Opus must return):
  interface CrossedGroup { name: string; difficulty: 1|2|3|4; members: string[4]; teach: string; }
  interface CrossedPuzzle extends PuzzleMeta { groups: CrossedGroup[4]; }

VALIDATOR (/lib/validators/crossed.ts): exactly 4 groups; each exactly 4 members; difficulties are 1,2,3,4 with no repeats; all 16 members unique (case-insensitive); every member ≤ ~28 chars; teach present.

GENERATION RULES + DIFFICULTY LEVERS (passed as `rules` to generatePuzzle):
  "Generate a Connections-style puzzle of 16 bar-exam terms in 4 groups of 4 from {subject} (or mixed if subject omitted). Each group shares a precise legal category. Ground every term in well-settled UBE/NY black-letter law. Difficulty {1-5} controls: term obscurity, and especially TRAP DENSITY — at higher difficulty, include terms whose surface topic suggests the wrong group (e.g., a defense that reads like an element), so the puzzle tests discrimination between adjacent doctrines. Assign group difficulty 1=most obvious … 4=trickiest. teach = one-sentence rule takeaway per group."

CALIBRATOR QUESTIONS: subject (Torts/Contracts/Property/Evidence/CrimLaw/Mixed); difficulty proxy "How sharp are you on telling close doctrines apart?" → Shaky/Getting there/Solid → 2/3/4.

WORKED EXAMPLE = /content/crossed/fallback.json (and few-shot sample):
{ "game":"crossed","dateKey":"2026-01-01","mode":"practice","subject":"Evidence","difficulty":3,
  "groups":[
    {"name":"Intentional Torts","difficulty":1,"members":["Battery","Assault","False Imprisonment","Conversion"],"teach":"Intentional torts require intent to do the act, not intent to harm."},
    {"name":"Hearsay Exceptions","difficulty":2,"members":["Excited Utterance","Dying Declaration","Business Records","Present Sense Impression"],"teach":"These come in even though the declarant isn't testifying."},
    {"name":"Future Interests","difficulty":3,"members":["Reversion","Remainder","Executory Interest","Possibility of Reverter"],"teach":"Future interests are present rights to future possession."},
    {"name":"Defenses to Negligence","difficulty":4,"members":["Comparative Fault","Assumption of Risk","Contributory Negligence","Last Clear Chance"],"teach":"Last Clear Chance rebuts contributory negligence — a defense to a defense."}
  ]}

SHARE GRID: 4 rows of 4 emoji, one row per guess in the order made, each tile colored by the group it truly belongs to (🟨🟩🟦🟪). "Docket Crossed #<n>".
ACCEPTANCE: seed solvable; "one away" correct; persists in-progress; share matches real guess history; difficulty visibly changes trap density across levels.
```

---

# PROMPT 2 — "The Brief" (Mini Crossword)

```
Add "The Brief" to Docket (reuse the Prompt 0 engine). Route: /app/games/brief. May use FAST_MODEL (claude-sonnet-4-6) — this is high-volume and cost-sensitive.

GAMEPLAY: 5x5 mini crossword; clues are legal definitions/elements/Latin maxims/landmark-case prompts; answers are legal terms ≤5 letters. Standard interaction: type to advance, click clue to jump, space toggles direction, backspace steps back. Check (square/word/puzzle) and Reveal menus; revealing flags completed-with-help. Win = filled + correct. Track time. Full keyboard play.

SCHEMA:
  interface CrosswordClue { num:number; dir:"across"|"down"; clue:string; answer:string; row:number; col:number; }
  interface BriefPuzzle extends PuzzleMeta { size:5; blocked:[number,number][]; clues:CrosswordClue[]; teach:Record<string,string>; }

VALIDATOR (/lib/validators/brief.ts) — REQUIRED and strict, because generated crosswords are easily inconsistent: every answer fits its start cell+direction+length within 5x5; all crossing letters agree; no answer >5 letters; every non-blocked cell is covered; teach has an entry per answer. This validator is also the generation gate — expect and handle retries.

GENERATION RULES: "Produce a self-consistent 5x5 mini crossword. All answers are real legal terms ≤5 letters (e.g. TORT, VENUE, PROXY, ESTOP, WRIT, LIEN, JURY, BAIL, MOOT, WAIVE, FRAUD, ARSON, GAVEL, VOID, OATH). Clues are definition/element/maxim style. Crossing letters MUST agree — verify the grid before returning. Difficulty {1-5} controls answer obscurity and clue indirection. Provide teach (1-line) per answer."

CALIBRATOR: subject (or "Mixed terms"); difficulty Easy/Medium/Hard → 2/3/4.
WORKED EXAMPLE: generate one valid 5x5 at build time, run the validator, commit it as /content/brief/fallback.json. (Do not ship an unvalidated example.)
SHARE GRID: time + a clean/help flag — "Docket Brief #<n> — 1:42 ⬜ no peeking" (🟦 solved-no-help / 🟨 used help).
ACCEPTANCE: validator passes on fallback and on every generated puzzle before render; timer + help-tracking correct; resume on refresh.
```

---

# PROMPT 3 — "The Hunt" (Strands-style themed word search)

```
Add "The Hunt" to Docket (reuse the Prompt 0 engine). Route: /app/games/hunt.

GAMEPLAY (mirror Strands): a letter grid (default 6 cols x 8 rows). A hidden THEME ties a word set; connect adjacent letters (incl. diagonals, bending paths) to submit words. Theme word → blue lock; the spangram (spans the board, names the theme) → gold lock. Theme shown as "???" + word count. Every 3 valid non-theme English words reveals one theme word's location (hint mechanic). Win = all theme words + spangram. No mistake limit. Drag or tap-tap-tap; full keyboard alternative.

SCHEMA:
  interface HuntWord { word:string; path:[number,number][]; isSpangram?:boolean; }
  interface HuntPuzzle extends PuzzleMeta { rows:number; cols:number; grid:string[]; theme:string; words:HuntWord[]; teach:Record<string,string>; }

GRID GENERATION IS THE HARD PART — do NOT trust the model to lay out a valid grid. Have Opus return ONLY the theme + word list + chosen spangram (a small, easy-to-validate payload). Then a LOCAL algorithm in /lib/hunt-layout.ts places everything: spangram as a connected path touching opposite edges, each theme word as a connected non-overlapping path, remaining cells filled so no unintended theme words appear, and the union of paths covers EVERY cell (Strands tiles the whole grid). Use backtracking; if placement fails, ask the model for a different word set (shorter/fewer) and retry. The validator confirms contiguity, bounds, non-overlap, and full coverage.

GENERATION RULES (for the small payload): "Pick a single bar-exam study set as the theme (e.g. 'Hearsay Exceptions', 'Intentional Torts', 'Article 9 collateral'). Return theme, 5-7 single-word theme members (no spaces), one spangram word naming the theme, and a teach line per word. Difficulty {1-5} controls obscurity of the theme/members. All words must be letters only, uppercase."

CALIBRATOR: subject; difficulty Easy/Medium/Hard → 2/3/4.
WORKED EXAMPLE payload: { theme:"Hearsay Exceptions", spangram:"EXCEPTIONS", words:["EXCITED","DYING","BUSINESS","PRESENT","STATEMENT"], teach:{...} }. Run the layout generator on it and commit the resulting full grid JSON as /content/hunt/fallback.json.
SHARE GRID: 🔵 per theme word, 🟡 spangram, in order found, 💡 per hint used. "Docket Hunt #<n>".
ACCEPTANCE: layout generator + validator guarantee a fully-tiled, unambiguous grid for the fallback and any live payload; drag + tap + keyboard input; hint mechanic correct.
```

---

# PROMPT 4 — "Holding" (legal-vocab Wordle)

```
Add "Holding" to Docket (reuse the Prompt 0 engine). Route: /app/games/holding. May use FAST_MODEL.

GAMEPLAY (mirror Wordle): 6 guesses, 5 letters, exact duplicate-letter coloring. Guesses must be valid 5-letter English words (vendor a standard word list in /lib/allowed-words.ts). The ANSWER is always a legal term; solving reveals its definition. On-screen + physical keyboard reflect letter states. Win on correct; reveal on loss.

SCHEMA: interface HoldingPuzzle extends PuzzleMeta { answer:string; definition:string; example?:string; }
VALIDATOR: answer is exactly 5 uppercase letters AND is itself in the allowed-words list (so it's guessable); definition present.

GENERATION RULES: "Choose a single 5-letter legal term as the answer (e.g. VENUE, PROXY, ESTOP, WAIVE, FRAUD, ARSON, TRUST, BREVE, DOWER). It must be a common English/legal 5-letter word. Provide a one-sentence definition and a short usage example. Difficulty {1-5} controls how common vs. obscure the term is. Return only the JSON."

CALIBRATOR: subject (or "Any term"); difficulty Easy/Medium/Hard → 2/3/4. (Daily mode uses a fixed term so everyone shares it.)
WORKED EXAMPLE / fallback.json: { "game":"holding","answer":"VENUE","definition":"The proper court/location where a case may be heard.","example":"Improper venue can be waived if not timely raised.", ... }
SHARE GRID: standard Wordle block 🟩🟨⬛, "Docket Holding #<n> X/6".
ACCEPTANCE: duplicate-letter coloring matches Wordle; answer always guessable; once-per-day completion; resume.
```

---

# PROMPT 5 — "Maxim" (Spelling-Bee pivot — OPTIONAL/BETA)

```
Add "Maxim" to Docket behind a "Beta" badge (reuse the Prompt 0 engine). Route: /app/games/maxim. This is the most disposable game — cut if it doesn't earn its place.

GAMEPLAY: assemble Latin legal maxims from a shared pool of word-fragment tiles. Tap tiles in order → submit. Valid maxim → locks with its meaning; tiles are reusable across maxims. Tiered ranks by % found (Clerk → Associate → Partner). No hard fail.

SCHEMA:
  interface Maxim { phrase:string; tiles:string[]; meaning:string; }
  interface MaximPuzzle extends PuzzleMeta { tilePool:string[]; maxims:Maxim[]; ranks:{name:string;threshold:number}[]; }
VALIDATOR: every maxim's tiles ⊆ tilePool (order preserved); ≥4 maxims; ranks sorted ascending with a 0-threshold entry.

GENERATION RULES: "Pick 5-7 well-known Latin legal maxims relevant to the bar. Break each into ordered word-tiles and pool all tiles together (overlap encouraged). Provide a plain-English meaning per maxim. Difficulty {1-5} controls maxim obscurity and pool size (more decoy tiles at higher difficulty). Return only JSON."

CALIBRATOR: difficulty only — Easy/Medium/Hard → 2/3/4.
WORKED EXAMPLE / fallback.json: tilePool ["RES","IPSA","LOQUITUR","RESPONDEAT","SUPERIOR","STARE","DECISIS","HABEAS","CORPUS","MENS","REA","ACTUS","REUS"]; maxims: res ipsa loquitur / respondeat superior / stare decisis / habeas corpus / mens rea / actus reus, each with meaning; ranks Clerk(0)/Associate(0.5)/Partner(1.0).
SHARE GRID: "Docket Maxim #<n> — Partner 🏛️ 6/6" + 🟫 per found maxim.
ACCEPTANCE: order-sensitive validation; reusable tiles; rank thresholds; keyboard accessible.
```

---

# PROMPT 6 — "Objection!" (rapid evidence calls)

```
Add "Objection!" to Docket (reuse the Prompt 0 engine). Route: /app/games/objection.

GAMEPLAY: a daily round of 8 items. Each: a short trial scenario → player answers in two steps: (1) Sustained / Overruled, (2) pick the grounds from 4 options. Immediate per-item feedback with a one-sentence rule. No going back. Score = items fully correct (ruling AND grounds).

SCHEMA:
  interface ObjectionItem { scenario:string; ruling:"Sustained"|"Overruled"; groundsOptions:string[4]; correctGrounds:string; explanation:string; }
  interface ObjectionPuzzle extends PuzzleMeta { items:ObjectionItem[8]; }
VALIDATOR: 8 items; each has exactly 4 groundsOptions; correctGrounds ∈ groundsOptions; ruling is one of the two literals; explanation present.

GENERATION RULES (raise the accuracy bar here): "Generate 8 trial-evidence items grounded in the Federal Rules of Evidence (note NY distinctions only when flagged). Each: a concise scenario, the correct ruling (Sustained/Overruled), 4 plausible grounds with exactly one correct, and a one-sentence rule citing the operative principle. Use only well-settled, non-split rulings — avoid close calls and jurisdiction-dependent edge cases. Difficulty {1-5} controls subtlety (e.g., layered hearsay, exceptions within exceptions at higher levels). Return only JSON."

CALIBRATOR: difficulty "How solid is your Evidence?" → Shaky/OK/Strong → 2/3/4.
WORKED EXAMPLE / fallback.json (3 shown; model generates 8):
  - "Counsel on direct: 'You were terrified that night, weren't you?'" → Sustained / Leading / "Leading questions are generally improper on direct."
  - "Witness: 'My neighbor told me the light was red,' offered to prove the light was red." → Sustained / Hearsay / "Out-of-court statement offered for its truth, no exception."
  - "Treating physician relays what the patient said about how the injury happened, for diagnosis." → Overruled / "No valid objection" / "Statements for medical diagnosis/treatment are a hearsay exception."
SHARE GRID: 8 emoji — ✅ both right, 🟨 ruling right/grounds wrong, ❌ wrong. "Docket Objection! #<n> 6/8".
ACCEPTANCE: two-step flow; per-item explanation always shown; share array matches performance; "report a problem" present.
```

---

# PROMPT 7 — "Elements" (build the cause of action)

```
Add "Elements" to Docket (reuse the Prompt 0 engine). Route: /app/games/elements.

GAMEPLAY: a daily round of 3 claims. Each names a claim/crime; player drags the required element tiles into a "complaint" while leaving out distractors (often elements of a neighboring doctrine), then submits. Correct included = green, wrong included = red, missed required = amber. Round correct iff included set == required set exactly. Show the model rule after each. Drag + tap/keyboard fallback.

SCHEMA:
  interface ElementsRound { claim:string; required:string[]; distractors:string[]; ruleStatement:string; }
  interface ElementsPuzzle extends PuzzleMeta { rounds:ElementsRound[3]; }
VALIDATOR: 3 rounds; required non-empty; distractors non-empty and disjoint from required; ruleStatement present.

GENERATION RULES: "For 3 claims/crimes from {subject}, give the exact required elements (majority common-law/UBE rule) plus 3-4 distractor tiles drawn from ADJACENT doctrines (the trap). Provide the canonical one-sentence rule statement. Difficulty {1-5} controls how close the distractors are to the real elements. Return only JSON."

CALIBRATOR: subject (Torts/CrimLaw/Contracts/Property/Mixed); difficulty Easy/Medium/Hard → 2/3/4.
WORKED EXAMPLE / fallback.json:
  - Negligence: required [Duty, Breach, Actual cause, Proximate cause, Damages]; distractors [Intent, Harmful or offensive contact, Consideration]; rule "Negligence = duty, breach, actual + proximate causation, and damages."
  - Common-law Battery: required [Intent, Harmful or offensive contact, Causation]; distractors [Damages, Duty, Apprehension]; rule "Battery = intent to cause, and causation of, a harmful/offensive contact; actual damages not required."
  - Common-law Burglary: required [Breaking, Entering, Dwelling of another, At night, Intent to commit a felony inside]; distractors [Carrying away, Trespassory taking, Force or fear]; rule "Burglary = breaking and entering the dwelling of another at night with intent to commit a felony therein."
SHARE GRID: 3 emoji — ✅ exact / 🟨 partial / ❌. "Docket Elements #<n> 2/3".
ACCEPTANCE: exact-set scoring; distractors flagged on reveal; rule statements shown.
```

---

# PROMPT 8 — "Issue Spotter" (tap every issue)

```
Add "Issue Spotter" to Docket (reuse the Prompt 0 engine). Route: /app/games/issue-spotter. Closest game to the real exam.

GAMEPLAY: a daily round of 2 fact patterns. Each: a 3-6 sentence fact pattern + a checklist of ~8 candidate issues (some present, some red-herrings). Toggle the issues you spot → one submit. Scoring: hits (correct present) green, missed present amber, false alarms red. Round score = (hits − false alarms), floored at 0, normalized to true-issue count. Win threshold ≥80% drives the streak; otherwise it's graded, not pass/fail. Each option shows its rationale on reveal.

SCHEMA:
  interface IssueOption { label:string; present:boolean; why:string; }
  interface IssueRound { facts:string; subject:Subject; options:IssueOption[]; }
  interface IssueSpotterPuzzle extends PuzzleMeta { rounds:IssueRound[2]; }
VALIDATOR: 2 rounds; each 6-9 options with ≥2 present and ≥2 absent; every option has a why; facts within length bounds.

GENERATION RULES: "Write 2 short bar-style fact patterns in {subject}. For each, list ~8 candidate legal issues — a realistic mix of genuinely-raised issues and plausible red-herrings that the facts do NOT support — each marked present:true/false with a one-line rationale grounded in the facts. Use settled doctrine. Difficulty {1-5} controls fact-pattern subtlety and how tempting the red-herrings are. Return only JSON."

CALIBRATOR: subject; difficulty "How's your issue-spotting?" → Building/Decent/Strong → 2/3/4.
WORKED EXAMPLE / fallback.json (1 round shown; model generates 2):
  facts: "A emails B offering 500 widgets at $2 each, 'firm for 10 days,' signed. Day 3, before B replies, A emails 'never mind, sold them.' B then emails 'I accept.' Both merchants."
  options: UCC Art. 2 governs (T), Firm offer irrevocable w/o consideration (T), Attempted revocation before acceptance (T), Mailbox rule timing (T), Statute of Frauds $500+ (T), Promissory estoppel (F — no reliance facts), Parol evidence (F — no prior agreement at issue), Impracticability (F — no supervening event) — each with a one-line why.
SHARE GRID: per round, 🟩 per hit / ⬛ per miss / 🟥 per false alarm. "Docket Issue Spotter #<n> 5/6 issues".
ACCEPTANCE: precision/recall scoring correct + explained; every option shows rationale; "report a problem" present.
```

---

# Palate-cleansers (Sudoku / Tiles / Vertex) — no generation, no full prompt

Don't generate or legal-ify these. Reskin an open-source engine and wire it to the shared stats/streak + results modal so it counts toward the daily habit:

> "Add a reskinned daily Sudoku to Docket at /games/sudoku using an existing open-source React Sudoku engine. Apply the Docket design tokens, seed the daily puzzle from the date (no API call), and integrate the shared stats/streak hook and ResultsModal. No legal content, no generation."

---

# Build order

1. Prompt 0 (engine) — required first; get the generate→validate→fallback loop solid before any game.
2. Prompt 1 Crossed + Prompt 4 Holding — prove generation + the share loop on the two most engaging games (Holding is cheapest to run).
3. Prompt 2 The Brief — daily-habit driver (watch the validator; generated crosswords fail often — the retry loop matters here).
4. Prompt 6 Objection! + Prompt 7 Elements + Prompt 8 Issue Spotter — the "makes you better" trio; these need the strictest accuracy guardrails and the "report a problem" path.
5. Prompt 3 The Hunt — most engineering (local layout generator); do it with momentum.
6. Prompt 5 Maxim — last; cut if weak.

# Two things to decide before you start

- **Daily vs Practice as the default.** Personalized generation is the cool part, but it kills the shared "puzzle #N" + comparable share grids that drive growth. The doc builds both; pick which the home screen leads with. Recommended: a fixed shared **Daily** per game (generated once, cached for all) on top, **Practice** (personalized, Claude-calibrated) below.
- **Cost ceiling.** Decide a monthly generation budget and which games use Opus vs Sonnet. Caching the Daily once-per-day-for-everyone is the single biggest lever; Practice mode is where spend scales with usage, so rate-limit it.