"use client";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { PuzzleLoader, LoadedPuzzle } from "@/components/PuzzleLoader";
import { ResultsModal } from "@/components/ResultsModal";
import { ReportButton } from "@/components/ReportButton";
import { Button } from "@/components/Button";
import { useGameStats, DayResult } from "@/lib/useGameStats";
import { readJSON, writeJSON } from "@/lib/storage";
import type { ObjectionPuzzle } from "@/lib/types";

interface ItemResult {
  rulingCorrect: boolean;
  groundsCorrect: boolean;
}

function Board({ loaded }: { loaded: LoadedPuzzle<ObjectionPuzzle> }) {
  const { puzzle, source, mode } = loaded;
  const stats = useGameStats("objection");
  const items = puzzle.items;

  const saveKey = `docket:progress:objection:${mode}:${puzzle.dateKey}:${puzzle.subject ?? "x"}:${puzzle.difficulty}`;

  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<"ruling" | "grounds" | "feedback">("ruling");
  const [pickRuling, setPickRuling] = useState<"Sustained" | "Overruled" | null>(null);
  const [pickGrounds, setPickGrounds] = useState<string | null>(null);
  const [results, setResults] = useState<ItemResult[]>([]);
  const [done, setDone] = useState(false);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    const saved = readJSON<{ results: ItemResult[]; done: boolean } | null>(saveKey, null);
    if (saved && saved.results.length > 0) {
      setResults(saved.results);
      setDone(saved.done);
      setIdx(saved.done ? items.length : saved.results.length);
      setShowResults(saved.done);
      setPhase("ruling");
    } else {
      setResults([]);
      setDone(false);
      setIdx(0);
      setPhase("ruling");
      setShowResults(false);
    }
    setPickRuling(null);
    setPickGrounds(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveKey]);

  const item = items[idx];

  const finish = (finalResults: ItemResult[]) => {
    setDone(true);
    const gridLines = [
      finalResults
        .map((r) =>
          r.rulingCorrect && r.groundsCorrect ? "✅" : r.rulingCorrect ? "🟨" : "❌",
        )
        .join(""),
    ];
    const full = finalResults.filter((r) => r.rulingCorrect && r.groundsCorrect).length;
    const result: DayResult = {
      dateKey: puzzle.dateKey,
      mode,
      won: full >= 6,
      score: full / items.length,
      gridLines,
      scoreLine: `${full}/${items.length}`,
    };
    stats.recordResult(result);
    writeJSON(saveKey, { results: finalResults, done: true });
    setTimeout(() => setShowResults(true), 600);
  };

  const confirmGrounds = () => {
    if (!pickGrounds || !pickRuling) return;
    setPhase("feedback");
  };

  const next = () => {
    const r: ItemResult = {
      rulingCorrect: pickRuling === item.ruling,
      groundsCorrect: pickGrounds === item.correctGrounds,
    };
    const newResults = [...results, r];
    setResults(newResults);
    writeJSON(saveKey, { results: newResults, done: false });
    setPickRuling(null);
    setPickGrounds(null);
    setPhase("ruling");
    if (idx + 1 >= items.length) finish(newResults);
    else setIdx(idx + 1);
  };

  const result = stats.getResult(mode, puzzle.dateKey);

  if (done && result) {
    return (
      <ResultsView
        stats={stats}
        result={result}
        source={source}
        puzzle={puzzle}
        showResults={showResults}
        setShowResults={setShowResults}
      />
    );
  }

  if (!item) return null;
  const ruledCorrectly = pickRuling === item.ruling;
  const groundsCorrectly = pickGrounds === item.correctGrounds;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between text-sm text-ink/50">
        <span>
          Item {idx + 1} / {items.length}
        </span>
        <span className="flex gap-1">
          {items.map((_, i) => (
            <span
              key={i}
              className={`h-2 w-2 rounded-full ${i < results.length ? "bg-ink" : i === idx ? "bg-brass" : "bg-ink/20"}`}
            />
          ))}
        </span>
      </div>

      <div className="rounded-2xl border border-ink/10 bg-surface p-5">
        <p className="text-lg leading-relaxed text-ink">{item.scenario}</p>
      </div>

      {/* Step 1: ruling */}
      <div>
        <div className="mb-2 text-sm font-medium text-ink/60">The ruling?</div>
        <div className="grid grid-cols-2 gap-2">
          {(["Sustained", "Overruled"] as const).map((r) => (
            <button
              key={r}
              disabled={phase !== "ruling"}
              onClick={() => {
                setPickRuling(r);
                setPhase("grounds");
              }}
              className={`rounded-lg border-2 px-4 py-3 font-semibold transition-colors ${
                pickRuling === r
                  ? phase === "feedback"
                    ? r === item.ruling
                      ? "border-correct bg-correct/10"
                      : "border-error bg-error/10"
                    : "border-ink bg-ink text-parchment"
                  : "border-ink/15 bg-surface hover:border-ink/40 disabled:opacity-50"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Step 2: grounds */}
      {phase !== "ruling" && (
        <div>
          <div className="mb-2 text-sm font-medium text-ink/60">On what grounds?</div>
          <div className="grid gap-2">
            {item.groundsOptions.map((g) => {
              const picked = pickGrounds === g;
              const reveal = phase === "feedback";
              const isRight = g === item.correctGrounds;
              return (
                <button
                  key={g}
                  disabled={phase === "feedback"}
                  onClick={() => setPickGrounds(g)}
                  className={`rounded-lg border-2 px-4 py-2.5 text-left text-sm transition-colors ${
                    reveal && isRight
                      ? "border-correct bg-correct/10"
                      : reveal && picked && !isRight
                        ? "border-error bg-error/10"
                        : picked
                          ? "border-ink bg-ink text-parchment"
                          : "border-ink/15 bg-surface hover:border-ink/40"
                  }`}
                >
                  {g}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Feedback */}
      {phase === "feedback" && (
        <div
          className={`rounded-lg p-4 text-sm ${ruledCorrectly && groundsCorrectly ? "bg-correct/10" : "bg-partial/10"}`}
        >
          <div className="mb-1 font-semibold">
            {ruledCorrectly && groundsCorrectly
              ? "Correct — ruling and grounds."
              : ruledCorrectly
                ? "Right ruling, wrong grounds."
                : "Not quite."}
          </div>
          <p className="text-ink/80">{item.explanation}</p>
          <div className="mt-2 text-ink/60">
            Answer: <strong>{item.ruling}</strong> — {item.correctGrounds}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <ReportButton puzzle={puzzle} />
        {phase === "grounds" && (
          <Button onClick={confirmGrounds} disabled={!pickGrounds}>
            Lock it in
          </Button>
        )}
        {phase === "feedback" && (
          <Button onClick={next}>
            {idx + 1 >= items.length ? "See results" : "Next item"}
          </Button>
        )}
      </div>
    </div>
  );
}

function ResultsView({
  stats,
  result,
  source,
  puzzle,
  showResults,
  setShowResults,
}: any) {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="font-serif text-2xl">{result.scoreLine} correct</p>
      <div className="font-mono text-2xl">{result.gridLines[0]}</div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowResults(true)}
          className="text-sm font-medium text-brass hover:underline"
        >
          View result
        </button>
        <ReportButton puzzle={puzzle} />
      </div>
      <ResultsModal
        open={showResults}
        onClose={() => setShowResults(false)}
        gameName="Objection!"
        result={result}
        source={source}
        takeaways={(puzzle.items as ObjectionPuzzle["items"])
          .slice(0, 4)
          .map((it) => ({ label: it.correctGrounds, text: it.explanation }))}
        stats={{
          currentStreak: stats.data.currentStreak,
          maxStreak: stats.data.maxStreak,
          winPct: stats.winPct,
          played: stats.data.played,
        }}
      />
    </div>
  );
}

export default function ObjectionPage() {
  return (
    <PageShell back>
      <h1 className="mb-1 text-center font-serif text-3xl">Objection!</h1>
      <PuzzleLoader<ObjectionPuzzle> slug="objection">
        {(loaded) => <Board loaded={loaded} />}
      </PuzzleLoader>
    </PageShell>
  );
}
