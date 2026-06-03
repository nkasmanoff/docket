// Build-time generation of the two fallbacks that must be algorithmically
// valid: The Brief (a self-consistent 5x5 crossword) and The Hunt (a fully-tiled
// Strands grid). Run: npm run build:fallbacks
//
// Each result is checked with the SAME validator the runtime uses, so we never
// ship an unvalidated example.

import { writeFileSync, readFileSync } from "node:fs";
import { validateBrief } from "../lib/validators/brief";
import { validateHunt } from "../lib/validators/hunt";

// ---------- The Brief: search a 5x5 double word square ----------
// Rows and columns are all valid 5-letter words -> every crossing agrees and
// every cell is covered. We search the system 5-letter word list.

function buildBrief() {
  const words = readFileSync("/usr/share/dict/words", "utf8")
    .split(/\s+/)
    .filter((w) => /^[a-z]{5}$/.test(w))
    .map((w) => w.toUpperCase());
  const set = new Set(words);
  // Prefix index for pruning column prefixes.
  const prefixes = new Set<string>();
  for (const w of words) for (let i = 1; i <= 5; i++) prefixes.add(w.slice(0, i));

  // Group words by their 2-letter prefix to speed row selection a little.
  const grid: string[] = [];
  let solution: string[] | null = null;

  // Bias toward some legal-ish seed rows first.
  const seeds = ["TORTS", "WRITS", "VENUE", "LEASE", "FRAUD", "TITLE", "GAVEL"];
  const ordered = [
    ...seeds.filter((w) => set.has(w)),
    ...words.filter((w) => !seeds.includes(w)),
  ];

  const colOk = (r: number): boolean => {
    for (let c = 0; c < 5; c++) {
      let pre = "";
      for (let i = 0; i <= r; i++) pre += grid[i][c];
      if (!prefixes.has(pre)) return false;
      if (r === 4 && !set.has(pre)) return false;
    }
    return true;
  };

  const place = (r: number): boolean => {
    if (r === 5) return true;
    const pool = r === 0 ? ordered : words;
    for (const w of pool) {
      grid[r] = w;
      if (colOk(r) && place(r + 1)) return true;
    }
    grid.length = r;
    return false;
  };

  if (!place(0)) throw new Error("no 5x5 double word square found");
  solution = grid.slice();

  // Build clues: 5 across + 5 down. Generic definition-style clues (this is an
  // offline fallback; the live generator writes legal clues).
  const across = solution;
  const down = [0, 1, 2, 3, 4].map((c) => solution!.map((row) => row[c]).join(""));

  const clues = [] as any[];
  const teach: Record<string, string> = {};
  let num = 1;
  across.forEach((ans, r) => {
    clues.push({ num: num++, dir: "across", clue: `Across entry (row ${r + 1})`, answer: ans, row: r, col: 0 });
    teach[ans] = `${ans} — a five-letter entry; verify in a legal dictionary.`;
  });
  down.forEach((ans, c) => {
    clues.push({ num: num++, dir: "down", clue: `Down entry (col ${c + 1})`, answer: ans, row: 0, col: c });
    teach[ans] = `${ans} — a five-letter entry; verify in a legal dictionary.`;
  });

  const puzzle = {
    game: "brief",
    dateKey: "2026-01-01",
    mode: "practice",
    subject: "Mixed",
    difficulty: 2,
    size: 5,
    blocked: [],
    clues,
    teach,
  };

  const v = validateBrief(puzzle);
  if (!v.ok) throw new Error(`Brief fallback failed validation: ${v.error}`);
  writeFileSync(
    "content/brief/fallback.json",
    JSON.stringify(puzzle, null, 2) + "\n",
  );
  console.log("✓ Brief fallback written:", across.join(" / "));
}

// ---------- The Hunt: lay out the example payload ----------
function buildHunt() {
  const payload = {
    theme: "Hearsay Exceptions",
    spangram: "EXCEPTIONS",
    words: ["EXCITED", "BUSINESS", "PRESENT", "STATEMENT", "MEDICAL"],
    teach: {
      EXCITED: "Excited utterance: a statement on a startling event while under its stress.",
      BUSINESS: "Business records kept in the regular course of business are admissible.",
      PRESENT: "Present sense impression: describing an event while or just after it happens.",
      STATEMENT: "A statement against interest can come in when the declarant is unavailable.",
      MEDICAL: "Statements for medical diagnosis or treatment are admissible.",
      EXCEPTIONS: "Hearsay exceptions admit reliable out-of-court statements.",
    },
  };

  const v = validateHunt(payload);
  if (!v.ok) throw new Error(`Hunt fallback failed layout/validation: ${v.error}`);
  const puzzle = {
    ...(v.value as object),
    game: "hunt",
    dateKey: "2026-01-01",
    mode: "practice",
    subject: "Evidence",
    difficulty: 3,
  };
  writeFileSync(
    "content/hunt/fallback.json",
    JSON.stringify(puzzle, null, 2) + "\n",
  );
  console.log(
    "✓ Hunt fallback written:",
    (v.value as any).rows + "x" + (v.value as any).cols,
  );
}

buildBrief();
buildHunt();
console.log("Done.");
