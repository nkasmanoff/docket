"use client";
import Link from "next/link";
import { ToastProvider } from "./Toast";
import { SignOutButton } from "./SignOutButton";

interface Props {
  children: React.ReactNode;
  back?: boolean;
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`font-serif text-xl font-semibold tracking-tight text-ink ${className}`}
    >
      <span className="text-brass">§</span> Docket
    </Link>
  );
}

export function PageShell({ children, back = false }: Props) {
  return (
    <ToastProvider>
      <div className="min-h-dvh bg-parchment">
        <header className="border-b border-ink/10">
          <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-4">
            <Wordmark />
            <div className="flex items-center gap-4">
              {back && (
                <Link
                  href="/"
                  className="text-sm text-ink/60 transition-colors hover:text-ink"
                >
                  ← All games
                </Link>
              )}
              <SignOutButton />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-lg px-4 py-6">{children}</main>
      </div>
    </ToastProvider>
  );
}
