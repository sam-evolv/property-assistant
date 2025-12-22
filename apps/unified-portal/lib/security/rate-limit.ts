interface RateLimitEntry {
  tokens: number;
  lastRefill: number;
}

interface RateLimitConfig {
  maxTokens: number;
  refillRatePerSecond: number;
  windowMs?: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

const DEFAULT_CONFIGS: Record<string, RateLimitConfig> = {
  chat: { maxTokens: 30, refillRatePerSecond: 0.5 },
  dashboard: { maxTokens: 120, refillRatePerSecond: 2 },
  public: { maxTokens: 60, refillRatePerSecond: 1 },
  default: { maxTokens: 120, refillRatePerSecond: 2 },
};

class TokenBucketRateLimiter {
  private buckets: Map<string, RateLimitEntry> = new Map();
  private configs: Record<string, RateLimitConfig>;
  private maxBuckets: number;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(
    configs: Record<string, RateLimitConfig> = DEFAULT_CONFIGS,
    maxBuckets: number = 10000
  ) {
    this.configs = configs;
    this.maxBuckets = maxBuckets;
    this.startCleanup();
  }

  private startCleanup(): void {
    if (this.cleanupTimer) return;

    this.cleanupTimer = setInterval(() => {
      this.evictOldBuckets();
    }, 60000);

    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  private evictOldBuckets(): void {
    if (this.buckets.size <= this.maxBuckets) return;

    const now = Date.now();
    const staleThreshold = 300000;
    const entries = Array.from(this.buckets.entries());

    for (const [key, entry] of entries) {
      if (now - entry.lastRefill > staleThreshold) {
        this.buckets.delete(key);
      }
    }

    if (this.buckets.size > this.maxBuckets) {
      const entries = Array.from(this.buckets.entries())
        .sort((a, b) => a[1].lastRefill - b[1].lastRefill);
      
      const toRemove = entries.slice(0, this.buckets.size - this.maxBuckets);
      for (const [key] of toRemove) {
        this.buckets.delete(key);
      }
    }
  }

  private getConfig(route: string): RateLimitConfig {
    if (route.includes('/chat')) return this.configs.chat || DEFAULT_CONFIGS.chat;
    if (route.includes('/analytics') || route.includes('/dashboard')) {
      return this.configs.dashboard || DEFAULT_CONFIGS.dashboard;
    }
    if (route.includes('/houses/resolve') || route.includes('/purchaser')) {
      return this.configs.public || DEFAULT_CONFIGS.public;
    }
    return this.configs.default || DEFAULT_CONFIGS.default;
  }

  check(key: string, route: string): RateLimitResult {
    const config = this.getConfig(route);
    const now = Date.now();
    
    let entry = this.buckets.get(key);
    
    if (!entry) {
      entry = { tokens: config.maxTokens, lastRefill: now };
      this.buckets.set(key, entry);
    }

    const elapsed = (now - entry.lastRefill) / 1000;
    const refill = elapsed * config.refillRatePerSecond;
    entry.tokens = Math.min(config.maxTokens, entry.tokens + refill);
    entry.lastRefill = now;

    if (entry.tokens >= 1) {
      entry.tokens -= 1;
      return {
        allowed: true,
        remaining: Math.floor(entry.tokens),
        resetMs: Math.ceil((config.maxTokens - entry.tokens) / config.refillRatePerSecond * 1000),
      };
    }

    return {
      allowed: false,
      remaining: 0,
      resetMs: Math.ceil((1 - entry.tokens) / config.refillRatePerSecond * 1000),
    };
  }

  stats(): { bucketCount: number; maxBuckets: number } {
    return {
      bucketCount: this.buckets.size,
      maxBuckets: this.maxBuckets,
    };
  }
}

const globalRateLimiter = new TokenBucketRateLimiter();

export function checkRateLimit(ip: string, route: string): RateLimitResult {
  const key = `${ip}:${route}`;
  return globalRateLimiter.check(key, route);
}

export function getRateLimiterStats() {
  return globalRateLimiter.stats();
}

export { TokenBucketRateLimiter };
export type { RateLimitConfig, RateLimitResult };
