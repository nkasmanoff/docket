"use client";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { PuzzleLoader, LoadedPuzzle } from "@/components/PuzzleLoader";
import { ResultsModal } from "@/components/ResultsModal";
import { ReportButton } from "@/components/ReportButton";
import { Button } from "@/components/Button";
import { useGameStats, DayResult } from "@/lib/useGameStats";
import { readJSON, writeJSON } from "@/lib/storage";
import type { IssueSpotterPuzzle } from "@/lib/types";

interface RoundScore {
  hits: number;
  falseAlarms: number;
  truth: number;
  gridLine: string;
}

function Board({ loaded }: { loaded: LoadedPuzzle<IssueSpotterPuzzle> }) {
  const { puzzle, source, mode } = loaded;
  const stats = useGameStats("issue-spotter");
  const rounds = puzzle.rounds;
  const saveKey = `docket:progress:issue-spotter:${mode}:${puzzle.dateKey}:${puzzle.subject ?? "x"}:${puzzle.difficulty}`;

  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [scores, setScores] = useState<RoundScore[]>([]);
  const [done, setDone] = useState(false);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    const saved = readJSON<{ scores: RoundScore[]; done: boolean } | null>(saveKey, null);
    if (saved && saved.scores.length > 0) {
      setScores(saved.scores);
      setDone(saved.done);
      setIdx(saved.done ? rounds.length : saved.scores.length);
      setShowResults(saved.done);
    } else {
      setScores([]);
      setDone(false);
      setIdx(0);
      setShowResults(false);
    }
    setSelected([]);
    setRevealed(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveKey]);

  const round = rounds[idx];

  const finish = (finalScores: RoundScore[]) => {
    setDone(true);
    const totalHits = finalScores.reduce((a, s) => a + s.hits, 0);
    const totalTruth = finalScores.reduce((a, s) => a + s.truth, 0);
    const norm =
      finalScores.reduce(
        (a, s) => a + Math.max(0, s.hits - s.falseAlarms) / s.truth,
        0,
      ) / finalScores.length;
    const result: DayResult = {
      dateKey: puzzle.dateKey,
      mode,
      won: norm >= 0.8,
      score: Math.round(norm * 100) / 100,
      gridLines: finalScores.map((s) => s.gridLine),
      scoreLine: `${totalHits}/${totalTruth} issues`,
    };
    stats.recordResult(result);
    writeJSON(saveKey, { scores: finalScores, done: true });
    setTimeout(() => setShowResults(true), 600);
  };

  const submit = () => {
    setRevealed(true);
    const present = round.options
      .map((o, i) => ({ o, i }))
      .filter(({ o }) => o.present);
    const hits = present.filter(({ i }) => selected.includes(i)).length;
    const falseAlarms = selected.filter((i) => !round.options[i].present).length;
    const truth = present.length;
    const gridLine =
      present.map(({ i }) => (selected.includes(i) ? "🟩" : "⬛")).join("") +
      "🟥".repeat(falseAlarms);
    const sc: RoundScore = { hits, falseAlarms, truth, gridLine };
    const newScores = [...scores, sc];
    setScores(newScores);
    writeJSON(saveKey, { scores: newScores, done: false });
  };

  const next = () => {
    setRevealed(false);
    setSelected([]);
    if (idx + 1 >= rounds.length) finish(scores);
    else setIdx(idx + 1);
  };

  const result = stats.getResult(mode, puzzle.dateKey);

  if (done && result) {
    return (
      <div className="flex flex-col items-center gap-4">
        <p className="font-serif text-2xl">{result.scoreLine}</p>
        <div className="font-mono text-xl leading-tight">
          {result.gridLines.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowResults(true)} className="text-sm font-medium text-brass hover:underline">
            View result
          </button>
          <ReportButton puzzle={puzzle} />
        </div>
        <ResultsModal
          open={showResults}
          onClose={() => setShowResults(false)}
          gameName="Issue Spotter"
          result={result}
          source={source}
          takeaways={rounds.flatMap((r) =>
            r.options.filter((o) => o.present).slice(0, 2).map((o) => ({ label: o.label, text: o.why })),
          )}
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

  if (!round) return null;

  return (
    <div className="flex flex-col gap-5">
      <div className="text-sm text-ink/50">
        Fact pattern {idx + 1} / {rounds.length} · {round.subject}
      </div>
      <div className="rounded-2xl border border-ink/10 bg-surface p-5">
        <p className="leading-relaxed text-ink">{round.facts}</p>
      </div>
      <p className="text-sm text-ink/60">Tap every issue these facts actually raise.</p>
      <div className="flex flex-col gap-2">
        {round.options.map((o, i) => {
          const sel = selected.includes(i);
          let state = "default";
          if (revealed) {
            if (o.present && sel) state = "hit";
            else if (o.present && !sel) state = "missed";
            else if (!o.present && sel) state = "false";
            else state = "muted";
          } else if (sel) state = "selected";
          const cls: Record<string, string> = {
            default: "border-ink/15 bg-surface hover:border-ink/40",
            selected: "border-ink bg-ink/5",
            hit: "border-correct bg-correct/10",
            missed: "border-partial bg-partial/10",
            false: "border-error bg-error/10",
            muted: "border-ink/10 bg-ink/[0.02] opacity-70",
          };
          return (
            <button
              key={i}
              disabled={revealed}
              onClick={() =>
                setSelected((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]))
              }
              className={`rounded-lg border-2 p-3 text-left transition-colors ${cls[state]}`}
            >
              <div className="flex items-start gap-2">
                <span
                  className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded border text-xs ${sel ? "border-ink bg-ink text-parchment" : "border-ink/30"}`}
                >
                  {sel ? "✓" : ""}
                </span>
                <span className="flex-1">
                  <span className="text-sm font-medium text-ink">{o.label}</span>
                  {revealed && (
                    <span className="mt-1 block text-xs text-ink/60">
                      {o.present ? "Raised — " : "Red herring — "}
                      {o.why}
                    </span>
                  )}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <ReportButton puzzle={puzzle} />
        {!revealed ? (
          <Button onClick={submit}>Submit</Button>
        ) : (
          <Button onClick={next}>
            {idx + 1 >= rounds.length ? "See results" : "Next pattern"}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function IssueSpotterPage() {
  return (
    <PageShell back>
      <h1 className="mb-1 text-center font-serif text-3xl">Issue Spotter</h1>
      <PuzzleLoader<IssueSpotterPuzzle> slug="issue-spotter">
        {(loaded) => <Board loaded={loaded} />}
      </PuzzleLoader>
    </PageShell>
  );
}
