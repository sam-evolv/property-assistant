/**
 * OpenHouse AI Performance Utilities
 * Following Vercel React Best Practices (45 rules)
 */

import { cache } from 'react';

// ============================================================================
// LRU CACHE FOR CROSS-REQUEST CACHING
// ============================================================================
interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxSize: number;
  private ttl: number;

  constructor(options: { maxSize?: number; ttl?: number } = {}) {
    this.maxSize = options.maxSize ?? 1000;
    this.ttl = options.ttl ?? 5 * 60 * 1000; // 5 minutes default
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  set(key: string, value: T): void {
    // Delete if exists (to update position)
    this.cache.delete(key);

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, { value, timestamp: Date.now() });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }
}

// Export singleton instances for common caches
export const userCache = new LRUCache<unknown>({ maxSize: 500, ttl: 60 * 1000 }); // 1 min
export const configCache = new LRUCache<unknown>({ maxSize: 100, ttl: 5 * 60 * 1000 }); // 5 min
export const analyticsCache = new LRUCache<unknown>({ maxSize: 200, ttl: 30 * 1000 }); // 30 sec

// ============================================================================
// PER-REQUEST DEDUPLICATION WITH React.cache()
// ============================================================================

/**
 * Get current admin context with per-request deduplication
 * Multiple calls in same request only execute once
 */
export const getAdminContext = cache(async () => {
  // Implementation would call actual auth logic
  return { userId: '', role: '' };
});

/**
 * Get development by ID with deduplication
 */
export const getDevelopment = cache(async (developmentId: string) => {
  // Check cross-request cache first
  const cached = configCache.get(`development:${developmentId}`);
  if (cached) return cached;

  // Fetch from DB
  // const development = await db.development.findUnique({ where: { id: developmentId } });

  // Cache for future requests
  // configCache.set(`development:${developmentId}`, development);

  return null;
});

// ============================================================================
// FUNCTION RESULT CACHING
// ============================================================================

// Module-level cache for expensive computations
const computationCache = new Map<string, unknown>();

/**
 * Cached slugify function (Vercel pattern)
 */
export function cachedSlugify(text: string): string {
  if (computationCache.has(`slug:${text}`)) {
    return computationCache.get(`slug:${text}`) as string;
  }

  const slug = text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  computationCache.set(`slug:${text}`, slug);
  return slug;
}

/**
 * Cached date formatting
 */
const dateFormatCache = new Map<string, string>();

export function cachedFormatDate(date: Date | string, format: string): string {
  const key = `${date}:${format}`;
  if (dateFormatCache.has(key)) {
    return dateFormatCache.get(key)!;
  }

  const d = typeof date === 'string' ? new Date(date) : date;
  // Simple formatting - in production use date-fns
  const formatted = d.toLocaleDateString();

  dateFormatCache.set(key, formatted);
  return formatted;
}

// ============================================================================
// STORAGE API CACHING
// ============================================================================

const storageCache = new Map<string, string | null>();

/**
 * Cached localStorage read (Vercel pattern)
 */
export function getLocalStorage(key: string): string | null {
  if (typeof window === 'undefined') return null;

  if (!storageCache.has(key)) {
    try {
      storageCache.set(key, localStorage.getItem(key));
    } catch {
      storageCache.set(key, null);
    }
  }

  return storageCache.get(key) ?? null;
}

/**
 * Set localStorage with cache sync
 */
export function setLocalStorage(key: string, value: string): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(key, value);
    storageCache.set(key, value);
  } catch {
    // Storage full or disabled
  }
}

/**
 * Remove localStorage with cache sync
 */
export function removeLocalStorage(key: string): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(key);
    storageCache.delete(key);
  } catch {
    // Fail silently
  }
}

// Invalidate cache on visibility change or storage events
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key) storageCache.delete(e.key);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      storageCache.clear();
    }
  });
}

// ============================================================================
// PARALLEL DATA FETCHING HELPERS
// ============================================================================

/**
 * Execute multiple promises in parallel with error handling
 * Returns array of results, null for failed promises
 */
export async function parallelFetch<T extends readonly unknown[] | []>(
  promises: { [K in keyof T]: Promise<T[K]> }
): Promise<{ [K in keyof T]: T[K] | null }> {
  const results = await Promise.allSettled(promises);

  return results.map((result) =>
    result.status === 'fulfilled' ? result.value : null
  ) as { [K in keyof T]: T[K] | null };
}

/**
 * Start fetch early, await later (Vercel pattern)
 */
export function startEarlyFetch<T>(fetchFn: () => Promise<T>): Promise<T> {
  return fetchFn();
}

// ============================================================================
// ARRAY OPTIMIZATION HELPERS
// ============================================================================

/**
 * Build index map for O(1) lookups (Vercel pattern)
 */
export function buildIndexMap<T, K extends string | number>(
  items: T[],
  keyFn: (item: T) => K
): Map<K, T> {
  return new Map(items.map((item) => [keyFn(item), item]));
}

/**
 * Find min/max in single pass (Vercel pattern)
 */
export function findMinMax<T>(
  items: T[],
  valueFn: (item: T) => number
): { min: T | null; max: T | null } {
  if (items.length === 0) return { min: null, max: null };

  let min = items[0];
  let max = items[0];
  let minValue = valueFn(items[0]);
  let maxValue = minValue;

  for (let i = 1; i < items.length; i++) {
    const value = valueFn(items[i]);
    if (value < minValue) {
      min = items[i];
      minValue = value;
    }
    if (value > maxValue) {
      max = items[i];
      maxValue = value;
    }
  }

  return { min, max };
}

/**
 * Compare arrays with early exit (Vercel pattern)
 */
export function arraysEqual<T>(a: T[], b: T[]): boolean {
  // Length check first (O(1))
  if (a.length !== b.length) return false;

  // Element comparison with early exit
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }

  return true;
}

// ============================================================================
// PRELOAD HELPERS
// ============================================================================

/**
 * Preload module on hover/focus (Vercel pattern)
 */
export function preloadOnIntent(importFn: () => Promise<unknown>): {
  onMouseEnter: () => void;
  onFocus: () => void;
} {
  const preload = () => {
    if (typeof window !== 'undefined') {
      void importFn();
    }
  };

  return {
    onMouseEnter: preload,
    onFocus: preload,
  };
}

/**
 * Preload image
 */
export function preloadImage(src: string): void {
  if (typeof window === 'undefined') return;

  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = src;
  document.head.appendChild(link);
}

// ============================================================================
// DEFERRED EXECUTION
// ============================================================================

/**
 * Execute after response is sent (for use with Next.js after())
 */
export function deferredExecution(fn: () => void | Promise<void>): void {
  if (typeof window !== 'undefined') {
    // Client-side: use requestIdleCallback or setTimeout
    if ('requestIdleCallback' in window) {
      (window as Window & { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(fn);
    } else {
      setTimeout(fn, 0);
    }
  } else {
    // Server-side: execute immediately or use after() in route handlers
    fn();
  }
}
