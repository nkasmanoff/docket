import { dateKey } from "./date";
import type { GenParams } from "./types";

// ---------------------------------------------------------------------------
// In-memory LRU cache for v1. This is correct for a single serverless instance.
// SEAM: to make Daily puzzles globally identical across instances, swap the
// get/set bodies here for Vercel KV / Redis. Nothing else needs to change.
// ---------------------------------------------------------------------------

interface Entry {
  value: unknown;
  expires: number; // epoch ms; Infinity for "until end of day" daily entries
}

const MAX_ENTRIES = 200;
const store = new Map<string, Entry>();

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function get(key: string): unknown | undefined {
  const e = store.get(key);
  if (!e) return undefined;
  if (Date.now() > e.expires) {
    store.delete(key);
    return undefined;
  }
  // LRU touch
  store.delete(key);
  store.set(key, e);
  return e.value;
}

function set(key: string, value: unknown, expires: number): void {
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key, { value, expires });
}

const PRACTICE_TTL_MS = 30 * 60 * 1000; // 30 min, so refresh doesn't re-bill

export function cacheKey(game: string, params: GenParams): string {
  const day = dateKey();
  if (params.mode === "daily") {
    return `${game}:daily:${day}`;
  }
  const h = hash(`${params.subject ?? "mixed"}:${params.difficulty}`);
  return `${game}:practice:${h}:${day}`;
}

export function getCached<T>(key: string): T | undefined {
  return get(key) as T | undefined;
}

export function setCached(key: string, value: unknown, mode: GenParams["mode"]): void {
  const expires =
    mode === "daily"
      ? endOfDayMs()
      : Date.now() + PRACTICE_TTL_MS;
  set(key, value, expires);
}

function endOfDayMs(): number {
  // Expire the daily cache a little after NY midnight.
  const now = new Date();
  const ny = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const next = new Date(ny);
  next.setHours(24, 0, 5, 0);
  return now.getTime() + (next.getTime() - ny.getTime());
}
