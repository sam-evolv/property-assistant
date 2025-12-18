type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

type CacheResult<T> = {
  data: T | null;
  isStale: boolean;
};

type InFlightEntry<T> = {
  promise: Promise<T>;
  abort: () => void;
};

const CACHE_TTL = 60 * 1000;
const cache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, InFlightEntry<unknown>>();

function makeKey(unitUid: string, token: string): string {
  return `docs:${unitUid}:${token}`;
}

export function getCachedDocuments<T>(unitUid: string, token: string): CacheResult<T> {
  const key = makeKey(unitUid, token);
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  
  if (!entry) return { data: null, isStale: false };
  
  const isStale = Date.now() - entry.timestamp > CACHE_TTL;
  return { data: entry.data, isStale };
}

export function setCachedDocuments<T>(unitUid: string, token: string, data: T): void {
  const key = makeKey(unitUid, token);
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

export function invalidateDocumentCache(unitUid: string): void {
  const keysToDelete: string[] = [];
  cache.forEach((_, key) => {
    if (key.startsWith(`docs:${unitUid}:`)) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => {
    cache.delete(key);
    const flight = inFlight.get(key);
    if (flight) {
      flight.abort();
      inFlight.delete(key);
    }
  });
}

export function clearAllDocumentCache(): void {
  inFlight.forEach(entry => entry.abort());
  inFlight.clear();
  cache.clear();
}

export function getInFlightRequest<T>(unitUid: string, token: string): Promise<T> | null {
  const key = makeKey(unitUid, token);
  const entry = inFlight.get(key) as InFlightEntry<T> | undefined;
  return entry?.promise || null;
}

export function setInFlightRequest<T>(
  unitUid: string, 
  token: string, 
  promise: Promise<T>,
  abort: () => void
): void {
  const key = makeKey(unitUid, token);
  
  const existing = inFlight.get(key);
  if (existing) {
    existing.abort();
  }
  
  inFlight.set(key, { promise: promise as Promise<unknown>, abort });
  
  promise
    .then(() => {
      if (inFlight.get(key)?.promise === promise) {
        inFlight.delete(key);
      }
    })
    .catch(() => {
      if (inFlight.get(key)?.promise === promise) {
        inFlight.delete(key);
      }
    });
}
