'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  sessionExpired: boolean;
}

interface UseDebouncedFetchOptions {
  debounceMs?: number;
  enabled?: boolean;
}

export function useDebouncedFetch<T>(
  url: string | null,
  options: UseDebouncedFetchOptions = {}
): FetchState<T> & { refetch: () => void } {
  const { debounceMs = 300, enabled = true } = options;

  const [state, setState] = useState<FetchState<T>>({
    data: null,
    loading: true,
    error: null,
    sessionExpired: false,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastUrlRef = useRef<string | null>(null);

  const fetchData = useCallback(async (fetchUrl: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch(fetchUrl, {
        signal: abortControllerRef.current.signal,
      });

      if (response.status === 401) {
        setState({
          data: null,
          loading: false,
          error: 'Session expired',
          sessionExpired: true,
        });
        return;
      }

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const data = await response.json();
      setState({
        data,
        loading: false,
        error: null,
        sessionExpired: false,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      setState({
        data: null,
        loading: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        sessionExpired: false,
      });
    }
  }, []);

  const debouncedFetch = useCallback(
    (fetchUrl: string) => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      debounceTimeoutRef.current = setTimeout(() => {
        fetchData(fetchUrl);
      }, debounceMs);
    },
    [fetchData, debounceMs]
  );

  useEffect(() => {
    if (!enabled || !url) {
      setState((prev) => ({ ...prev, loading: false }));
      return;
    }

    if (url === lastUrlRef.current) {
      return;
    }
    lastUrlRef.current = url;

    debouncedFetch(url);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [url, enabled, debouncedFetch]);

  const refetch = useCallback(() => {
    if (url) {
      lastUrlRef.current = null;
      debouncedFetch(url);
    }
  }, [url, debouncedFetch]);

  return { ...state, refetch };
}

const fetchCache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 30000;

export function useCachedFetch<T>(
  url: string | null,
  options: UseDebouncedFetchOptions & { cacheTtl?: number } = {}
): FetchState<T> & { refetch: () => void; invalidateCache: () => void } {
  const { cacheTtl = CACHE_TTL, ...restOptions } = options;

  const getCachedData = useCallback((): T | null => {
    if (!url) return null;
    const cached = fetchCache.get(url);
    if (cached && Date.now() - cached.timestamp < cacheTtl) {
      return cached.data as T;
    }
    if (cached) {
      fetchCache.delete(url);
    }
    return null;
  }, [url, cacheTtl]);

  const [cachedData, setCachedData] = useState<T | null>(getCachedData);

  useEffect(() => {
    const currentCached = getCachedData();
    setCachedData(currentCached);
  }, [url, getCachedData]);

  const shouldFetch = url && !cachedData;

  const { data, loading, error, sessionExpired, refetch } = useDebouncedFetch<T>(
    shouldFetch ? url : null,
    restOptions
  );

  useEffect(() => {
    if (data && url) {
      fetchCache.set(url, { data, timestamp: Date.now() });
      setCachedData(data);
    }
  }, [data, url]);

  useEffect(() => {
    if (sessionExpired && url) {
      fetchCache.delete(url);
      setCachedData(null);
    }
  }, [sessionExpired, url]);

  const invalidateCache = useCallback(() => {
    if (url) {
      fetchCache.delete(url);
      setCachedData(null);
    }
  }, [url]);

  const refetchWithInvalidate = useCallback(() => {
    invalidateCache();
    refetch();
  }, [invalidateCache, refetch]);

  const effectiveData = sessionExpired ? null : (cachedData || data);

  return {
    data: effectiveData,
    loading: shouldFetch ? loading : false,
    error: sessionExpired ? 'Session expired' : error,
    sessionExpired,
    refetch: refetchWithInvalidate,
    invalidateCache,
  };
}

export function useRequestDeduplication() {
  const pendingRequests = useRef<Map<string, Promise<Response>>>(new Map());

  const dedupedFetch = useCallback(
    async (url: string, options?: RequestInit): Promise<Response> => {
      const key = `${options?.method || 'GET'}:${url}`;

      if (pendingRequests.current.has(key)) {
        return pendingRequests.current.get(key)!;
      }

      const promise = fetch(url, options);
      pendingRequests.current.set(key, promise);

      try {
        const response = await promise;
        return response;
      } finally {
        pendingRequests.current.delete(key);
      }
    },
    []
  );

  return dedupedFetch;
}
