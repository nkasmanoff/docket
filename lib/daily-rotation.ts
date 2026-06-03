import type { Subject, Difficulty } from "./types";
import { dailySeed } from "./date";

// Daily mode uses a fixed subject + difficulty per game per day so every player
// gets the identical "puzzle #N". The rotation is deterministic from the date.

const SUBJECT_CYCLE: Subject[] = [
  "Torts",
  "Contracts",
  "Evidence",
  "Property",
  "CrimLaw",
  "CivPro",
  "ConLaw",
];

// Difficulty rises gently through the week (Mon easiest → weekend harder), a
// familiar daily-puzzle cadence.
const DIFFICULTY_BY_DOW: Difficulty[] = [3, 2, 2, 3, 3, 4, 4]; // Sun..Sat

export function dailyParamsFor(game: string, key: string): {
  subject: Subject;
  difficulty: Difficulty;
} {
  const seed = dailySeed(`${game}:${key}`);
  const subject = SUBJECT_CYCLE[seed % SUBJECT_CYCLE.length];
  // Day-of-week from the key (key is YYYY-MM-DD in NY).
  const dow = new Date(`${key}T12:00:00`).getDay();
  const difficulty = DIFFICULTY_BY_DOW[dow] ?? 3;
  return { subject, difficulty };
}
