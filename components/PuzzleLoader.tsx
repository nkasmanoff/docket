"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "./Button";
import { gameMeta, isGameEnabled } from "@/lib/games-meta";
import type { Mode } from "@/lib/types";

export interface LoadedPuzzle<T> {
  puzzle: T;
  source: "generated" | "fallback";
  difficulty: number;
  mode: Mode;
}

interface Props<T> {
  slug: string;
  children: (loaded: LoadedPuzzle<T>) => React.ReactNode;
}

type Phase = "loading" | "ready" | "error";

export function PuzzleLoader<T>({ slug, children }: Props<T>) {
  const meta = gameMeta(slug);
  const enabled = isGameEnabled(slug);

  const [phase, setPhase] = useState<Phase>("loading");
  const [data, setData] = useState<{
    puzzle: T;
    source: "generated" | "fallback";
    difficulty: number;
  } | null>(null);
  const [error, setError] = useState("");

  const fetchPuzzle = useCallback(async () => {
    setPhase("loading");
    setError("");
    try {
      const res = await fetch(`/api/puzzle/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "daily" }),
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
  }, [slug]);

  useEffect(() => {
    if (enabled) void fetchPuzzle();
  }, [enabled, fetchPuzzle]);

  if (!meta) return <p className="text-error">Unknown game: {slug}</p>;

  if (!enabled) {
    return (
      <div className="rounded-2xl border border-ink/10 bg-surface p-8 text-center">
        <p className="font-serif text-lg text-ink">{meta.name} is unavailable.</p>
        <p className="mt-2 text-sm text-ink/60">This game isn&apos;t in the daily lineup right now.</p>
        <Link
          href="/"
          className="mt-4 inline-block text-sm font-medium text-brass hover:underline"
        >
          ← All games
        </Link>
      </div>
    );
  }

  return (
    <div>
      {phase === "loading" && <LoadingCard />}

      {phase === "error" && (
        <div className="rounded-2xl border border-error/30 bg-surface p-6 text-center">
          <p className="mb-3 text-ink">Couldn&apos;t load a puzzle.</p>
          <p className="mb-4 text-sm text-ink/60">{error}</p>
          <Button onClick={() => void fetchPuzzle()}>Retry</Button>
        </div>
      )}

      {phase === "ready" &&
        data &&
        children({
          puzzle: data.puzzle,
          source: data.source,
          difficulty: data.difficulty,
          mode: "daily",
        })}
    </div>
  );
}

function LoadingCard() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-ink/10 bg-surface p-12 text-center">
      <div className="text-4xl motion-safe:animate-pop">⚖️</div>
      <p className="font-serif text-lg text-ink">Drafting today&apos;s puzzle…</p>
      <p className="text-sm text-ink/50">Grounding it in settled law.</p>
    </div>
  );
}
