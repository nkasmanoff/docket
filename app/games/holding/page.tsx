"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { PuzzleLoader, LoadedPuzzle } from "@/components/PuzzleLoader";
import { ResultsModal } from "@/components/ResultsModal";
import { ReportButton } from "@/components/ReportButton";
import { useToast } from "@/components/Toast";
import { useGameStats, DayResult } from "@/lib/useGameStats";
import { isAllowedWord } from "@/lib/allowed-words";
import { readJSON, writeJSON } from "@/lib/storage";
import type { HoldingPuzzle, Mode } from "@/lib/types";

type LetterState = "correct" | "partial" | "absent" | "empty";

function scoreGuess(guess: string, answer: string): LetterState[] {
  const res: LetterState[] = Array(5).fill("absent");
  const counts: Record<string, number> = {};
  for (const ch of answer) counts[ch] = (counts[ch] ?? 0) + 1;
  for (let i = 0; i < 5; i++) {
    if (guess[i] === answer[i]) {
      res[i] = "correct";
      counts[guess[i]]--;
    }
  }
  for (let i = 0; i < 5; i++) {
    if (res[i] === "correct") continue;
    if (counts[guess[i]] > 0) {
      res[i] = "partial";
      counts[guess[i]]--;
    }
  }
  return res;
}

const ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];

