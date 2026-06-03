"use client";
import { ButtonHTMLAttributes } from "react";

type State = "default" | "selected" | "correct" | "partial" | "wrong" | "locked";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  state?: State;
  shake?: boolean;
}

const stateStyles: Record<State, string> = {
  default: "bg-surface border-ink/15 text-ink hover:border-ink/40",
  selected: "bg-ink text-parchment border-ink",
  correct: "bg-correct text-white border-correct",
  partial: "bg-partial text-ink border-partial",
  wrong: "bg-wrong text-white border-wrong",
  locked: "bg-ink/5 text-ink/50 border-ink/10",
};

// Square-ish content tile used across games.
export function Tile({
  state = "default",
  shake = false,
  className = "",
  ...rest
}: Props) {
  return (
    <button
      className={`flex items-center justify-center rounded border px-2 py-3 text-center text-sm font-medium leading-tight transition-colors ${stateStyles[state]} ${shake ? "animate-shake" : ""} ${className}`}
      {...rest}
    />
  );
}
