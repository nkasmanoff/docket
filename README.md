# Docket

A daily-puzzle web app for NY bar-exam prep, in the *format* of the NYT Games
site (daily puzzle, streaks, shareable result grids) with original branding.
**Puzzles are generated on demand by calling Claude through the Anthropic API**,
validated at runtime, and fall back to bundled examples if generation fails.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS — deployable to Vercel.
- All Anthropic calls happen in server Route Handlers (`app/api/puzzle/[game]`).
- Per-user game state (streaks, completion, calibration, cached results) is in
  `localStorage`.
- Access is gated by **Supabase magic-link auth** against an `allowed_users`
  table (invite-only). See [Authentication](#authentication).

## Getting started

```bash
npm install
cp .env.example .env.local   # then add your key (optional)
npm run dev
```

Open http://localhost:3000.

### API key (optional but recommended)

Set `ANTHROPIC_API_KEY` in `.env.local` (local) or your Vercel project's
Environment Variables (production). It is read **server-side only** and is never
exposed to the browser — the client only ever calls `/api/puzzle/*`.

**Without a key**, the app still runs end-to-end: every game serves its bundled
fallback puzzle and labels itself "Practice puzzle (offline)."

## Authentication

The site is invite-only via Supabase magic-link (passwordless email) auth.
Middleware (`middleware.ts` → `lib/supabase/middleware.ts`) gates **every** route
— including the billable `/api/puzzle/*` endpoint — and redirects anonymous
visitors to `/login`.

**The access gate** is the `allowed_users` table. After a user clicks their
magic link, `/auth/callback` exchanges it for a session and then checks that
their email is in `allowed_users`; if not, they're signed straight back out.

Setup:

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor (creates `allowed_users` + RLS,
   seeds the owner email). Add more users from the Table editor — store emails
   **lowercase**.
3. In **Authentication → URL Configuration**, set the Site URL and add
   `https://<your-domain>/auth/callback` (and `http://localhost:3000/auth/callback`
   for local) to the redirect allow-list.
4. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in
   `.env.local` and in Vercel.

> If those two env vars are blank, the auth layer **no-ops** and the site is
> open — convenient for local dev, but production must set them.

## Model configuration

Model IDs are pinned in one place — `lib/ai-config.ts`:

- `MODEL = "claude-opus-4-8"` — flagship reasoning games (Crossed, Objection!,
  Elements, Issue Spotter, The Hunt, Maxim).
- `FAST_MODEL = "claude-sonnet-4-6"` — cheap, high-volume word games (Holding,
  The Brief).

These are pinned snapshots that get superseded — confirm the current IDs at
https://docs.claude.com/en/docs/about-claude/models before launch.

## How a puzzle is made

1. The client opens a game and POSTs `{ mode, subject, difficulty, recentScore }`
   to `/api/puzzle/<game>`.
2. The route dispatches to that game's spec in `lib/games-registry.ts` (rules +
   schema + few-shot examples + validator) and calls `generatePuzzle`.
3. `lib/generate.ts` builds a system prompt (rules, difficulty rubric, accuracy
   clause, schema), calls the Messages API, parses the JSON, and runs the
   game's **validator**. On failure it retries up to 2× feeding the error back,
   then serves the validated bundled fallback.
4. The validated puzzle renders. Play, completion, streak, and share all work
   identically to the static design.

### Two modes

- **Daily** — fixed subject + difficulty from `lib/daily-rotation.ts`, generated
  **once** server-side per day, cached, and served identically to everyone. This
  preserves "puzzle #N," comparable share grids, and any future leaderboard.
- **Practice** — personalized. The Calibrator asks 1–2 quick questions; Claude
  calibrates per request and auto-nudges difficulty from your recent scores.

## Cost & latency controls

- The Daily is generated once per day and cached for everyone (the biggest
  lever).
- Practice results are cached by a hash of `{subject, difficulty}` with a short
  TTL so a refresh doesn't re-bill.
- The static system prompt (rules + rubric + schema + examples) is sent with
  `cache_control: ephemeral` prompt caching, so retries and back-to-back
  generations for the same game bill the large prefix at ~10% of input price.
- Per-session token-bucket rate limiting (`lib/rate-limit.ts`).
- Word games use the cheaper Sonnet model.
- A themed loading state covers generation latency.

The in-memory cache and rate limiter are correct for a single instance. The
seams to swap in Vercel KV / Redis for multi-instance correctness are marked in
`lib/puzzle-cache.ts` and `lib/rate-limit.ts`.

## Trust & accuracy

This is bar prep, so accuracy is the product. Generation moves review from
"before publish" to **guardrails at runtime**:

- A per-game **schema validator** (structural correctness; also the generation
  gate that drives retries).
- A system-prompt clause requiring answers grounded in **well-settled** UBE/NY
  black-letter law, preferring primary authority and avoiding split-authority
  calls.
- A per-puzzle **"Report a problem"** button that logs the puzzle JSON for human
  review (`/api/report`).
- A per-game **incident kill switch**: set `FORCE_FALLBACK_<game>=1` to serve
  only the bundled fallback (no live generation) for that game.

All legal claims live in the generated JSON + teaching takeaways — never
hardcoded in components.

## Regenerating the algorithmic fallbacks

The Brief (a self-consistent crossword) and The Hunt (a fully-tiled Strands
grid) cannot ship an unvalidated example. Regenerate them with:

```bash
npm run build:fallbacks
```

This builds each, runs it through the **same** validator the runtime uses, and
writes `content/brief/fallback.json` / `content/hunt/fallback.json`.

## Games

| Game | Slug | Engine | Mechanic |
|------|------|--------|----------|
| Crossed | `crossed` | Opus | Connections — 16 terms, 4 hidden groups |
| Holding | `holding` | Sonnet | Wordle — guess the 5-letter legal term |
| The Brief | `brief` | Sonnet | 5×5 mini crossword |
| Objection! | `objection` | Opus | Sustained/overruled + grounds |
| Elements | `elements` | Opus | Build the cause of action |
| Issue Spotter | `issue-spotter` | Opus | Tap every issue the facts raise |
| The Hunt | `hunt` | Opus | Strands — find the hidden study set |
| Maxim (Beta) | `maxim` | Opus | Assemble Latin maxims from tiles |

> "Docket" is a placeholder brand. It does not use the NYT name, logos, or
> visual design.
