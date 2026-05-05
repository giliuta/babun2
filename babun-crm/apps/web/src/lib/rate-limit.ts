// STORY-071 — In-memory sliding-window rate limiter.
//
// Best-effort defense for server actions and route handlers. NOT
// distributed: each Vercel lambda instance has its own counter, so
// a determined attacker hitting different instances bypasses it.
// Sized for typical user-facing throttling (preventing accidental
// double-clicks, button-mashing, basic bots) — not for hardening
// against targeted abuse. Upgrade to Vercel KV / Upstash Redis when
// we cross 100 active tenants.
//
// Usage:
//   const rl = checkRateLimit(`topup:${userId}`, { limit: 5, windowMs: 60_000 });
//   if (!rl.allowed) return { ok: false, error: "Слишком часто, подожди минутку" };

interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

interface Bucket {
  hits: number[];
}

// Module-scope state. Persists per lambda instance for the duration
// of warm life. Cleared on cold start. Memory-safe — old entries are
// pruned on every check.
const BUCKETS = new Map<string, Bucket>();
const MAX_KEYS = 5000;

export function checkRateLimit(
  key: string,
  opts: RateLimitOptions,
): RateLimitResult {
  const now = Date.now();
  const cutoff = now - opts.windowMs;

  let bucket = BUCKETS.get(key);
  if (!bucket) {
    bucket = { hits: [] };
    BUCKETS.set(key, bucket);
  }

  // Prune in-place: drop hits older than window.
  bucket.hits = bucket.hits.filter((t) => t > cutoff);

  if (bucket.hits.length >= opts.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: bucket.hits[0]! + opts.windowMs,
    };
  }

  bucket.hits.push(now);

  // Soft cap on the map size — drop the oldest entry if we cross.
  // Imperfect but prevents unbounded growth from per-IP keys.
  if (BUCKETS.size > MAX_KEYS) {
    const oldestKey = BUCKETS.keys().next().value;
    if (oldestKey !== undefined) BUCKETS.delete(oldestKey);
  }

  return {
    allowed: true,
    remaining: opts.limit - bucket.hits.length,
    resetAt: now + opts.windowMs,
  };
}

// Common preset profiles — keep call sites readable.
export const RATE_LIMITS = {
  topupCheckout: { limit: 5, windowMs: 60_000 },     // 5/min per user
  senderRequest: { limit: 3, windowMs: 5 * 60_000 }, // 3 per 5 min
  signup:        { limit: 3, windowMs: 60 * 60_000 }, // 3/hour per IP
} as const;
