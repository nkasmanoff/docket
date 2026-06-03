"use client";
import { useCallback, useEffect, useState } from "react";
import { readJSON, writeJSON } from "./storage";
import { dateKey as todayKey } from "./date";
import type { Mode } from "./types";

export interface DayResult {
  dateKey: string;
  mode: Mode;
  won: boolean;
  score: number; // 0..1 normalized
  gridLines: string[]; // emoji share grid
  scoreLine?: string; // e.g. "6/8" or "1:42"
  detail?: unknown; // game-specific snapshot to re-render the result
}

export interface GameStatsData {
  played: number;
  wins: number;
  currentStreak: number;
  maxStreak: number;
  lastPlayedDate: string | null;
  recentScores: number[]; // most-recent last, capped at 10
  // Completed results keyed by `${mode}:${dateKey}`.
  results: Record<string, DayResult>;
}

const EMPTY: GameStatsData = {
  played: 0,
  wins: 0,
  currentStreak: 0,
  maxStreak: 0,
  lastPlayedDate: null,
  recentScores: [],
  results: {},
};

function key(slug: string): string {
  return `docket:stats:${slug}`;
}

function isYesterday(prev: string, today: string): boolean {
  const p = Date.parse(`${prev}T12:00:00`);
  const t = Date.parse(`${today}T12:00:00`);
  return Math.round((t - p) / 86_400_000) === 1;
}

export function useGameStats(slug: string) {
  const [data, setData] = useState<GameStatsData>(EMPTY);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setData(readJSON<GameStatsData>(key(slug), EMPTY));
    setHydrated(true);
  }, [slug]);

  const persist = useCallback(
    (next: GameStatsData) => {
      setData(next);
      writeJSON(key(slug), next);
    },
    [slug],
  );

  const recordResult = useCallback(
    (r: DayResult) => {
      setData((prev) => {
        const resultKey = `${r.mode}:${r.dateKey}`;
        // Don't double-count a re-recorded daily result.
        const already = prev.results[resultKey];
        const next: GameStatsData = {
          ...prev,
          results: { ...prev.results, [resultKey]: r },
          recentScores: [...prev.recentScores, r.score].slice(-10),
        };

        if (!already) {
          next.played = prev.played + 1;
          if (r.won) next.wins = prev.wins + 1;
        }

        // Streak logic only applies to the shared Daily puzzle.
        if (r.mode === "daily" && !already) {
          if (r.won) {
            const last = prev.lastPlayedDate;
            const continued = last && isYesterday(last, r.dateKey);
            const newStreak = continued ? prev.currentStreak + 1 : 1;
            next.currentStreak = newStreak;
            next.maxStreak = Math.max(prev.maxStreak, newStreak);
          } else {
            next.currentStreak = 0;
          }
          next.lastPlayedDate = r.dateKey;
        }

        writeJSON(key(slug), next);
        return next;
      });
    },
    [slug],
  );

  const getResult = useCallback(
    (mode: Mode, dKey: string = todayKey()): DayResult | undefined =>
      data.results[`${mode}:${dKey}`],
    [data.results],
  );

  const recentScore = useCallback((): number | undefined => {
    if (data.recentScores.length === 0) return undefined;
    const avg =
      data.recentScores.reduce((a, b) => a + b, 0) / data.recentScores.length;
    return Math.round(avg * 100) / 100;
  }, [data.recentScores]);

  const winPct =
    data.played > 0 ? Math.round((data.wins / data.played) * 100) : 0;

  return {
    data,
    hydrated,
    recordResult,
    getResult,
    recentScore,
    winPct,
    persist,
  };
}
