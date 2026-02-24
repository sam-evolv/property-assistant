/**
 * API Rate Limiter
 *
 * In-memory sliding window rate limiter for API endpoints.
 * For production, replace with Redis-based limiter via Upstash.
 */

interface RateWindow {
  count: number;
  resetAt: number;
}

const windows = new Map<string, RateWindow>();

// Clean up expired windows periodically
const CLEANUP_INTERVAL = 60000; // 1 minute
let lastCleanup = Date.now();

function cleanupExpiredWindows() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;

  lastCleanup = now;
  for (const [key, window] of windows) {
    if (window.resetAt < now) {
      windows.delete(key);
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
}

export function checkRateLimit(apiKeyId: string, limitPerMinute: number): RateLimitResult {
  cleanupExpiredWindows();

  const now = Date.now();
  const key = `rate:${apiKeyId}`;
  const window = windows.get(key);

  if (!window || window.resetAt < now) {
    windows.set(key, { count: 1, resetAt: now + 60000 });
    return {
      allowed: true,
      remaining: limitPerMinute - 1,
      resetAt: now + 60000,
      limit: limitPerMinute,
    };
  }

  if (window.count >= limitPerMinute) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: window.resetAt,
      limit: limitPerMinute,
    };
  }

  window.count++;
  return {
    allowed: true,
    remaining: limitPerMinute - window.count,
    resetAt: window.resetAt,
    limit: limitPerMinute,
  };
}

export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  };
}
