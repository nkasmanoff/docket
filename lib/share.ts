import { puzzleNumber } from "./date";
import type { Mode } from "./types";

const FOOTER = "play docket";

export interface ShareOpts {
  gameName: string;
  dateKey: string;
  mode: Mode;
  gridLines: string[];
  scoreLine?: string;
  /** Full URL to this game (e.g. https://docket-topaz.vercel.app/games/crossed). */
  gameUrl?: string;
}

// NYT-style shareable text block.
export function buildShareText({
  gameName,
  dateKey,
  gridLines,
  scoreLine,
  gameUrl,
}: ShareOpts): string {
  const tag = `#${puzzleNumber(dateKey)}`;
  const title = `Docket ${gameName} ${tag}${scoreLine ? ` ${scoreLine}` : ""}`;
  const footer = gameUrl ? `${FOOTER}\n${gameUrl}` : FOOTER;
  return [title, "", ...gridLines, "", footer].join("\n");
}
