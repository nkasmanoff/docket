"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { PuzzleLoader, LoadedPuzzle } from "@/components/PuzzleLoader";
import { ResultsModal } from "@/components/ResultsModal";
import { ReportButton } from "@/components/ReportButton";
import { Button } from "@/components/Button";
import { useToast } from "@/components/Toast";
import { useGameStats, DayResult } from "@/lib/useGameStats";
import { readJSON, writeJSON } from "@/lib/storage";
import type { BriefPuzzle, CrosswordClue } from "@/lib/types";

const N = 5;
type Dir = "across" | "down";

interface Cell {
  blocked: boolean;
  solution: string;
  num?: number;
}

function buildModel(p: BriefPuzzle) {
  const cells: Cell[][] = Array.from({ length: N }, () =>
    Array.from({ length: N }, () => ({ blocked: true, solution: "" })),
  );
  for (const [r, c] of p.blocked) if (cells[r]?.[c]) cells[r][c].blocked = true;
  for (const clue of p.clues) {
    const ans = clue.answer.toUpperCase();
    for (let i = 0; i < ans.length; i++) {
      const r = clue.dir === "down" ? clue.row + i : clue.row;
      const c = clue.dir === "across" ? clue.col + i : clue.col;
      cells[r][c] = { ...cells[r][c], blocked: false, solution: ans[i] };
    }
  }
  for (const clue of p.clues) {
    const c = cells[clue.row][clue.col];
    if (c) c.num = c.num ?? clue.num;
  }
  return cells;
}

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function Board({ loaded }: { loaded: LoadedPuzzle<BriefPuzzle> }) {
  const { puzzle, source, mode } = loaded;
  const toast = useToast();
  const stats = useGameStats("brief");
  const cells = useMemo(() => buildModel(puzzle), [puzzle]);
  const saveKey = `docket:progress:brief:${mode}:${puzzle.dateKey}:${puzzle.difficulty}`;

  const [entries, setEntries] = useState<string[][]>(
    Array.from({ length: N }, () => Array.from({ length: N }, () => "")),
  );
  const [active, setActive] = useState<{ r: number; c: number }>(() => {
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!cells[r][c].blocked) return { r, c };
    return { r: 0, c: 0 };
  });
  const [dir, setDir] = useState<Dir>("across");
  const [usedHelp, setUsedHelp] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [done, setDone] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showMenu, setShowMenu] = useState<"check" | "reveal" | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Resume
  useEffect(() => {
    const saved = readJSON<{ entries: string[][]; usedHelp: boolean; seconds: number; done: boolean } | null>(saveKey, null);
    if (saved) {
      setEntries(saved.entries);
      setUsedHelp(saved.usedHelp);
      setSeconds(saved.seconds);
      setDone(saved.done);
      setShowResults(saved.done);
    } else {
      setEntries(Array.from({ length: N }, () => Array.from({ length: N }, () => "")));
      setUsedHelp(false);
      setSeconds(0);
      setDone(false);
      setShowResults(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveKey]);

  // Timer
  useEffect(() => {
    if (done) return;
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [done]);

  const persist = useCallback(
    (e: string[][], help: boolean, sec: number, d: boolean) =>
      writeJSON(saveKey, { entries: e, usedHelp: help, seconds: sec, done: d }),
    [saveKey],
  );

  const wordCells = useCallback(
    (r: number, c: number, d: Dir): { r: number; c: number }[] => {
      const out: { r: number; c: number }[] = [];
      // walk back to word start
      let sr = r, sc = c;
      while (true) {
        const pr = d === "down" ? sr - 1 : sr;
        const pc = d === "across" ? sc - 1 : sc;
        if (pr < 0 || pc < 0 || cells[pr][pc].blocked) break;
        sr = pr; sc = pc;
      }
      while (sr < N && sc < N && !cells[sr][sc].blocked) {
        out.push({ r: sr, c: sc });
        if (d === "down") sr++; else sc++;
      }
      return out;
    },
    [cells],
  );

  const checkWin = useCallback(
    (e: string[][]) => {
      for (let r = 0; r < N; r++)
        for (let c = 0; c < N; c++)
          if (!cells[r][c].blocked && e[r][c] !== cells[r][c].solution) return false;
      return true;
    },
    [cells],
  );

  const finish = useCallback(
    (help: boolean, sec: number) => {
      setDone(true);
      const result: DayResult = {
        dateKey: puzzle.dateKey,
        mode,
        won: true,
        score: help ? 0.5 : 1,
        gridLines: [help ? "🟨 used help" : "🟦 no peeking"],
        scoreLine: fmtTime(sec),
      };
      stats.recordResult(result);
      setTimeout(() => setShowResults(true), 500);
    },
    [mode, puzzle.dateKey, stats],
  );

  const setLetter = (r: number, c: number, ch: string) => {
    setEntries((prev) => {
      const e = prev.map((row) => [...row]);
      e[r][c] = ch;
      const won = checkWin(e);
      persist(e, usedHelp, seconds, won);
      if (won && !done) finish(usedHelp, seconds);
      return e;
    });
  };

  const moveNext = (r: number, c: number) => {
    const word = wordCells(r, c, dir);
    const i = word.findIndex((w) => w.r === r && w.c === c);
    if (i >= 0 && i < word.length - 1) setActive(word[i + 1]);
  };
  const movePrev = (r: number, c: number) => {
    const word = wordCells(r, c, dir);
    const i = word.findIndex((w) => w.r === r && w.c === c);
    if (i > 0) setActive(word[i - 1]);
  };

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (done) return;
      const { r, c } = active;
      if (e.key === " ") {
        e.preventDefault();
        setDir((d) => (d === "across" ? "down" : "across"));
      } else if (e.key === "Backspace") {
        e.preventDefault();
        if (entries[r][c]) setLetter(r, c, "");
        else movePrev(r, c);
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        setLetter(r, c, e.key.toUpperCase());
        moveNext(r, c);
      } else if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        const d = e.key === "ArrowUp" || e.key === "ArrowDown" ? "down" : "across";
        setDir(d);
        const dr = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
        const dc = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        let nr = r + dr, nc = c + dc;
        while (nr >= 0 && nr < N && nc >= 0 && nc < N) {
          if (!cells[nr][nc].blocked) { setActive({ r: nr, c: nc }); break; }
          nr += dr; nc += dc;
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active, dir, entries, done],
  );

  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  const activeWord = wordCells(active.r, active.c, dir);
  const inActiveWord = (r: number, c: number) =>
    activeWord.some((w) => w.r === r && w.c === c);

  const clueForActive = useMemo(() => {
    const start = activeWord[0];
    return puzzle.clues.find(
      (cl) => cl.dir === dir && cl.row === start?.r && cl.col === start?.c,
    );
  }, [activeWord, dir, puzzle.clues]);

  const cluesByDir = (d: Dir) =>
    puzzle.clues.filter((c) => c.dir === d).sort((a, b) => a.num - b.num);

  const jumpToClue = (cl: CrosswordClue) => {
    setDir(cl.dir);
    setActive({ r: cl.row, c: cl.col });
  };

  // Check / reveal actions
  const checkSquare = () => {
    const { r, c } = active;
    if (entries[r][c] && entries[r][c] !== cells[r][c].solution) toast.show("That square is wrong");
    else if (entries[r][c]) toast.show("Looks right");
    setShowMenu(null);
  };
  const checkPuzzle = () => {
    let bad = 0;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++)
      if (!cells[r][c].blocked && entries[r][c] && entries[r][c] !== cells[r][c].solution) bad++;
    toast.show(bad ? `${bad} square(s) wrong` : "No mistakes so far");
    setShowMenu(null);
  };
  const revealSquare = () => {
    const { r, c } = active;
    setUsedHelp(true);
    setEntries((prev) => {
      const e = prev.map((row) => [...row]);
      e[r][c] = cells[r][c].solution;
      const won = checkWin(e);
      persist(e, true, seconds, won);
      if (won && !done) finish(true, seconds);
      return e;
    });
    setShowMenu(null);
  };
  const revealPuzzle = () => {
    setUsedHelp(true);
    const e = cells.map((row) => row.map((cell) => cell.solution));
    setEntries(e);
    persist(e, true, seconds, true);
    finish(true, seconds);
    setShowMenu(null);
  };

  const result = stats.getResult(mode, puzzle.dateKey);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full items-center justify-between text-sm text-ink/60">
        <span className="font-mono">{fmtTime(seconds)}</span>
        {usedHelp && <span className="text-partial">help used</span>}
        <div className="relative flex gap-2">
          <button onClick={() => setShowMenu(showMenu === "check" ? null : "check")} className="hover:text-ink">Check</button>
          <button onClick={() => setShowMenu(showMenu === "reveal" ? null : "reveal")} className="hover:text-ink">Reveal</button>
          {showMenu && (
            <div className="absolute right-0 top-6 z-10 w-32 rounded border border-ink/15 bg-surface py-1 text-sm shadow-lg">
              {showMenu === "check" ? (
                <>
                  <MenuItem onClick={checkSquare}>Square</MenuItem>
                  <MenuItem onClick={checkPuzzle}>Puzzle</MenuItem>
                </>
              ) : (
                <>
                  <MenuItem onClick={revealSquare}>Square</MenuItem>
                  <MenuItem onClick={revealPuzzle}>Puzzle</MenuItem>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="grid gap-0.5 rounded bg-ink/20 p-0.5" style={{ gridTemplateColumns: `repeat(${N}, 1fr)` }}>
        {cells.flatMap((row, r) =>
          row.map((cell, c) => {
            if (cell.blocked)
              return <div key={`${r}-${c}`} className="h-14 w-14 bg-ink" />;
            const isActive = active.r === r && active.c === c;
            const inWord = inActiveWord(r, c);
            const wrong = done ? false : false;
            return (
              <button
                key={`${r}-${c}`}
                onClick={() => {
                  if (isActive) setDir((d) => (d === "across" ? "down" : "across"));
                  else setActive({ r, c });
                }}
                className={`relative h-14 w-14 text-xl font-semibold uppercase ${
                  isActive ? "bg-brass/40" : inWord ? "bg-brass/15" : "bg-surface"
                } ${wrong ? "text-error" : "text-ink"}`}
              >
                {cell.num && (
                  <span className="absolute left-0.5 top-0 text-[9px] font-normal text-ink/50">
                    {cell.num}
                  </span>
                )}
                {entries[r][c]}
              </button>
            );
          }),
        )}
      </div>

      {/* Active clue */}
      {clueForActive && (
        <div className="w-full rounded bg-ink/5 p-3 text-center text-sm">
          <span className="font-semibold text-brass">
            {clueForActive.num} {clueForActive.dir}
          </span>{" "}
          <span className="text-ink">{clueForActive.clue}</span>
        </div>
      )}

      {/* Clue lists */}
      <div className="grid w-full grid-cols-2 gap-4 text-sm">
        {(["across", "down"] as Dir[]).map((d) => (
          <div key={d}>
            <div className="mb-1 font-serif font-semibold capitalize text-ink">{d}</div>
            <ul className="space-y-1">
              {cluesByDir(d).map((cl) => (
                <li key={`${d}-${cl.num}`}>
                  <button
                    onClick={() => jumpToClue(cl)}
                    className={`text-left ${clueForActive?.num === cl.num && dir === d ? "font-medium text-ink" : "text-ink/60"} hover:text-ink`}
                  >
                    <span className="mr-1 tabular-nums">{cl.num}.</span>
                    {cl.clue}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        {done && (
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
          gameName="Brief"
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

function MenuItem({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="block w-full px-3 py-1.5 text-left hover:bg-ink/5">
      {children}
    </button>
  );
}

export default function BriefPage() {
  return (
    <PageShell back>
      <h1 className="mb-1 text-center font-serif text-3xl">The Brief</h1>
      <PuzzleLoader<BriefPuzzle> slug="brief">
        {(loaded) => <Board loaded={loaded} />}
      </PuzzleLoader>
    </PageShell>
  );
}
