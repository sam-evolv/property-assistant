'use client';

import { useState, useEffect, useCallback } from 'react';
import { SECTOR_TERMINOLOGY, type Sector } from '@/lib/dev-app/constants';

// ── Sector terminology hook ──
export function useSectorTerms(sector?: string) {
  const key = (sector || 'bts') as Sector;
  return SECTOR_TERMINOLOGY[key] || SECTOR_TERMINOLOGY.bts;
}

// ── Generic fetch hook for dev-app API routes ──
export function useDevAppFetch<T>(url: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps]);

  return { data, loading, error, refetch };
}

// ── Staggered animation helper ──
export function useStaggeredEntrance(itemCount: number, delayMs = 60) {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (itemCount === 0) return;
    setVisibleCount(0);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setVisibleCount(i);
      if (i >= itemCount) clearInterval(interval);
    }, delayMs);
    return () => clearInterval(interval);
  }, [itemCount, delayMs]);

  return visibleCount;
}
