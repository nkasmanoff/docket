// Shared types for Docket. Game-specific puzzle shapes live here too so the
// validators, generator, and UI all agree on one source of truth.

export type Subject =
  | "Torts"
  | "Contracts"
  | "Property"
  | "CivPro"
  | "ConLaw"
  | "CrimLaw"
  | "CrimPro"
  | "Evidence"
  | "BizOrgs"
  | "Wills"
  | "FamilyLaw"
  | "NYDistinction";

export type Mode = "daily" | "practice";

export type Difficulty = 1 | 2 | 3 | 4 | 5;

export interface GenParams {
  mode: Mode;
  subject?: Subject;
  difficulty: Difficulty;
  recentScore?: number;
}

export interface PuzzleMeta {
  game: string;
  dateKey: string;
  mode: Mode;
  subject?: Subject;
  difficulty: number;
}

// ----- Crossed (Connections) -----
export interface CrossedGroup {
  name: string;
  difficulty: 1 | 2 | 3 | 4;
  members: string[];
  teach: string;
}
export interface CrossedPuzzle extends PuzzleMeta {
  groups: CrossedGroup[];
}

// ----- The Brief (mini crossword) -----
export interface CrosswordClue {
  num: number;
  dir: "across" | "down";
  clue: string;
  answer: string;
  row: number;
  col: number;
}
export interface BriefPuzzle extends PuzzleMeta {
  size: 5;
  blocked: [number, number][];
  clues: CrosswordClue[];
  teach: Record<string, string>;
}

// ----- The Hunt (Strands) -----
export interface HuntWord {
  word: string;
  path: [number, number][];
  isSpangram?: boolean;
}
export interface HuntPuzzle extends PuzzleMeta {
  rows: number;
  cols: number;
  grid: string[];
  theme: string;
  words: HuntWord[];
  teach: Record<string, string>;
}
// The small payload Opus actually returns for The Hunt:
export interface HuntPayload {
  theme: string;
  spangram: string;
  words: string[];
  teach: Record<string, string>;
}

// ----- Holding (Wordle) -----
export interface HoldingPuzzle extends PuzzleMeta {
  answer: string;
  definition: string;
  example?: string;
}

// ----- Maxim (Spelling Bee pivot) -----
export interface Maxim {
  phrase: string;
  tiles: string[];
  meaning: string;
}
export interface MaximPuzzle extends PuzzleMeta {
  tilePool: string[];
  maxims: Maxim[];
  ranks: { name: string; threshold: number }[];
}

// ----- Objection! -----
export interface ObjectionItem {
  scenario: string;
  ruling: "Sustained" | "Overruled";
  groundsOptions: string[];
  correctGrounds: string;
  explanation: string;
}
export interface ObjectionPuzzle extends PuzzleMeta {
  items: ObjectionItem[];
}

// ----- Elements -----
export interface ElementsRound {
  claim: string;
  required: string[];
  distractors: string[];
  ruleStatement: string;
}
export interface ElementsPuzzle extends PuzzleMeta {
  rounds: ElementsRound[];
}

// ----- Issue Spotter -----
export interface IssueOption {
  label: string;
  present: boolean;
  why: string;
}
export interface IssueRound {
  facts: string;
  subject: Subject;
  options: IssueOption[];
}
export interface IssueSpotterPuzzle extends PuzzleMeta {
  rounds: IssueRound[];
}

// Validator contract shared by every game.
export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };
