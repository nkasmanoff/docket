"use client";
import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const styles: Record<Variant, string> = {
  primary:
    "bg-ink text-parchment hover:bg-ink/90 disabled:opacity-40",
  secondary:
    "bg-surface text-ink border border-ink/15 hover:border-ink/40 disabled:opacity-40",
  ghost: "bg-transparent text-ink hover:bg-ink/5 disabled:opacity-40",
};

export function Button({
  variant = "primary",
  className = "",
  ...rest
}: Props) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed ${styles[variant]} ${className}`}
      {...rest}
    />
  );
}
