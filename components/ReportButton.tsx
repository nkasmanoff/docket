"use client";
import { useState } from "react";
import { useToast } from "./Toast";

// "Report a problem" — logs the puzzle JSON for human review. Accuracy guardrail.
export function ReportButton({ puzzle }: { puzzle: unknown }) {
  const toast = useToast();
  const [sent, setSent] = useState(false);

  const report = async () => {
    try {
      await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ at: new Date().toISOString(), puzzle }),
      });
      setSent(true);
      toast.show("Thanks — flagged for review");
    } catch {
      toast.show("Couldn't send report");
    }
  };

  return (
    <button
      onClick={report}
      disabled={sent}
      className="text-xs text-ink/40 underline-offset-2 hover:text-ink/70 hover:underline disabled:no-underline"
    >
      {sent ? "Reported ✓" : "Report a problem"}
    </button>
  );
}
