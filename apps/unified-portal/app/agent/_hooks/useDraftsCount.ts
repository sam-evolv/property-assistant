'use client';

import { useCallback, useEffect, useState } from 'react';

const REFRESH_EVENT = 'oh.agent.drafts.refresh';
const POLL_INTERVAL_MS = 30_000;

/**
 * Polls /api/agent/intelligence/drafts for the pending-review count so the
 * bottom nav + sidebar badges stay accurate without each consumer hitting
 * the endpoint themselves. Other parts of the app (review screen, approve
 * action, send flow) can dispatch `oh.agent.drafts.refresh` to force an
 * immediate refresh instead of waiting for the next poll tick.
 */
export function useDraftsCount(): { count: number; refresh: () => Promise<void> } {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/intelligence/drafts', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data.count === 'number') setCount(data.count);
    } catch {
      /* silent — the badge just stays at its last known value */
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    const onRefresh = () => { refresh(); };
    window.addEventListener(REFRESH_EVENT, onRefresh);
    return () => {
      clearInterval(id);
      window.removeEventListener(REFRESH_EVENT, onRefresh);
    };
  }, [refresh]);

  return { count, refresh };
}

export function notifyDraftsChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(REFRESH_EVENT));
}
