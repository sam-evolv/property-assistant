interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

interface TTLCacheOptions {
  defaultTTLMs?: number;
  maxEntries?: number;
  cleanupIntervalMs?: number;
}

const DEFAULT_OPTIONS: Required<TTLCacheOptions> = {
  defaultTTLMs: 30000,
  maxEntries: 1000,
  cleanupIntervalMs: 60000,
};

class TTLCache<T = any> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private options: Required<TTLCacheOptions>;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(options: TTLCacheOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.startCleanup();
  }

  private startCleanup(): void {
    if (this.cleanupTimer) return;
    
    this.cleanupTimer = setInterval(() => {
      this.evictExpired();
    }, this.options.cleanupIntervalMs);

    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  private evictExpired(): void {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
      }
    }
  }

  private enforceMaxEntries(): void {
    if (this.cache.size <= this.options.maxEntries) return;

    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].expiresAt - b[1].expiresAt);

    const toRemove = entries.slice(0, this.cache.size - this.options.maxEntries);
    for (const [key] of toRemove) {
      this.cache.delete(key);
    }
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    const ttl = ttlMs ?? this.options.defaultTTLMs;
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
    });
    this.enforceMaxEntries();
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  async wrap<R>(
    key: string,
    fn: () => Promise<R>,
    ttlMs?: number
  ): Promise<R> {
    const cached = this.get(key) as R | undefined;
    if (cached !== undefined) {
      return cached;
    }

    const result = await fn();
    this.set(key, result as unknown as T, ttlMs);
    return result;
  }

  stats(): { size: number; maxEntries: number } {
    return {
      size: this.cache.size,
      maxEntries: this.options.maxEntries,
    };
  }
}

const globalCache = new TTLCache({
  defaultTTLMs: 30000,
  maxEntries: 500,
});

export { TTLCache, globalCache };
export type { TTLCacheOptions };
