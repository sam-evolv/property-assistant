'use client';

/**
 * Sprint 3.5a sidebar badge. Renders next to the Homeowners nav link
 * with a count of homeowner_new issues for the caller's tenant.
 *
 * Visual: small amber-500 pill with white text, 1-9 shown literally,
 * higher counts shown as "9+". Hidden when count is zero or when
 * FEATURE_HOMEOWNER_ISSUES is off.
 *
 * Polls every 60 seconds. No realtime push - the page would have
 * already been opened by the time realtime would matter.
 */

import { useEffect, useState } from 'react';
import { isHomeownerIssuesEnabled } from '@/lib/feature-flags';

const REFRESH_INTERVAL_MS = 60_000;

export function HomeownersBadge() {
  const enabled = isHomeownerIssuesEnabled();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    async function fetchCount() {
      try {
        const res = await fetch('/api/homeowners/issues-count', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && typeof data.count === 'number') {
          setCount(data.count);
        }
      } catch {
        // Network failure here is non-fatal. The badge stays at its
        // last-known value until the next interval.
      }
    }

    fetchCount();
    const id = setInterval(fetchCount, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [enabled]);

  if (!enabled || count <= 0) return null;

  const display = count > 9 ? '9+' : String(count);

  return (
    <span
      className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-white text-[11px] font-semibold leading-none"
      aria-label={`${count} homeowner ${count === 1 ? 'issue' : 'issues'} awaiting review`}
    >
      {display}
    </span>
  );
}
