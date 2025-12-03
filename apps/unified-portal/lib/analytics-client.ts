/**
 * CLIENT-SIDE ANALYTICS FETCHER
 * Safe for browser use - no server dependencies
 */

export interface AnalyticsParams {
  tenantId: string;
  developmentId?: string;
  days?: number;
  limit?: number;
}

async function fetchJSON<T>(url: string): Promise<{ data: T | null; error: string | null }> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return { data, error: null };
  } catch (error) {
    console.error('[Analytics Client] Fetch error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function fetchOverviewData(params: AnalyticsParams) {
  const query = new URLSearchParams({
    tenantId: params.tenantId,
    ...(params.developmentId && { developmentId: params.developmentId }),
    days: String(params.days || 30),
  });
  
  return fetchJSON(`/api/analytics-v2/overview?${query}`);
}

export async function fetchTrendsData(params: AnalyticsParams) {
  const query = new URLSearchParams({
    tenantId: params.tenantId,
    ...(params.developmentId && { developmentId: params.developmentId }),
    days: String(params.days || 30),
  });
  
  return fetchJSON(`/api/analytics-v2/trends?${query}`);
}

export async function fetchGapsData(params: AnalyticsParams) {
  const query = new URLSearchParams({
    tenantId: params.tenantId,
    days: String(params.days || 7),
    limit: String(params.limit || 20),
  });
  
  return fetchJSON(`/api/analytics-v2/gaps?${query}`);
}

export async function fetchRAGData(params: AnalyticsParams) {
  const query = new URLSearchParams({
    tenantId: params.tenantId,
    limit: String(params.limit || 10),
  });
  
  return fetchJSON(`/api/analytics-v2/rag?${query}`);
}

export async function fetchDocumentsData(params: AnalyticsParams) {
  const query = new URLSearchParams({
    tenantId: params.tenantId,
    limit: String(params.limit || 20),
  });
  
  return fetchJSON(`/api/analytics-v2/documents?${query}`);
}

export async function fetchHomeownersData(params: AnalyticsParams) {
  const query = new URLSearchParams({
    tenantId: params.tenantId,
    days: String(params.days || 30),
  });
  
  return fetchJSON(`/api/analytics-v2/homeowners?${query}`);
}

export async function fetchUnitsData(params: AnalyticsParams) {
  const query = new URLSearchParams({
    tenantId: params.tenantId,
    limit: String(params.limit || 20),
  });
  
  return fetchJSON(`/api/analytics-v2/units?${query}`);
}
