"use client";
import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { ShareButton } from "./ShareButton";
import { msUntilNextDay } from "@/lib/date";
import type { DayResult } from "@/lib/useGameStats";

export interface Takeaway {
  label: string;
  text: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  gameName: string;
  result: DayResult;
  takeaways: Takeaway[];
  stats: {
    currentStreak: number;
    maxStreak: number;
    winPct: number;
    played: number;
  };
  source?: "generated" | "fallback";
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="text-center">
      <div className="font-serif text-2xl text-ink">{value}</div>
      <div className="text-xs uppercase tracking-wide text-ink/50">{label}</div>
    </div>
  );
}

function Countdown() {
  const [ms, setMs] = useState(msUntilNextDay());
  useEffect(() => {
    const t = setInterval(() => setMs(msUntilNextDay()), 1000);
    return () => clearInterval(t);
  }, []);
  const h = Math.floor(ms / 3.6e6);
  const m = Math.floor((ms % 3.6e6) / 6e4);
  const s = Math.floor((ms % 6e4) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <div className="text-center">
      <div className="text-xs uppercase tracking-wide text-ink/50">
        Next puzzle in
      </div>
      <div className="font-mono text-xl text-ink">
        {pad(h)}:{pad(m)}:{pad(s)}
      </div>
    </div>
  );
}

export function ResultsModal({
  open,
  onClose,
  gameName,
  result,
  takeaways,
  stats,
  source,
}: Props) {
  return (
    <Modal open={open} onClose={onClose} title={result.won ? "Well argued" : "Overruled"}>
      <div className="space-y-5">
        {source === "fallback" && (
          <p className="rounded bg-partial/15 px-3 py-2 text-center text-xs text-ink/70">
            Offline puzzle — served from a bundled example.
          </p>
        )}

        {/* Emoji grid preview */}
        <div className="rounded bg-ink/5 py-3 text-center font-mono text-lg leading-tight">
          {result.gridLines.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>

        {/* Stats */}
        <div className="flex items-center justify-around">
          <Stat value={stats.played} label="Played" />
          <Stat value={`${stats.winPct}%`} label="Win" />
          <Stat value={stats.currentStreak} label="Streak" />
          <Stat value={stats.maxStreak} label="Max" />
        </div>

        {/* Learn it */}
        {takeaways.length > 0 && (
          <div className="rounded border border-ink/10 bg-surface p-3">
            <div className="mb-2 font-serif text-sm font-semibold text-brass">
              Learn it
            </div>
            <ul className="space-y-1.5">
              {takeaways.map((t, i) => (
                <li key={i} className="text-sm leading-snug text-ink/80">
                  <span className="font-medium text-ink">{t.label}:</span>{" "}
                  {t.text}
                </li>
              ))}
            </ul>
          </div>
        )}

        <ShareButton
          share={{
            gameName,
            dateKey: result.dateKey,
            mode: result.mode,
            gridLines: result.gridLines,
            scoreLine: result.scoreLine,
          }}
        />

        <Countdown />
      </div>
    </Modal>
  );
}
