// Simple in-memory token bucket keyed on an anonymous session id. Good enough
// for v1 single-instance. SEAM: back this with Redis for multi-instance limits.

interface Bucket {
  tokens: number;
  updated: number;
}

const CAPACITY = 8; // burst
const REFILL_PER_SEC = 8 / 60; // ~8 generations/minute sustained
const buckets = new Map<string, Bucket>();

export function takeToken(sessionId: string): boolean {
  const now = Date.now();
  const b = buckets.get(sessionId) ?? { tokens: CAPACITY, updated: now };
  const elapsed = (now - b.updated) / 1000;
  b.tokens = Math.min(CAPACITY, b.tokens + elapsed * REFILL_PER_SEC);
  b.updated = now;
  if (b.tokens < 1) {
    buckets.set(sessionId, b);
    return false;
  }
  b.tokens -= 1;
  buckets.set(sessionId, b);
  return true;
}
