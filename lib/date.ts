// All daily mechanics anchor to America/New_York so the streak and "puzzle #N"
// are identical for every player regardless of their local timezone.
export const TZ = "America/New_York";

// YYYY-MM-DD in New York time.
export function dateKey(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

// Epoch (the brand's day 0) used to number daily puzzles "#N".
const EPOCH = "2026-01-01";

export function puzzleNumber(key: string = dateKey()): number {
  const a = Date.parse(`${EPOCH}T00:00:00`);
  const b = Date.parse(`${key}T00:00:00`);
  return Math.floor((b - a) / 86_400_000) + 1;
}

// Deterministic integer derived from a date key — used to seed daily rotations.
export function dailySeed(key: string = dateKey()): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) >>> 0;
  }
  return h;
}

// Milliseconds until the next NY midnight (for the results-modal countdown).
export function msUntilNextDay(now: Date = new Date()): number {
  const ny = new Date(now.toLocaleString("en-US", { timeZone: TZ }));
  const next = new Date(ny);
  next.setHours(24, 0, 0, 0);
  return next.getTime() - ny.getTime();
}
