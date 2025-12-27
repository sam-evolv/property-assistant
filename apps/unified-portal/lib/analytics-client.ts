/*
 * =============================================================================
 * DEPRECATED - LEGACY ANALYTICS CLIENT
 * =============================================================================
 * This file and all its functions are DEPRECATED.
 * 
 * DO NOT use these functions for new code.
 * Use useCanonicalAnalytics() hook instead which fetches from 
 * /api/analytics/summary - the single source of truth.
 * 
 * These functions call deprecated v2 endpoints that return HTTP 410 errors.
 * =============================================================================
 */

import { logLegacyAnalyticsUsage } from './legacy-analytics-deprecation';

export interface AnalyticsParams {
  tenantId: string;
  developmentId?: string;
  days?: number;
  limit?: number;
}

async function fetchJSON<T>(url: string, caller: string): Promise<{ data: T | null; error: string | null }> {
  logLegacyAnalyticsUsage(url, caller);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      if (response.status === 410) {
        return {
          data: null,
          error: 'This analytics endpoint has been deprecated. Use /api/analytics/summary instead.',
        };
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return { data, error: null };
  } catch (error) {
    console.error('[DEPRECATED Analytics Client] Fetch error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/** @deprecated Use useCanonicalAnalytics() instead */
export async function fetchOverviewData(params: AnalyticsParams) {
  const query = new URLSearchParams({
    tenantId: params.tenantId,
    ...(params.developmentId && { developmentId: params.developmentId }),
    days: String(params.days || 30),
  });
  
  return fetchJSON(`/api/analytics-v2/overview?${query}`, 'fetchOverviewData');
}

/** @deprecated Use useCanonicalAnalytics() instead */
export async function fetchTrendsData(params: AnalyticsParams) {
  const query = new URLSearchParams({
    tenantId: params.tenantId,
    ...(params.developmentId && { developmentId: params.developmentId }),
    days: String(params.days || 30),
  });
  
  return fetchJSON(`/api/analytics-v2/trends?${query}`, 'fetchTrendsData');
}

/** @deprecated Use useCanonicalAnalytics() instead */
export async function fetchGapsData(params: AnalyticsParams) {
  const query = new URLSearchParams({
    tenantId: params.tenantId,
    days: String(params.days || 7),
    limit: String(params.limit || 20),
  });
  
  return fetchJSON(`/api/analytics-v2/gaps?${query}`, 'fetchGapsData');
}

/** @deprecated Use useCanonicalAnalytics() instead */
export async function fetchRAGData(params: AnalyticsParams) {
  const query = new URLSearchParams({
    tenantId: params.tenantId,
    limit: String(params.limit || 10),
  });
  
  return fetchJSON(`/api/analytics-v2/rag?${query}`, 'fetchRAGData');
}

/** @deprecated Use useCanonicalAnalytics() instead */
export async function fetchDocumentsData(params: AnalyticsParams) {
  const query = new URLSearchParams({
    tenantId: params.tenantId,
    limit: String(params.limit || 20),
  });
  
  return fetchJSON(`/api/analytics-v2/documents?${query}`, 'fetchDocumentsData');
}

/** @deprecated Use useCanonicalAnalytics() instead */
export async function fetchHomeownersData(params: AnalyticsParams) {
  const query = new URLSearchParams({
    tenantId: params.tenantId,
    days: String(params.days || 30),
  });
  
  return fetchJSON(`/api/analytics-v2/homeowners?${query}`, 'fetchHomeownersData');
}

/** @deprecated Use useCanonicalAnalytics() instead */
export async function fetchUnitsData(params: AnalyticsParams) {
  const query = new URLSearchParams({
    tenantId: params.tenantId,
    limit: String(params.limit || 20),
  });
  
  return fetchJSON(`/api/analytics-v2/units?${query}`, 'fetchUnitsData');
}
