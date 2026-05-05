'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAgent } from '@/lib/agent/AgentContext';
import { deriveEffectiveMode } from '@/lib/agent/effective-mode';

const REFRESH_EVENT = 'oh.agent.drafts.refresh';
const POLL_INTERVAL_MS = 30_000;

/**
 * Polls /api/agent/intelligence/drafts for the pending-review count so the
 * bottom nav + sidebar badges stay accurate without each consumer hitting
 * the endpoint themselves. Other parts of the app (review screen, approve
 * action, send flow) can dispatch `oh.agent.drafts.refresh` to force an
 * immediate refresh instead of waiting for the next poll tick.
 *
 * The count is workspace-scoped: lettings drafts don't inflate the sales
 * inbox badge and vice versa. The effective mode is derived from the URL
 * (sales/lettings page → that workspace; mode-neutral page → fall back to
 * the persisted active workspace).
 */
export function useDraftsCount(): {
  count: number;
  /** True once the initial fetch has settled. Lets callers reserve
      layout space until they know whether to render a banner. */
  ready: boolean;
  refresh: () => Promise<void>;
} {
  const [count, setCount] = useState(0);
  const [ready, setReady] = useState(false);
  const pathname = usePathname();
  const { activeWorkspace } = useAgent();
  const mode = deriveEffectiveMode(pathname, activeWorkspace?.mode);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/agent/intelligence/drafts?mode=${mode}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data.count === 'number') setCount(data.count);
    } catch {
      /* silent — the badge just stays at its last known value */
    } finally {
      setReady(true);
    }
  }, [mode]);

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

  return { count, ready, refresh };
}

export function notifyDraftsChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(REFRESH_EVENT));
}
