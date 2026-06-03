"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Wordmark } from "@/components/PageShell";
import { SignOutButton } from "@/components/SignOutButton";
import { GAMES } from "@/lib/games-meta";
import { readJSON } from "@/lib/storage";
import { dateKey, puzzleNumber } from "@/lib/date";
import type { GameStatsData } from "@/lib/useGameStats";

type Status = "play" | "done";

function Badge({ status }: { status: Status }) {
  if (status === "done")
    return (
      <span className="rounded-full bg-correct/15 px-2.5 py-0.5 text-xs font-medium text-correct">
        Done ✓
      </span>
    );
  return (
    <span className="rounded-full bg-ink/10 px-2.5 py-0.5 text-xs font-medium text-ink/70">
      Play
    </span>
  );
}

export default function Home() {
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const today = dateKey();

  useEffect(() => {
    const next: Record<string, Status> = {};
    for (const g of GAMES) {
      const data = readJSON<GameStatsData | null>(`docket:stats:${g.slug}`, null);
      next[g.slug] = data?.results?.[`daily:${today}`] ? "done" : "play";
    }
    setStatuses(next);
  }, [today]);

  return (
    <div className="min-h-dvh bg-parchment">
      <header className="border-b border-ink/10">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <Wordmark className="text-2xl" />
          <div className="flex items-center gap-4">
            <span className="text-sm text-ink/50">#{puzzleNumber(today)}</span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 py-8">
        <div className="mb-8 text-center">
          <h1 className="font-serif text-3xl text-ink sm:text-4xl">
            Your daily bar-prep habit
          </h1>
          <p className="mt-2 text-ink/60">
            A fresh puzzle every day, graded on settled black-letter law. Build a
            streak — or drill any subject in Practice.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {GAMES.map((g) => (
            <Link
              key={g.slug}
              href={`/games/${g.slug}`}
              className="group flex items-start gap-3 rounded-xl border border-ink/10 bg-surface p-4 transition-colors hover:border-brass/60"
            >
              <div className="text-3xl">{g.icon}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-serif text-lg text-ink">{g.name}</h2>
                  {g.beta && (
                    <span className="rounded bg-brass/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brass">
                      Beta
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm leading-snug text-ink/60">{g.blurb}</p>
                <div className="mt-2">
                  <Badge status={statuses[g.slug] ?? "play"} />
                </div>
              </div>
            </Link>
          ))}
        </div>

        <footer className="mt-10 border-t border-ink/10 pt-6 text-center text-xs text-ink/40">
          <p>
            Docket is study practice, not legal advice. Puzzles are
            model-generated and grounded in settled law, but verify anything
            before you rely on it.
          </p>
        </footer>
      </main>
    </div>
  );
}
