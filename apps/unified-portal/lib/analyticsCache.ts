type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

type InFlightEntry<T> = {
  promise: Promise<T>;
};

const ANALYTICS_CACHE_TTL = 30 * 1000;
const METADATA_CACHE_TTL = 5 * 60 * 1000;

const analyticsCache = new Map<string, CacheEntry<unknown>>();
const metadataCache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, InFlightEntry<unknown>>();

export function getCachedAnalytics<T>(key: string): T | null {
  const entry = analyticsCache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  
  if (Date.now() - entry.timestamp > ANALYTICS_CACHE_TTL) {
    analyticsCache.delete(key);
    return null;
  }
  
  return entry.data;
}

export function setCachedAnalytics<T>(key: string, data: T): void {
  analyticsCache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

export function getCachedMetadata<T>(key: string): T | null {
  const entry = metadataCache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  
  if (Date.now() - entry.timestamp > METADATA_CACHE_TTL) {
    metadataCache.delete(key);
    return null;
  }
  
  return entry.data;
}

export function setCachedMetadata<T>(key: string, data: T): void {
  metadataCache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

export async function fetchWithDedup<T>(
  key: string,
  fetcher: () => Promise<T>,
  cacheType: 'analytics' | 'metadata' = 'analytics'
): Promise<T> {
  const getCache = cacheType === 'analytics' ? getCachedAnalytics : getCachedMetadata;
  const setCache = cacheType === 'analytics' ? setCachedAnalytics : setCachedMetadata;
  
  const cached = getCache<T>(key);
  if (cached !== null) {
    return cached;
  }
  
  const existing = inFlight.get(key) as InFlightEntry<T> | undefined;
  if (existing) {
    return existing.promise;
  }
  
  const promise = fetcher().then((data) => {
    setCache(key, data);
    inFlight.delete(key);
    return data;
  }).catch((err) => {
    inFlight.delete(key);
    throw err;
  });
  
  inFlight.set(key, { promise: promise as Promise<unknown> });
  return promise;
}

export function invalidateAnalyticsCache(prefix?: string): void {
  if (prefix) {
    const keysToDelete: string[] = [];
    analyticsCache.forEach((_, key) => {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => analyticsCache.delete(key));
  } else {
    analyticsCache.clear();
  }
}

export function invalidateMetadataCache(prefix?: string): void {
  if (prefix) {
    const keysToDelete: string[] = [];
    metadataCache.forEach((_, key) => {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => metadataCache.delete(key));
  } else {
    metadataCache.clear();
  }
}

export function clearAllCaches(): void {
  analyticsCache.clear();
  metadataCache.clear();
  inFlight.clear();
}
