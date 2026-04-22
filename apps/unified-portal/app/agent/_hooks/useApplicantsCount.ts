'use client';

import { useCallback, useEffect, useState } from 'react';

const REFRESH_EVENT = 'oh.agent.applicants.refresh';
const POLL_INTERVAL_MS = 60_000;

/**
 * Polls /api/agent/applicants/badge-count for the action-required count
 * that drives the bottom nav + sidebar badges for lettings applicants.
 * Other parts of the app (draft_application_invitation approval, applicant
 * status changes) can dispatch oh.agent.applicants.refresh to force a
 * refresh without waiting for the next poll tick.
 */
export function useApplicantsCount(): { count: number; refresh: () => Promise<void> } {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/applicants/badge-count', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data.count === 'number') setCount(data.count);
    } catch {
      /* silent — badge holds its last known value */
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

export function notifyApplicantsChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(REFRESH_EVENT));
}
