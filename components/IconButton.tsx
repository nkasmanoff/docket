"use client";
import { ButtonHTMLAttributes } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
}

export function IconButton({ label, className = "", children, ...rest }: Props) {
  return (
    <button
      aria-label={label}
      title={label}
      className={`inline-flex h-9 w-9 items-center justify-center rounded text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
