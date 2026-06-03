import type { Subject } from "./types";

// Client-safe metadata for every game. No secrets, no SDK — safe to import in
// the browser (home page, Calibrator). The server-only generation spec lives in
// games-registry.ts.

export interface CalibratorConfig {
  // Subject question. Omit `subjects` for games that don't pick a subject.
  subjects?: { label: string; value: Subject | "Mixed" }[];
  // Difficulty proxy question: 3 labels mapping to difficulty 2 / 3 / 4.
  difficultyQuestion: string;
  difficultyLabels: [string, string, string]; // [→2, →3, →4]
}

export interface GameMeta {
  slug: string;
  name: string;
  blurb: string;
  icon: string;
  beta?: boolean;
  /** When false, hidden from the home page and puzzle API. */
  enabled?: boolean;
  /** "opus" = flagship reasoning; "fast" = Sonnet for cheap word games. */
  engine: "opus" | "fast";
  calibrator: CalibratorConfig;
}

const STD_SUBJECTS: { label: string; value: Subject | "Mixed" }[] = [
  { label: "Torts", value: "Torts" },
  { label: "Contracts", value: "Contracts" },
  { label: "Property", value: "Property" },
  { label: "Evidence", value: "Evidence" },
  { label: "CrimLaw", value: "CrimLaw" },
  { label: "Mixed", value: "Mixed" },
];

const ALL_GAMES: GameMeta[] = [
  {
    slug: "crossed",
    name: "Crossed",
    blurb: "Sort 16 legal terms into 4 hidden groups.",
    icon: "⚖️",
    engine: "opus",
    calibrator: {
      subjects: STD_SUBJECTS,
      difficultyQuestion: "How sharp are you on telling close doctrines apart?",
      difficultyLabels: ["Shaky", "Getting there", "Solid"],
    },
  },
  {
    slug: "holding",
    name: "Holding",
    blurb: "Guess the 5-letter legal term in six tries.",
    icon: "🔤",
    engine: "fast",
    calibrator: {
      subjects: [
        ...STD_SUBJECTS.slice(0, 5),
        { label: "Any term", value: "Mixed" },
      ],
      difficultyQuestion: "How obscure can the term be?",
      difficultyLabels: ["Easy", "Medium", "Hard"],
    },
  },
  {
    slug: "brief",
    name: "The Brief",
    blurb: "A 5×5 mini crossword of legal terms.",
    icon: "📝",
    enabled: false,
    engine: "fast",
    calibrator: {
      subjects: [
        ...STD_SUBJECTS.slice(0, 5),
        { label: "Mixed terms", value: "Mixed" },
      ],
      difficultyQuestion: "How tricky should the clues be?",
      difficultyLabels: ["Easy", "Medium", "Hard"],
    },
  },
  {
    slug: "objection",
    name: "Objection!",
    blurb: "Sustained or overruled? Make eight rapid evidence calls.",
    icon: "🔨",
    engine: "opus",
    calibrator: {
      difficultyQuestion: "How solid is your Evidence?",
      difficultyLabels: ["Shaky", "OK", "Strong"],
    },
  },
  {
    slug: "elements",
    name: "Elements",
    blurb: "Build the cause of action from the right elements.",
    icon: "🧩",
    engine: "opus",
    calibrator: {
      subjects: [
        { label: "Torts", value: "Torts" },
        { label: "CrimLaw", value: "CrimLaw" },
        { label: "Contracts", value: "Contracts" },
        { label: "Property", value: "Property" },
        { label: "Mixed", value: "Mixed" },
      ],
      difficultyQuestion: "How close should the trap elements be?",
      difficultyLabels: ["Easy", "Medium", "Hard"],
    },
  },
  {
    slug: "issue-spotter",
    name: "Issue Spotter",
    blurb: "Tap every issue the facts actually raise.",
    icon: "🔎",
    engine: "opus",
    calibrator: {
      subjects: STD_SUBJECTS,
      difficultyQuestion: "How's your issue-spotting?",
      difficultyLabels: ["Building", "Decent", "Strong"],
    },
  },
  {
    slug: "hunt",
    name: "The Hunt",
    blurb: "Find the hidden study set in a letter grid.",
    icon: "🔦",
    enabled: false,
    engine: "opus",
    calibrator: {
      subjects: STD_SUBJECTS,
      difficultyQuestion: "How obscure should the theme be?",
      difficultyLabels: ["Easy", "Medium", "Hard"],
    },
  },
  {
    slug: "maxim",
    name: "Maxim",
    blurb: "Assemble Latin legal maxims from word tiles.",
    icon: "🏛️",
    beta: true,
    enabled: false,
    engine: "opus",
    calibrator: {
      difficultyQuestion: "How obscure should the maxims be?",
      difficultyLabels: ["Easy", "Medium", "Hard"],
    },
  },
];

/** Games shown on the home page and playable via the API. */
export const GAMES = ALL_GAMES.filter((g) => g.enabled !== false);

export function isGameEnabled(slug: string): boolean {
  const g = ALL_GAMES.find((x) => x.slug === slug);
  return !!g && g.enabled !== false;
}

export function gameMeta(slug: string): GameMeta | undefined {
  return ALL_GAMES.find((g) => g.slug === slug);
}

// Map a difficulty-proxy choice index (0,1,2) to a 1-5 difficulty.
export const PROXY_TO_DIFFICULTY: [2, 3, 4] = [2, 3, 4];