function Board({ loaded }: { loaded: LoadedPuzzle<HoldingPuzzle> }) {
  const { puzzle, source, mode } = loaded;
  const answer = puzzle.answer.toUpperCase();
  const toast = useToast();
  const stats = useGameStats("holding");

  const progressKey = `docket:progress:holding:${mode}:${puzzle.dateKey}:${answer}`;
  const [guesses, setGuesses] = useState<string[]>([]);
  const [current, setCurrent] = useState("");
  const [done, setDone] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Resume in-progress / completed state for this exact puzzle.
  useEffect(() => {
    const saved = readJSON<{ guesses: string[] }>(progressKey, { guesses: [] });
    setGuesses(saved.guesses);
    setCurrent("");
    const won = saved.guesses.includes(answer);
    const lost = saved.guesses.length >= 6 && !won;
    if (won || lost) {
      setDone(true);
      setShowResults(true);
    } else {
      setDone(false);
      setShowResults(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressKey]);

  const finish = useCallback(
    (finalGuesses: string[], won: boolean) => {
      setDone(true);
      const gridLines = finalGuesses.map((g) =>
        scoreGuess(g, answer)
          .map((s) =>
            s === "correct" ? "🟩" : s === "partial" ? "🟨" : "⬛",
          )
          .join(""),
      );
      const result: DayResult = {
        dateKey: puzzle.dateKey,
        mode,
        won,
        score: won ? 1 - (finalGuesses.length - 1) / 12 : 0,
        gridLines,
        scoreLine: won ? `${finalGuesses.length}/6` : "X/6",
        detail: { answer, definition: puzzle.definition },
      };
      stats.recordResult(result);
      setTimeout(() => setShowResults(true), 900);
    },
    [answer, mode, puzzle.dateKey, puzzle.definition, stats],
  );

  const submit = useCallback(() => {
    if (done) return;
    if (current.length !== 5) {
      toast.show("Need 5 letters");
      return;
    }
    if (!isAllowedWord(current)) {
      toast.show("Not in word list");
      return;
    }
    const next = [...guesses, current];
    setGuesses(next);
    setCurrent("");
    writeJSON(progressKey, { guesses: next });
    if (current === answer) finish(next, true);
    else if (next.length >= 6) finish(next, false);
  }, [current, guesses, answer, done, toast, progressKey, finish]);

  const onKey = useCallback(
    (k: string) => {
      if (done) return;
      if (k === "ENTER") submit();
      else if (k === "BACK") setCurrent((c) => c.slice(0, -1));
      else if (/^[A-Z]$/.test(k))
        setCurrent((c) => (c.length < 5 ? c + k : c));
    },
    [done, submit],
  );

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toUpperCase();
      if (k === "ENTER") onKey("ENTER");
      else if (k === "BACKSPACE") onKey("BACK");
      else if (/^[A-Z]$/.test(k)) onKey(k);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onKey]);

  // Aggregate keyboard letter states.
  const keyStates = useMemo(() => {
    const m: Record<string, LetterState> = {};
    const rank = { correct: 3, partial: 2, absent: 1, empty: 0 } as const;
    for (const g of guesses) {
      const s = scoreGuess(g, answer);
      for (let i = 0; i < 5; i++) {
        const prev = m[g[i]] ?? "empty";
        if (rank[s[i]] > rank[prev]) m[g[i]] = s[i];
      }
    }
    return m;
  }, [guesses, answer]);

  const rowsToRender = 6;
  const cellColor = (s: LetterState) =>
    s === "correct"
      ? "bg-correct text-white border-correct"
      : s === "partial"
        ? "bg-partial text-ink border-partial"
        : s === "absent"
          ? "bg-wrong text-white border-wrong"
          : "bg-surface border-ink/20 text-ink";

  const won = guesses.includes(answer);
  const result = stats.getResult(mode, puzzle.dateKey);

  return (
    <div className="flex flex-col items-center gap-5">
      <p className="text-sm text-ink/60">Guess the 5-letter legal term.</p>

      <div className="grid grid-rows-6 gap-1.5" aria-label="Guess grid">
        {Array.from({ length: rowsToRender }).map((_, r) => {
          const guess = guesses[r];
          const isCurrent = r === guesses.length && !done;
          const letters = guess ?? (isCurrent ? current : "");
          const states = guess ? scoreGuess(guess, answer) : null;
          return (
            <div key={r} className="grid grid-cols-5 gap-1.5">
              {Array.from({ length: 5 }).map((_, c) => {
                const ch = letters[c] ?? "";
                const st: LetterState = states ? states[c] : "empty";
                return (
                  <div
                    key={c}
                    className={`flex h-13 w-13 items-center justify-center rounded border-2 text-2xl font-semibold uppercase sm:h-14 sm:w-14 ${cellColor(st)} ${ch && st === "empty" ? "border-ink/40" : ""}`}
                    style={{ width: 52, height: 52 }}
                  >
                    {ch}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* On-screen keyboard */}
      <div className="flex w-full max-w-md flex-col items-center gap-1.5">
        {ROWS.map((row, i) => (
          <div key={i} className="flex w-full justify-center gap-1">
            {i === 2 && (
              <KeyBtn wide onClick={() => onKey("ENTER")}>
                Enter
              </KeyBtn>
            )}
            {row.split("").map((k) => (
              <KeyBtn key={k} state={keyStates[k]} onClick={() => onKey(k)}>
                {k}
              </KeyBtn>
            ))}
            {i === 2 && (
              <KeyBtn wide onClick={() => onKey("BACK")}>
                ⌫
              </KeyBtn>
            )}
          </div>
        ))}
      </div>

      {done && (
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
          gameName="Holding"
          result={result}
          source={source}
          takeaways={[
            { label: answer, text: puzzle.definition },
            ...(puzzle.example ? [{ label: "Example", text: puzzle.example }] : []),
          ]}
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

function KeyBtn({
  children,
  onClick,
  state,
  wide,
}: {
  children: React.ReactNode;
  onClick: () => void;
  state?: LetterState;
  wide?: boolean;
}) {
  const color =
    state === "correct"
      ? "bg-correct text-white"
      : state === "partial"
        ? "bg-partial text-ink"
        : state === "absent"
          ? "bg-wrong text-white"
          : "bg-ink/10 text-ink hover:bg-ink/20";
  return (
    <button
      onClick={onClick}
      className={`flex h-12 items-center justify-center rounded text-sm font-semibold uppercase transition-colors ${wide ? "px-3" : "flex-1"} ${color}`}
    >
      {children}
    </button>
  );
}

export default function HoldingPage() {
  return (
    <PageShell back>
      <h1 className="mb-1 text-center font-serif text-3xl">Holding</h1>
      <PuzzleLoader<HoldingPuzzle> slug="holding">
        {(loaded) => <Board loaded={loaded} />}
      </PuzzleLoader>
    </PageShell>
  );
}
