'use client';

import useSWR from 'swr';
import type { 
  CanonicalAnalyticsSummary, 
  CanonicalSummaryParams,
  CanonicalTimeWindow 
} from '@/lib/canonical-analytics';

async function fetchCanonicalSummary(params: CanonicalSummaryParams): Promise<CanonicalAnalyticsSummary> {
  const searchParams = new URLSearchParams();
  searchParams.set('scope', params.scope);
  if (params.project_id) searchParams.set('project_id', params.project_id);
  if (params.developer_id) searchParams.set('developer_id', params.developer_id);
  if (params.time_window) searchParams.set('time_window', params.time_window);

  const url = `/api/analytics/summary?${searchParams.toString()}`;
  const res = await fetch(url);

  if (!res.ok) {
    const errorText = await res.text().catch(() => res.statusText);
    throw new Error(`Canonical analytics fetch failed: ${errorText}`);
  }

  return res.json();
}

function buildCacheKey(params: CanonicalSummaryParams): string {
  return `/api/analytics/summary?scope=${params.scope}&tw=${params.time_window || '30d'}&pid=${params.project_id || ''}&did=${params.developer_id || ''}`;
}

export function useCanonicalAnalytics(params: CanonicalSummaryParams) {
  const key = buildCacheKey(params);
  
  return useSWR<CanonicalAnalyticsSummary>(
    key,
    () => fetchCanonicalSummary(params),
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
      refreshInterval: 60000,
      errorRetryCount: 2,
    }
  );
}

export function useCanonicalSuperadmin(options?: { 
  project_id?: string; 
  time_window?: CanonicalTimeWindow;
}) {
  return useCanonicalAnalytics({
    scope: 'superadmin',
    project_id: options?.project_id,
    time_window: options?.time_window || '30d',
  });
}

export function useCanonicalDeveloper(developer_id: string, options?: {
  project_id?: string;
  time_window?: CanonicalTimeWindow;
}) {
  return useCanonicalAnalytics({
    scope: 'developer',
    developer_id,
    project_id: options?.project_id,
    time_window: options?.time_window || '30d',
  });
}
