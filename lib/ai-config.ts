// Centralized model configuration. These are pinned snapshot IDs that get
// superseded over time — verify the current IDs at
// https://docs.claude.com/en/docs/about-claude/models before launch.
export const MODEL = "claude-opus-4-8";
export const FAST_MODEL = "claude-sonnet-4-6";

// Generation tuning shared by the engine.
export const MAX_TOKENS = 4096;
export const GENERATION_TIMEOUT_MS = 25_000;
export const MAX_RETRIES = 2; // up to 2 extra attempts after the first

// Whether the server has a key to call Anthropic at all. When false, the
// engine short-circuits straight to the bundled fallback puzzle.
export function hasApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
