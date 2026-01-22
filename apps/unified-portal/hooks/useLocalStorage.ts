import { useState, useEffect, useCallback } from 'react';

const VERSION = 'v1';

// Module-level cache for localStorage reads (Vercel best practice)
const storageCache = new Map<string, string | null>();

function getStorageValue<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;

  try {
    const versionedKey = `openhouse:${VERSION}:${key}`;

    // Check cache first
    if (!storageCache.has(versionedKey)) {
      storageCache.set(versionedKey, localStorage.getItem(versionedKey));
    }

    const item = storageCache.get(versionedKey);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setStorageValue<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;

  try {
    const versionedKey = `openhouse:${VERSION}:${key}`;
    const serialized = JSON.stringify(value);
    localStorage.setItem(versionedKey, serialized);
    storageCache.set(versionedKey, serialized); // Keep cache in sync
  } catch {
    // Storage full or disabled - fail silently
  }
}

function removeStorageValue(key: string): void {
  if (typeof window === 'undefined') return;

  try {
    const versionedKey = `openhouse:${VERSION}:${key}`;
    localStorage.removeItem(versionedKey);
    storageCache.delete(versionedKey);
  } catch {
    // Fail silently
  }
}

/**
 * Versioned localStorage hook with caching
 * @param key - Storage key (will be prefixed with version)
 * @param defaultValue - Default value if not found
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  // Lazy initialization (Vercel best practice)
  const [storedValue, setStoredValue] = useState<T>(() =>
    getStorageValue(key, defaultValue)
  );

  // Set value with functional update support
  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue(current => {
        const newValue = value instanceof Function ? value(current) : value;
        setStorageValue(key, newValue);
        return newValue;
      });
    },
    [key]
  );

  // Remove value
  const removeValue = useCallback(() => {
    setStoredValue(defaultValue);
    removeStorageValue(key);
  }, [key, defaultValue]);

  // Listen for storage changes from other tabs
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      const versionedKey = `openhouse:${VERSION}:${key}`;
      if (e.key === versionedKey) {
        storageCache.delete(versionedKey); // Invalidate cache
        setStoredValue(getStorageValue(key, defaultValue));
      }
    };

    // Invalidate cache on visibility change
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        const versionedKey = `openhouse:${VERSION}:${key}`;
        storageCache.delete(versionedKey);
      }
    };

    window.addEventListener('storage', handleStorage);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [key, defaultValue]);

  return [storedValue, setValue, removeValue];
}
