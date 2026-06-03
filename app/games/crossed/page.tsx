"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { PuzzleLoader, LoadedPuzzle } from "@/components/PuzzleLoader";
import { ResultsModal } from "@/components/ResultsModal";
import { ReportButton } from "@/components/ReportButton";
import { Button } from "@/components/Button";
import { useToast } from "@/components/Toast";
import { useGameStats, DayResult } from "@/lib/useGameStats";
import { readJSON, writeJSON } from "@/lib/storage";
import type { CrossedPuzzle } from "@/lib/types";

const EMOJI: Record<number, string> = { 1: "🟨", 2: "🟩", 3: "🟦", 4: "🟪" };
const BAND: Record<number, string> = {
  1: "bg-[#e8c947] text-ink",
  2: "bg-correct text-white",
  3: "bg-[#3b6fb0] text-white",
  4: "bg-[#7a5ca8] text-white",
};
const MAX_MISTAKES = 4;

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface SaveState {
  order: string[];
  solved: string[]; // group names
  mistakes: number;
  history: string[][]; // each guess = 4 member strings
  finished: boolean;
}

function Board({ loaded }: { loaded: LoadedPuzzle<CrossedPuzzle> }) {
  const { puzzle, source, mode } = loaded;
  const toast = useToast();
  const stats = useGameStats("crossed");

  // Member -> group lookup.
  const memberGroup = useMemo(() => {
    const m = new Map<string, (typeof puzzle.groups)[number]>();
    for (const g of puzzle.groups) for (const mem of g.members) m.set(mem, g);
    return m;
  }, [puzzle]);

  const allMembers = useMemo(
    () => puzzle.groups.flatMap((g) => g.members),
    [puzzle],
  );

  const saveKey = `docket:progress:crossed:${mode}:${puzzle.dateKey}:${puzzle.subject ?? "x"}:${puzzle.difficulty}`;
  const seed = useMemo(() => {
    let h = 0;
    for (const ch of saveKey) h = (h * 31 + ch.charCodeAt(0)) & 0x7fffffff;
    return h;
  }, [saveKey]);

  const [order, setOrder] = useState<string[]>([]);
  const [solved, setSolved] = useState<string[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [history, setHistory] = useState<string[][]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    const saved = readJSON<SaveState | null>(saveKey, null);
    // Only resume if the saved order is exactly this puzzle's members — a live
    // puzzle can replace a previously-cached one under the same params key.
    const matches =
      saved &&
      saved.order.length === allMembers.length &&
      saved.order.every((m) => memberGroup.has(m));
    if (saved && matches) {
      setOrder(saved.order);
      setSolved(saved.solved);
      setMistakes(saved.mistakes);
      setHistory(saved.history);
      setFinished(saved.finished);
      setShowResults(saved.finished);
    } else {
      setOrder(seededShuffle(allMembers, seed));
      setSolved([]);
      setMistakes(0);
      setHistory([]);
      setFinished(false);
      setShowResults(false);
    }
    setSelected([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveKey]);

  const persist = useCallback(
    (s: SaveState) => writeJSON(saveKey, s),
    [saveKey],
  );

  const solvedGroups = puzzle.groups.filter((g) => solved.includes(g.name));
  const remaining = order.filter((m) => {
    const g = memberGroup.get(m);
    return g && !solved.includes(g.name);
  });

  const recordFinish = useCallback(
    (finalSolved: string[], finalHistory: string[][], won: boolean) => {
      const gridLines = finalHistory.map((guess) =>
        guess.map((mem) => EMOJI[memberGroup.get(mem)!.difficulty]).join(""),
      );
      const result: DayResult = {
        dateKey: puzzle.dateKey,
        mode,
        won,
        score: finalSolved.length / 4,
        gridLines,
        scoreLine: `${finalSolved.length}/4`,
        detail: { solved: finalSolved },
      };
      stats.recordResult(result);
      setTimeout(() => setShowResults(true), 700);
    },
    [memberGroup, mode, puzzle.dateKey, stats],
  );

  const toggle = (mem: string) => {
    if (finished) return;
    setSelected((sel) =>
      sel.includes(mem)
        ? sel.filter((x) => x !== mem)
        : sel.length < 4
          ? [...sel, mem]
          : sel,
    );
  };

  const submit = () => {
    if (selected.length !== 4 || finished) return;
    const groupsHit = selected.map((m) => memberGroup.get(m)!.name);
    const allSame = groupsHit.every((g) => g === groupsHit[0]);
    const newHistory = [...history, selected];
    setHistory(newHistory);

    if (allSame) {
      const groupName = groupsHit[0];
      const newSolved = [...solved, groupName];
      setSolved(newSolved);
      setSelected([]);
      const won = newSolved.length === 4;
      persist({ order, solved: newSolved, mistakes, history: newHistory, finished: won });
      if (won) {
        setFinished(true);
        recordFinish(newSolved, newHistory, true);
      }
    } else {
      // Count how many share the most common group ("one away").
      const counts: Record<string, number> = {};
      for (const g of groupsHit) counts[g] = (counts[g] ?? 0) + 1;
      const best = Math.max(...Object.values(counts));
      if (best === 3) toast.show("One away…");
      const newMistakes = mistakes + 1;
      setMistakes(newMistakes);
      setShaking(true);
      setTimeout(() => {
        setShaking(false);
        setSelected([]);
      }, 450);
      if (newMistakes >= MAX_MISTAKES) {
        // Auto-reveal: solve everything.
        const allNames = puzzle.groups.map((g) => g.name);
        setFinished(true);
        setSolved(allNames);
        persist({ order, solved: allNames, mistakes: newMistakes, history: newHistory, finished: true });
        recordFinish(solved, newHistory, false);
      } else {
        persist({ order, solved, mistakes: newMistakes, history: newHistory, finished: false });
      }
    }
  };

  const result = stats.getResult(mode, puzzle.dateKey);

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-ink/60">
        Create four groups of four.
      </p>

      {/* Solved bands */}
      <div className="w-full space-y-2">
        {solvedGroups
          .sort((a, b) => a.difficulty - b.difficulty)
          .map((g) => (
            <div
              key={g.name}
              className={`rounded p-2 text-center ${BAND[g.difficulty]}`}
            >
              <div className="text-sm font-bold uppercase tracking-wide">
                {g.name}
              </div>
              <div className="text-sm">{g.members.join(", ")}</div>
            </div>
          ))}
      </div>

      {/* Remaining grid */}
      {remaining.length > 0 && (
        <div
          className={`grid w-full grid-cols-4 gap-1.5 ${shaking ? "animate-shake" : ""}`}
        >
          {remaining.map((mem) => {
            const sel = selected.includes(mem);
            return (
              <button
                key={mem}
                onClick={() => toggle(mem)}
                aria-pressed={sel}
                className={`flex min-h-16 items-center justify-center rounded px-1 py-2 text-center text-[11px] font-semibold leading-tight transition-colors sm:text-xs ${
                  sel
                    ? "bg-ink text-parchment"
                    : "bg-surface text-ink hover:bg-ink/5 border border-ink/10"
                }`}
              >
                {mem}
              </button>
            );
          })}
        </div>
      )}

      {/* Mistakes */}
      {!finished && (
        <div className="flex items-center gap-2 text-sm text-ink/60">
          Mistakes remaining:
          <span className="flex gap-1">
            {Array.from({ length: MAX_MISTAKES }).map((_, i) => (
              <span
                key={i}
                className={`h-3 w-3 rounded-full ${i < MAX_MISTAKES - mistakes ? "bg-ink" : "bg-ink/20"}`}
              />
            ))}
          </span>
        </div>
      )}

      {!finished ? (
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => setSelected([])}
            disabled={selected.length === 0}
          >
            Deselect
          </Button>
          <Button onClick={submit} disabled={selected.length !== 4}>
            Submit
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowResults(true)}
            className="text-sm font-medium text-brass hover:underline"
          >
            View result
          </button>
          <ReportButton puzzle={puzzle} />
        </div>
      )}

      {result && (
        <ResultsModal
          open={showResults}
          onClose={() => setShowResults(false)}
          gameName="Crossed"
          result={result}
          source={source}
          takeaways={puzzle.groups
            .sort((a, b) => a.difficulty - b.difficulty)
            .map((g) => ({ label: g.name, text: g.teach }))}
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

export default function CrossedPage() {
  return (
    <PageShell back>
      <h1 className="mb-1 text-center font-serif text-3xl">Crossed</h1>
      <PuzzleLoader<CrossedPuzzle> slug="crossed">
        {(loaded) => <Board loaded={loaded} />}
      </PuzzleLoader>
    </PageShell>
  );
}
