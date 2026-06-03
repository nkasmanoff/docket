"use client";
import { createContext, useCallback, useContext, useState } from "react";

// Minimal toast system. Wrap a subtree in <ToastProvider> and call useToast().
interface ToastCtx {
  show: (msg: string) => void;
}
const Ctx = createContext<ToastCtx>({ show: () => {} });

export function useToast() {
  return useContext(Ctx);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);

  const show = (m: string) => {
    setMsg(m);
    window.setTimeout(() => setMsg(null), 1800);
  };

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center"
      >
        {msg && (
          <div className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-parchment shadow-lg">
            {msg}
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}
