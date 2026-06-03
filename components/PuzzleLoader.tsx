"use client";
import { useCallback, useEffect, useState } from "react";
import { Button } from "./Button";
import { Calibrator, CalibrationBar, CalibrationProfile } from "./Calibrator";
import { gameMeta } from "@/lib/games-meta";
import { useGameStats } from "@/lib/useGameStats";
import { readJSON, writeJSON } from "@/lib/storage";
import type { Mode } from "@/lib/types";

export interface LoadedPuzzle<T> {
  puzzle: T;
  source: "generated" | "fallback";
  difficulty: number;
  mode: Mode;
  reload: () => void;
}

interface Props<T> {
  slug: string;
  children: (loaded: LoadedPuzzle<T>) => React.ReactNode;
}

type Phase = "calibrate" | "loading" | "ready" | "error";

function calibKey(slug: string) {
  return `docket:calib:${slug}`;
}

export function PuzzleLoader<T>({ slug, children }: Props<T>) {
  const meta = gameMeta(slug);
  const { recentScore } = useGameStats(slug);

  const [mode, setMode] = useState<Mode>("daily");
  const [profile, setProfile] = useState<CalibrationProfile | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [data, setData] = useState<{
    puzzle: T;
    source: "generated" | "fallback";
    difficulty: number;
  } | null>(null);
  const [error, setError] = useState<string>("");
  const [forceCalib, setForceCalib] = useState(false);

  // Load any saved practice profile once.
  useEffect(() => {
    setProfile(readJSON<CalibrationProfile | null>(calibKey(slug), null));
  }, [slug]);

  const fetchPuzzle = useCallback(
    async (m: Mode, p: CalibrationProfile | null) => {
      setPhase("loading");
      setError("");
      try {
        const body =
          m === "daily"
            ? { mode: "daily" }
            : {
                mode: "practice",
                subject: p?.subject,
                difficulty: p?.difficulty ?? 3,
                recentScore: recentScore(),
              };
        const res = await fetch(`/api/puzzle/${slug}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `Request failed (${res.status})`);
        }
        const j = await res.json();
        setData({ puzzle: j.puzzle, source: j.source, difficulty: j.difficulty });
        setPhase("ready");
      } catch (e) {
        setError((e as Error).message);
        setPhase("error");
      }
    },
    [slug, recentScore],
  );

  // Drive fetching based on mode + profile.
  useEffect(() => {
    if (mode === "daily") {
      void fetchPuzzle("daily", null);
      return;
    }
    // practice
    if (!profile || forceCalib) {
      setPhase("calibrate");
    } else {
      void fetchPuzzle("practice", profile);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, profile, forceCalib]);

  if (!meta) return <p className="text-error">Unknown game: {slug}</p>;

  const onCalibrated = (p: CalibrationProfile) => {
    writeJSON(calibKey(slug), p);
    setProfile(p);
    setForceCalib(false);
  };

  const reload = () => {
    if (mode === "daily") void fetchPuzzle("daily", null);
    else void fetchPuzzle("practice", profile);
  };

  return (
    <div>
      {/* Mode tabs — Daily leads, Practice below the fold of the toggle. */}
      <div
        role="tablist"
        aria-label="Puzzle mode"
        className="mx-auto mb-5 grid w-full max-w-xs grid-cols-2 rounded-full border border-ink/15 bg-surface p-1 text-sm"
      >
        {(["daily", "practice"] as Mode[]).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`rounded-full px-3 py-1.5 capitalize transition-colors ${
              mode === m ? "bg-ink text-parchment" : "text-ink/60 hover:text-ink"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {mode === "practice" && profile && !forceCalib && phase !== "calibrate" && (
        <CalibrationBar
          profile={profile}
          config={meta.calibrator}
          onChange={() => setForceCalib(true)}
          onRegenerate={reload}
        />
      )}

      {phase === "calibrate" && (
        <Calibrator config={meta.calibrator} onComplete={onCalibrated} />
      )}

      {phase === "loading" && <LoadingCard mode={mode} />}

      {phase === "error" && (
        <div className="rounded-2xl border border-error/30 bg-surface p-6 text-center">
          <p className="mb-3 text-ink">Couldn&apos;t load a puzzle.</p>
          <p className="mb-4 text-sm text-ink/60">{error}</p>
          <Button onClick={reload}>Retry</Button>
        </div>
      )}

      {phase === "ready" &&
        data &&
        children({
          puzzle: data.puzzle,
          source: data.source,
          difficulty: data.difficulty,
          mode,
          reload,
        })}
    </div>
  );
}

function LoadingCard({ mode }: { mode: Mode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-ink/10 bg-surface p-12 text-center">
      <div className="text-4xl motion-safe:animate-pop">⚖️</div>
      <p className="font-serif text-lg text-ink">
        {mode === "daily" ? "Drafting today's puzzle…" : "Calibrating your puzzle…"}
      </p>
      <p className="text-sm text-ink/50">Grounding it in settled law.</p>
    </div>
  );
}
