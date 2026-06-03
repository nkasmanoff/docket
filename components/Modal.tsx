"use client";
import { useEffect, useRef } from "react";

interface Props {
  open: boolean;
  onClose?: () => void;
  title?: string;
  children: React.ReactNode;
  dismissable?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  dismissable = true,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissable) onClose?.();
    };
    document.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, dismissable, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4"
      onClick={() => dismissable && onClose?.()}
      role="presentation"
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-2xl bg-surface p-6 shadow-xl outline-none sm:rounded-2xl"
      >
        {title && (
          <h2 className="mb-4 text-center font-serif text-2xl text-ink">
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>
  );
}
