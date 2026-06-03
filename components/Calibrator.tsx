"use client";
import { useState } from "react";
import { Button } from "./Button";
import type { CalibratorConfig } from "@/lib/games-meta";
import { PROXY_TO_DIFFICULTY } from "@/lib/games-meta";
import type { Subject, Difficulty } from "@/lib/types";

export interface CalibrationProfile {
  subject?: Subject; // omitted = mixed
  subjectLabel: string;
  proxyIndex: 0 | 1 | 2;
  difficulty: Difficulty;
}

interface Props {
  config: CalibratorConfig;
  onComplete: (p: CalibrationProfile) => void;
}

export function Calibrator({ config, onComplete }: Props) {
  const [subjectIdx, setSubjectIdx] = useState<number | null>(
    config.subjects ? null : 0,
  );
  const [proxyIdx, setProxyIdx] = useState<0 | 1 | 2 | null>(null);

  const ready =
    (!config.subjects || subjectIdx !== null) && proxyIdx !== null;

  const submit = () => {
    if (proxyIdx === null) return;
    const sub = config.subjects?.[subjectIdx ?? 0];
    const value = sub && sub.value !== "Mixed" ? (sub.value as Subject) : undefined;
    onComplete({
      subject: value,
      subjectLabel: sub?.label ?? "Mixed",
      proxyIndex: proxyIdx,
      difficulty: PROXY_TO_DIFFICULTY[proxyIdx],
    });
  };

  return (
    <div className="space-y-6 rounded-2xl border border-ink/10 bg-surface p-6">
      {config.subjects && (
        <fieldset>
          <legend className="mb-3 font-serif text-lg text-ink">
            What do you want to drill?
          </legend>
          <div className="flex flex-wrap gap-2">
            {config.subjects.map((s, i) => (
              <button
                key={s.label}
                onClick={() => setSubjectIdx(i)}
                aria-pressed={subjectIdx === i}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  subjectIdx === i
                    ? "border-ink bg-ink text-parchment"
                    : "border-ink/20 bg-surface text-ink hover:border-ink/50"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset>
        <legend className="mb-3 font-serif text-lg text-ink">
          {config.difficultyQuestion}
        </legend>
        <div className="grid grid-cols-3 gap-2">
          {config.difficultyLabels.map((label, i) => (
            <button
              key={label}
              onClick={() => setProxyIdx(i as 0 | 1 | 2)}
              aria-pressed={proxyIdx === i}
              className={`rounded border px-2 py-2.5 text-sm transition-colors ${
                proxyIdx === i
                  ? "border-brass bg-brass/15 text-ink"
                  : "border-ink/20 bg-surface text-ink hover:border-ink/50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <Button onClick={submit} disabled={!ready} className="w-full">
        Draft my puzzle
      </Button>
    </div>
  );
}

// Compact "Evidence · Getting there · [change]" bar shown on return.
export function CalibrationBar({
  profile,
  config,
  onChange,
  onRegenerate,
}: {
  profile: CalibrationProfile;
  config: CalibratorConfig;
  onChange: () => void;
  onRegenerate: () => void;
}) {
  return (
    <div className="mb-4 flex items-center justify-between rounded-full border border-ink/10 bg-surface px-4 py-2 text-sm">
      <span className="text-ink/80">
        {profile.subjectLabel} ·{" "}
        {config.difficultyLabels[profile.proxyIndex]}
      </span>
      <span className="flex items-center gap-3">
        <button
          onClick={onRegenerate}
          className="font-medium text-brass hover:underline"
        >
          New puzzle
        </button>
        <button onClick={onChange} className="text-ink/50 hover:text-ink">
          change
        </button>
      </span>
    </div>
  );
}
