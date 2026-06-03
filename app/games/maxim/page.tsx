"use client";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { PuzzleLoader, LoadedPuzzle } from "@/components/PuzzleLoader";
import { ResultsModal } from "@/components/ResultsModal";
import { ReportButton } from "@/components/ReportButton";
import { Button } from "@/components/Button";
import { useToast } from "@/components/Toast";
import { useGameStats, DayResult } from "@/lib/useGameStats";
import { readJSON, writeJSON } from "@/lib/storage";
import type { MaximPuzzle } from "@/lib/types";

function rankFor(p: MaximPuzzle, pct: number): string {
  let name = p.ranks[0]?.name ?? "Clerk";
  for (const r of p.ranks) if (pct >= r.threshold) name = r.name;
  return name;
}

function Board({ loaded }: { loaded: LoadedPuzzle<MaximPuzzle> }) {
  const { puzzle, source, mode } = loaded;
  const toast = useToast();
  const stats = useGameStats("maxim");
  const saveKey = `docket:progress:maxim:${mode}:${puzzle.dateKey}:${puzzle.difficulty}`;

  const [picks, setPicks] = useState<string[]>([]);
  const [found, setFound] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    const saved = readJSON<{ found: string[] }>(saveKey, { found: [] });
    setFound(saved.found);
    setPicks([]);
    setShowResults(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveKey]);

  const pct = found.length / puzzle.maxims.length;
  const complete = found.length === puzzle.maxims.length;

  const recordIfComplete = (newFound: string[]) => {
    const done = newFound.length === puzzle.maxims.length;
    writeJSON(saveKey, { found: newFound });
    if (done) {
      const result: DayResult = {
        dateKey: puzzle.dateKey,
        mode,
        won: true,
        score: 1,
        gridLines: ["🟫".repeat(newFound.length)],
        scoreLine: `${rankFor(puzzle, 1)} ${newFound.length}/${puzzle.maxims.length}`,
      };
      stats.recordResult(result);
      setTimeout(() => setShowResults(true), 500);
    }
  };

  const submit = () => {
    const match = puzzle.maxims.find(
      (m) =>
        m.tiles.length === picks.length &&
        m.tiles.every((t, i) => t === picks[i]),
    );
    if (!match) {
      toast.show("Not a maxim");
      setPicks([]);
      return;
    }
    if (found.includes(match.phrase)) {
      toast.show("Already found");
      setPicks([]);
      return;
    }
    const newFound = [...found, match.phrase];
    setFound(newFound);
    setPicks([]);
    toast.show(match.phrase);
    recordIfComplete(newFound);
  };

  const result = stats.getResult(mode, puzzle.dateKey);

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="text-center text-sm text-ink/60">
        Rank: <strong className="text-ink">{rankFor(puzzle, pct)}</strong> ·{" "}
        {found.length}/{puzzle.maxims.length} maxims
      </div>

      {/* Found maxims */}
      <div className="w-full space-y-2">
        {puzzle.maxims
          .filter((m) => found.includes(m.phrase))
          .map((m) => (
            <div key={m.phrase} className="rounded bg-brass/10 p-3">
              <div className="font-serif text-lg text-ink">{m.phrase}</div>
              <div className="text-sm text-ink/70">{m.meaning}</div>
            </div>
          ))}
      </div>

      {!complete && (
        <>
          {/* Current assembly */}
          <div className="flex min-h-12 w-full flex-wrap items-center justify-center gap-1.5 rounded border border-dashed border-ink/30 p-2">
            {picks.length === 0 ? (
              <span className="text-sm text-ink/40">Tap tiles to build a maxim…</span>
            ) : (
              picks.map((t, i) => (
                <span key={i} className="rounded bg-ink px-2 py-1 text-sm text-parchment">
                  {t}
                </span>
              ))
            )}
          </div>

          {/* Tile pool */}
          <div className="flex flex-wrap justify-center gap-2">
            {puzzle.tilePool.map((t, i) => (
              <button
                key={`${t}-${i}`}
                onClick={() => setPicks((p) => [...p, t])}
                className="rounded border border-ink/15 bg-surface px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-ink/5"
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setPicks([])} disabled={!picks.length}>
              Clear
            </Button>
            <Button onClick={submit} disabled={!picks.length}>
              Submit
            </Button>
          </div>
        </>
      )}

      <div className="flex items-center gap-3">
        {complete && (
          <button onClick={() => setShowResults(true)} className="text-sm font-medium text-brass hover:underline">
            View result
          </button>
        )}
        <ReportButton puzzle={puzzle} />
      </div>

      {result && (
        <ResultsModal
          open={showResults}
          onClose={() => setShowResults(false)}
          gameName="Maxim"
          result={result}
          source={source}
          takeaways={puzzle.maxims.map((m) => ({ label: m.phrase, text: m.meaning }))}
          stats={{
            currentStreak: stats.data.currentStreak,
            maxStreak: stats.data.maxStreak,
            winPct: stats.winPct,
            played: stats.data.played,
          }}
        />
      )}
    </div>
  );
}

export default function MaximPage() {
  return (
    <PageShell back>
      <h1 className="mb-1 text-center font-serif text-3xl">
        Maxim <span className="align-middle text-xs uppercase tracking-wide text-brass">Beta</span>
      </h1>
      <PuzzleLoader<MaximPuzzle> slug="maxim">
        {(loaded) => <Board loaded={loaded} />}
      </PuzzleLoader>
    </PageShell>
  );
}
