import { puzzleNumber } from "./date";
import type { Mode } from "./types";

const FOOTER = "play docket";

export interface ShareOpts {
  gameName: string;
  dateKey: string;
  mode: Mode;
  gridLines: string[];
  scoreLine?: string;
}

// NYT-style shareable text block.
export function buildShareText({
  gameName,
  dateKey,
  mode,
  gridLines,
  scoreLine,
}: ShareOpts): string {
  const tag =
    mode === "daily" ? `#${puzzleNumber(dateKey)}` : "Practice";
  const title = `Docket ${gameName} ${tag}${scoreLine ? ` ${scoreLine}` : ""}`;
  return [title, "", ...gridLines, "", FOOTER].join("\n");
}
