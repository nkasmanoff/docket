"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { PuzzleLoader, LoadedPuzzle } from "@/components/PuzzleLoader";
import { ResultsModal } from "@/components/ResultsModal";
import { ReportButton } from "@/components/ReportButton";
import { useToast } from "@/components/Toast";
import { useGameStats, DayResult } from "@/lib/useGameStats";
import { readJSON, writeJSON } from "@/lib/storage";
import type { HuntPuzzle } from "@/lib/types";

type Pt = { r: number; c: number };

function sortedKey(path: [number, number][] | Pt[]): string {
  const norm = (path as any[]).map((p) =>
    Array.isArray(p) ? { r: p[0], c: p[1] } : p,
  ) as Pt[];
  return norm
    .map((p) => `${p.r},${p.c}`)
    .sort()
    .join("|");
}

function adjacent(a: Pt, b: Pt) {
  return Math.abs(a.r - b.r) <= 1 && Math.abs(a.c - b.c) <= 1 && !(a.r === b.r && a.c === b.c);
}

function Board({ loaded }: { loaded: LoadedPuzzle<HuntPuzzle> }) {
  const { puzzle, source, mode } = loaded;
  const toast = useToast();
  const stats = useGameStats("hunt");
  const saveKey = `docket:progress:hunt:${mode}:${puzzle.dateKey}:${puzzle.subject ?? "x"}:${puzzle.difficulty}`;

  // Map from a word's cell-set key to its identity.
  const pathMap = useMemo(() => {
    const m = new Map<string, { word: string; isSpangram: boolean }>();
    for (const w of puzzle.words)
      m.set(sortedKey(w.path), { word: w.word, isSpangram: !!w.isSpangram });
    return m;
  }, [puzzle]);

  const totalWords = puzzle.words.length;

  const [found, setFound] = useState<{ word: string; isSpangram: boolean }[]>([]);
  const [path, setPath] = useState<Pt[]>([]);
  const [nonTheme, setNonTheme] = useState(0);
  const [hints, setHints] = useState(0);
  const [hintCells, setHintCells] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    const saved = readJSON<{ found: any[]; nonTheme: number; hints: number } | null>(saveKey, null);
    if (saved) {
      setFound(saved.found);
      setNonTheme(saved.nonTheme);
      setHints(saved.hints);
      setShowResults(saved.found.length >= totalWords);
    } else {
      setFound([]);
      setNonTheme(0);
      setHints(0);
      setShowResults(false);
    }
    setPath([]);
    setHintCells([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveKey]);

  // cell -> color from found words
  const cellColor = useMemo(() => {
    const m = new Map<string, "theme" | "spangram">();
    for (const f of found) {
      const w = puzzle.words.find((x) => x.word === f.word);
      if (!w) continue;
      for (const [r, c] of w.path) m.set(`${r},${c}`, f.isSpangram ? "spangram" : "theme");
    }
    return m;
  }, [found, puzzle]);

  const won = found.length >= totalWords;

  const finish = useCallback(
    (finalFound: { word: string; isSpangram: boolean }[], h: number) => {
      const gridLines = [
        finalFound.map((f) => (f.isSpangram ? "🟡" : "🔵")).join("") + "💡".repeat(h),
      ];
      const result: DayResult = {
        dateKey: puzzle.dateKey,
        mode,
        won: true,
        score: Math.max(0, 1 - h * 0.1),
        gridLines,
        scoreLine: `${finalFound.length}/${totalWords}`,
      };
      stats.recordResult(result);
      setTimeout(() => setShowResults(true), 500);
    },
    [mode, puzzle.dateKey, stats, totalWords],
  );

  const revealHint = (currentFound: { word: string }[]) => {
    const unfound = puzzle.words.find((w) => !currentFound.some((f) => f.word === w.word));
    if (!unfound) return;
    setHints((h) => {
      const nh = h + 1;
      setHintCells(unfound.path.map(([r, c]) => `${r},${c}`));
      toast.show("Hint: a theme word revealed");
      setTimeout(() => setHintCells([]), 2500);
      return nh;
    });
  };

  const submit = (p: Pt[]) => {
    if (p.length < 3) {
      setPath([]);
      return;
    }
    const match = pathMap.get(sortedKey(p));
    if (match && !found.some((f) => f.word === match.word)) {
      const nf = [...found, match];
      setFound(nf);
      setPath([]);
      writeJSON(saveKey, { found: nf, nonTheme, hints });
      toast.show(match.isSpangram ? "Spangram! 🟡" : "Theme word 🔵");
      if (nf.length >= totalWords) finish(nf, hints);
      return;
    }
    // Non-theme guess.
    setPath([]);
    if (p.length >= 4) {
      const nn = nonTheme + 1;
      setNonTheme(nn);
      writeJSON(saveKey, { found, nonTheme: nn, hints });
      if (nn % 3 === 0) revealHint(found);
      else toast.show("Not a theme word");
    }
  };

  const handleTap = (r: number, c: number) => {
    if (won) return;
    const cell = { r, c };
    setPath((prev) => {
      if (prev.length === 0) return [cell];
      const last = prev[prev.length - 1];
      if (last.r === r && last.c === c) {
        // tap last cell again = submit
        submit(prev);
        return prev; // submit clears
      }
      if (prev.some((p) => p.r === r && p.c === c)) return [cell]; // restart
      if (adjacent(last, cell)) return [...prev, cell];
      return [cell]; // start new path
    });
  };

  const inPath = (r: number, c: number) => path.some((p) => p.r === r && p.c === c);
  const result = stats.getResult(mode, puzzle.dateKey);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Theme banner */}
      <div className="w-full rounded-2xl border border-ink/10 bg-surface p-4 text-center">
        <div className="text-xs uppercase tracking-wide text-ink/50">Theme</div>
        <div className="font-serif text-xl text-ink">
          {won ? puzzle.theme : "??? "}
        </div>
        <div className="mt-1 text-sm text-ink/60">
          {found.length} / {totalWords} found · {hints} hint{hints === 1 ? "" : "s"}
        </div>
      </div>

      {/* Grid */}
      <div
        className="grid select-none gap-1"
        style={{ gridTemplateColumns: `repeat(${puzzle.cols}, 1fr)` }}
      >
        {puzzle.grid.flatMap((row, r) =>
          row.split("").map((ch, c) => {
            const key = `${r},${c}`;
            const color = cellColor.get(key);
            const selected = inPath(r, c);
            const hint = hintCells.includes(key);
            return (
              <button
                key={key}
                onClick={() => handleTap(r, c)}
                aria-label={`Row ${r + 1} column ${c + 1}, letter ${ch}`}
                className={`flex h-11 w-11 items-center justify-center rounded-full text-lg font-semibold transition-colors ${
                  color === "spangram"
                    ? "bg-[#e0a500] text-white"
                    : color === "theme"
                      ? "bg-[#3b6fb0] text-white"
                      : selected
                        ? "bg-ink text-parchment"
                        : hint
                          ? "bg-brass/40 text-ink ring-2 ring-brass"
                          : "bg-surface text-ink hover:bg-ink/5"
                }`}
              >
                {ch}
              </button>
            );
          }),
        )}
      </div>

      {/* Current path readout + submit */}
      {!won && (
        <div className="flex items-center gap-3 text-sm text-ink/60">
          <span className="font-mono">
            {path.map((p) => puzzle.grid[p.r][p.c]).join("") || "tap letters…"}
          </span>
          {path.length >= 3 && (
            <button onClick={() => submit(path)} className="font-medium text-brass hover:underline">
              Submit
            </button>
          )}
          {path.length > 0 && (
            <button onClick={() => setPath([])} className="text-ink/40 hover:text-ink">
              clear
            </button>
          )}
        </div>
      )}

      <p className="max-w-sm text-center text-xs text-ink/40">
        Connect adjacent letters (including diagonals) to spell a theme word. Tap the last
        letter again to submit. Every 3 valid off-theme words reveals a hint.
      </p>

      <div className="flex items-center gap-3">
        {won && (
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
          gameName="Hunt"
          result={result}
          source={source}
          takeaways={Object.entries(puzzle.teach).slice(0, 6).map(([k, v]) => ({ label: k, text: v }))}
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

export default function HuntPage() {
  return (
    <PageShell back>
      <h1 className="mb-1 text-center font-serif text-3xl">The Hunt</h1>
      <PuzzleLoader<HuntPuzzle> slug="hunt">
        {(loaded) => <Board loaded={loaded} />}
      </PuzzleLoader>
    </PageShell>
  );
}
