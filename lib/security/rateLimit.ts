// ============================================
// Rate Limiting
// lib/security/rateLimit.ts
// ============================================
//
// Lightweight sliding-window rate limiter that works out of the box with
// zero external services — good enough to stop casual abuse (OTP/booking
// spam, brute force) on a single server instance.
//
// IMPORTANT: this state lives in server memory, so it resets on redeploy
// and is NOT shared across multiple instances/regions. If you deploy more
// than one instance (e.g. Vercel with concurrent lambdas, or a multi-pod
// setup), swap this for a shared store — Upstash Redis is the easiest:
//
//   npm install @upstash/ratelimit @upstash/redis
//
//   import { Ratelimit } from '@upstash/ratelimit';
//   import { Redis } from '@upstash/redis';
//   const ratelimit = new Ratelimit({
//     redis: Redis.fromEnv(),
//     limiter: Ratelimit.slidingWindow(5, '15 m'),
//   });
//   const { success } = await ratelimit.limit(identifier);
//
// Until then, this in-memory version is the safe default.

type Bucket = {
  count: number;
  windowStart: number;
};

const buckets = new Map<string, Bucket>();

// Periodically clear out old buckets so this doesn't grow unbounded.
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupIfNeeded(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, bucket] of Array.from(buckets.entries())) {
    if (now - bucket.windowStart > CLEANUP_INTERVAL_MS) {
      buckets.delete(key);
    }
  }
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check + record a hit against a rate limit bucket.
 *
 * @param identifier Unique key for the thing being limited, e.g.
 *   `booking-create:${userId}` or `otp:${email}`. Always namespace by
 *   route so different endpoints don't share a budget.
 * @param limit Max number of requests allowed per window.
 * @param windowMs Window size in milliseconds.
 */
export function checkRateLimit(identifier: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  cleanupIfNeeded(now);

  const existing = buckets.get(identifier);

  if (!existing || now - existing.windowStart > windowMs) {
    buckets.set(identifier, { count: 1, windowStart: now });
    return { success: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (existing.count >= limit) {
    return { success: false, remaining: 0, resetAt: existing.windowStart + windowMs };
  }

  existing.count += 1;
  return { success: true, remaining: limit - existing.count, resetAt: existing.windowStart + windowMs };
}

/**
 * Best-effort client identifier for rate limiting anonymous requests.
 * Not spoof-proof (X-Forwarded-For can be forged by the caller if you're
 * not behind a trusted proxy), but combined with per-user limits elsewhere
 * this is a reasonable defense-in-depth layer.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;
  return 'unknown';
}
