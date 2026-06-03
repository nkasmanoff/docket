"use client";
import { useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { PuzzleLoader, LoadedPuzzle } from "@/components/PuzzleLoader";
import { ResultsModal } from "@/components/ResultsModal";
import { ReportButton } from "@/components/ReportButton";
import { Button } from "@/components/Button";
import { useGameStats, DayResult } from "@/lib/useGameStats";
import { readJSON, writeJSON } from "@/lib/storage";
import type { ElementsPuzzle } from "@/lib/types";

type Mark = "exact" | "partial" | "wrong";

function shuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed || 7;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function Board({ loaded }: { loaded: LoadedPuzzle<ElementsPuzzle> }) {
  const { puzzle, source, mode, reload } = loaded;
  const stats = useGameStats("elements");
  const rounds = puzzle.rounds;
  const saveKey = `docket:progress:elements:${mode}:${puzzle.dateKey}:${puzzle.subject ?? "x"}:${puzzle.difficulty}`;

  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [done, setDone] = useState(false);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    const saved = readJSON<{ marks: Mark[]; done: boolean } | null>(saveKey, null);
    if (saved && saved.marks.length > 0) {
      setMarks(saved.marks);
      setDone(saved.done);
      setIdx(saved.done ? rounds.length : saved.marks.length);
      setShowResults(saved.done);
    } else {
      setMarks([]);
      setDone(false);
      setIdx(0);
      setShowResults(false);
    }
    setSelected([]);
    setRevealed(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveKey]);

  const round = rounds[idx];
  const tiles = useMemo(
    () =>
      round
        ? shuffle([...round.required, ...round.distractors], idx * 31 + round.required.length)
        : [],
    [round, idx],
  );

  const requiredSet = useMemo(
    () => new Set((round?.required ?? []).map((x) => x.toLowerCase())),
    [round],
  );

  const finish = (finalMarks: Mark[]) => {
    setDone(true);
    const exact = finalMarks.filter((m) => m === "exact").length;
    const gridLines = [
      finalMarks.map((m) => (m === "exact" ? "✅" : m === "partial" ? "🟨" : "❌")).join(""),
    ];
    const result: DayResult = {
      dateKey: puzzle.dateKey,
      mode,
      won: exact === rounds.length,
      score: exact / rounds.length,
      gridLines,
      scoreLine: `${exact}/${rounds.length}`,
    };
    stats.recordResult(result);
    writeJSON(saveKey, { marks: finalMarks, done: true });
    setTimeout(() => setShowResults(true), 600);
  };

  const submit = () => {
    setRevealed(true);
    const wrongIncluded = selected.filter((s) => !requiredSet.has(s.toLowerCase()));
    const missed = round.required.filter(
      (r) => !selected.some((s) => s.toLowerCase() === r.toLowerCase()),
    );
    const correctIncluded = selected.filter((s) => requiredSet.has(s.toLowerCase()));
    const mark: Mark =
      wrongIncluded.length === 0 && missed.length === 0
        ? "exact"
        : correctIncluded.length > 0
          ? "partial"
          : "wrong";
    const newMarks = [...marks, mark];
    setMarks(newMarks);
    writeJSON(saveKey, { marks: newMarks, done: false });
  };

  const next = () => {
    setRevealed(false);
    setSelected([]);
    if (idx + 1 >= rounds.length) finish(marks);
    else setIdx(idx + 1);
  };

  const result = stats.getResult(mode, puzzle.dateKey);

  if (done && result) {
    return (
      <div className="flex flex-col items-center gap-4">
        <p className="font-serif text-2xl">{result.scoreLine} exact</p>
        <div className="font-mono text-3xl">{result.gridLines[0]}</div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowResults(true)} className="text-sm font-medium text-brass hover:underline">
            View result
          </button>
          <ReportButton puzzle={puzzle} />
        </div>
        <ResultsModal
          open={showResults}
          onClose={() => setShowResults(false)}
          gameName="Elements"
          result={result}
          source={source}
          takeaways={rounds.map((r) => ({ label: r.claim, text: r.ruleStatement }))}
          stats={{
            currentStreak: stats.data.currentStreak,
            maxStreak: stats.data.maxStreak,
            winPct: stats.winPct,
            played: stats.data.played,
          }}
          onReplay={mode === "practice" ? reload : undefined}
        />
      </div>
    );
  }

  if (!round) return null;

  const tileMark = (t: string) => {
    if (!revealed) return selected.includes(t) ? "selected" : "default";
    const isReq = requiredSet.has(t.toLowerCase());
    const isSel = selected.includes(t);
    if (isSel && isReq) return "correct";
    if (isSel && !isReq) return "wrong";
    if (!isSel && isReq) return "missed";
    return "default";
  };

  const cls: Record<string, string> = {
    default: "bg-surface border-ink/15 text-ink hover:border-ink/40",
    selected: "bg-ink border-ink text-parchment",
    correct: "bg-correct border-correct text-white",
    wrong: "bg-error border-error text-white",
    missed: "bg-partial border-partial text-ink",
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="text-sm text-ink/50">
        Round {idx + 1} / {rounds.length}
      </div>
      <div className="rounded-2xl border border-ink/10 bg-surface p-5 text-center">
        <div className="text-xs uppercase tracking-wide text-ink/50">Build the claim</div>
        <div className="font-serif text-2xl text-ink">{round.claim}</div>
      </div>
      <p className="text-center text-sm text-ink/60">
        Tap the required elements. Leave out the distractors.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {tiles.map((t) => (
          <button
            key={t}
            disabled={revealed}
            onClick={() =>
              setSelected((s) =>
                s.includes(t) ? s.filter((x) => x !== t) : [...s, t],
              )
            }
            className={`min-h-14 rounded border-2 px-3 py-2 text-sm font-medium transition-colors ${cls[tileMark(t)]}`}
          >
            {t}
          </button>
        ))}
      </div>

      {revealed && (
        <div className="rounded-lg bg-ink/5 p-4 text-sm">
          <div className="mb-1 font-semibold text-brass">Rule</div>
          <p className="text-ink/80">{round.ruleStatement}</p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <ReportButton puzzle={puzzle} />
        {!revealed ? (
          <Button onClick={submit} disabled={selected.length === 0}>
            Submit complaint
          </Button>
        ) : (
          <Button onClick={next}>
            {idx + 1 >= rounds.length ? "See results" : "Next claim"}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function ElementsPage() {
  return (
    <PageShell back>
      <h1 className="mb-1 text-center font-serif text-3xl">Elements</h1>
      <PuzzleLoader<ElementsPuzzle> slug="elements">
        {(loaded) => <Board loaded={loaded} />}
      </PuzzleLoader>
    </PageShell>
  );
}
