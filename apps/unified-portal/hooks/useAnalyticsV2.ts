'use client';

import useSWR from 'swr';

interface FetchOptions {
  tenantId: string;
  developmentId?: string;
  days?: number;
  limit?: number;
}

async function fetchAnalyticsV2<T>(endpoint: string, params: FetchOptions): Promise<T> {
  const searchParams = new URLSearchParams();
  searchParams.set('tenantId', params.tenantId);
  if (params.developmentId) searchParams.set('developmentId', params.developmentId);
  if (params.days) searchParams.set('days', params.days.toString());
  if (params.limit) searchParams.set('limit', params.limit.toString());

  const url = `/api/analytics-v2/${endpoint}?${searchParams.toString()}`;
  const res = await fetch(url);

  if (!res.ok) {
    const error = await res.text().catch(() => res.statusText);
    throw new Error(`Analytics API error: ${error}`);
  }

  return res.json();
}

export interface TopQuestion {
  question: string;
  count: number;
  lastAsked: string;
}

export interface RepeatedQuestion {
  question: string;
  occurrences: number;
  firstSeen: string;
  lastSeen: string;
  daysRepeated: number;
  isGap: boolean;
}

export interface RAGLatencyMetric {
  date: string;
  avgLatency: number;
  retrievalCount: number;
  failureRate: number;
}

export interface DocumentHealthMetric {
  documentId: string;
  documentName: string;
  healthScore: number;
  embeddingCount: number;
  lastAccessed: string | null;
  uploadedAt: string;
  daysSinceUpload: number;
  status: 'healthy' | 'under-used' | 'outdated' | 'unused';
}

export interface CostModelPoint {
  date: string;
  actualCost: number;
  projectedCost: number;
  messageCount: number;
}

export interface UserFunnelMetric {
  stage: string;
  count: number;
  conversionRate: number;
  description: string;
}

export interface OverviewMetrics {
  totalMessages: number;
  activeUsers: number;
  avgResponseTime: number;
  totalDocuments: number;
  embeddingChunks: number;
  avgCostPerMessage: number;
  peakUsageHour: number;
  topDevelopment: string | null;
}

export interface TrendMetrics {
  messageGrowthRate: number;
  userGrowthRate: number;
  documentGrowthRate: number;
  costTrend: 'increasing' | 'decreasing' | 'stable';
  topTrendingTopic: string | null;
}

export interface KnowledgeGap {
  category: string;
  questionCount: number;
  avgConfidence: number;
  topQuestion: string;
  gapSeverity: 'high' | 'medium' | 'low';
}

export interface RAGPerformance {
  avgRetrievalTime: number;
  avgEmbeddingAccuracy: number;
  totalRetrievals: number;
  failureRate: number;
  coveragePercent: number;
}

export interface DocumentMetrics {
  totalDocuments: number;
  avgHealthScore: number;
  documentsByStatus: Record<string, number>;
  topAccessedDocs: Array<{ name: string; accessCount: number }>;
}

export interface HomeownerMetrics {
  totalHomeowners: number;
  activeHomeowners: number;
  engagementRate: number;
  avgMessagesPerHomeowner: number;
  topEngagedDevelopment: string | null;
}

export interface UnitMetrics {
  totalUnits: number;
  occupiedUnits: number;
  unitsWithActivity: number;
  avgMessagesPerUnit: number;
  topActiveUnit: string | null;
}

export interface InsightResponse {
  insight: string;
}

const SWR_ANALYTICS_CONFIG = {
  revalidateOnFocus: false,
  revalidateIfStale: true,
  dedupingInterval: 30000,
  revalidateOnReconnect: true,
  refreshInterval: 60000,
};

export function useOverviewMetrics(params: FetchOptions) {
  const key = `/api/analytics/summary?scope=developer&developer_id=${params.tenantId}&time_window=${params.days || 30}d`;
  return useSWR<OverviewMetrics>(key, async () => {
    const timeWindow = params.days === 7 ? '7d' : params.days === 14 ? '14d' : params.days === 90 ? '90d' : '30d';
    const res = await fetch(`/api/analytics/summary?scope=developer&developer_id=${params.tenantId}&time_window=${timeWindow}`);
    if (!res.ok) {
      throw new Error('Failed to fetch analytics summary');
    }
    const data = await res.json();
    return {
      totalMessages: data.questions_in_window || 0,
      activeUsers: data.active_units_in_window || 0,
      avgResponseTime: 0,
      totalDocuments: data.total_document_opens || 0,
      embeddingChunks: 0,
      avgCostPerMessage: 0,
      peakUsageHour: 0,
      topDevelopment: null,
    } as OverviewMetrics;
  }, SWR_ANALYTICS_CONFIG);
}

export function useTrendMetrics(params: FetchOptions) {
  const key = `/api/analytics-v2/trends?${new URLSearchParams({ tenantId: params.tenantId, days: params.days?.toString() || '30' }).toString()}`;
  return useSWR<TrendMetrics>(key, () => fetchAnalyticsV2<TrendMetrics>('trends', params), SWR_ANALYTICS_CONFIG);
}

export function useKnowledgeGaps(params: FetchOptions) {
  const key = `/api/analytics-v2/gaps?${new URLSearchParams({ tenantId: params.tenantId, days: params.days?.toString() || '30' }).toString()}`;
  return useSWR<{ gaps: KnowledgeGap[] }>(key, () => fetchAnalyticsV2<{ gaps: KnowledgeGap[] }>('gaps', params), SWR_ANALYTICS_CONFIG);
}

export function useRAGPerformance(params: FetchOptions) {
  const key = `/api/analytics-v2/rag?${new URLSearchParams({ tenantId: params.tenantId, days: params.days?.toString() || '30' }).toString()}`;
  return useSWR<RAGPerformance>(key, () => fetchAnalyticsV2<RAGPerformance>('rag', params), SWR_ANALYTICS_CONFIG);
}

export function useDocumentMetrics(params: FetchOptions) {
  const key = `/api/analytics-v2/documents?${new URLSearchParams({ tenantId: params.tenantId, days: params.days?.toString() || '30' }).toString()}`;
  return useSWR<DocumentMetrics>(key, () => fetchAnalyticsV2<DocumentMetrics>('documents', params), SWR_ANALYTICS_CONFIG);
}

export function useHomeownerMetrics(params: FetchOptions) {
  const key = `/api/analytics/summary?scope=developer&developer_id=${params.tenantId}&time_window=${params.days || 30}d&for=homeowners`;
  return useSWR<HomeownerMetrics>(key, async () => {
    const timeWindow = params.days === 7 ? '7d' : params.days === 14 ? '14d' : params.days === 90 ? '90d' : '30d';
    const res = await fetch(`/api/analytics/summary?scope=developer&developer_id=${params.tenantId}&time_window=${timeWindow}`);
    if (!res.ok) {
      throw new Error('Failed to fetch analytics summary');
    }
    const data = await res.json();
    const activeUnits = data.active_units_in_window || 0;
    const totalQuestions = data.questions_in_window || 0;
    return {
      totalHomeowners: activeUnits,
      activeHomeowners: activeUnits,
      engagementRate: activeUnits > 0 ? Math.min(1, totalQuestions / (activeUnits * 10)) : 0,
      avgMessagesPerHomeowner: activeUnits > 0 ? Math.round(totalQuestions / activeUnits) : 0,
      topEngagedDevelopment: null,
    } as HomeownerMetrics;
  }, SWR_ANALYTICS_CONFIG);
}

export function useUnitMetrics(params: FetchOptions) {
  const key = `/api/analytics-v2/units?${new URLSearchParams({ tenantId: params.tenantId, days: params.days?.toString() || '30' }).toString()}`;
  return useSWR<UnitMetrics>(key, () => fetchAnalyticsV2<UnitMetrics>('units', params), SWR_ANALYTICS_CONFIG);
}

export function useTopQuestions(params: FetchOptions) {
  const key = `/api/analytics-v2/top-questions?${new URLSearchParams({ tenantId: params.tenantId, limit: params.limit?.toString() || '10' }).toString()}`;
  return useSWR<{ topQuestions: TopQuestion[] }>(key, () => fetchAnalyticsV2<{ topQuestions: TopQuestion[] }>('top-questions', params), SWR_ANALYTICS_CONFIG);
}

export function useRepeatedQuestions(params: FetchOptions) {
  const key = `/api/analytics-v2/repeated-questions?${new URLSearchParams({ tenantId: params.tenantId, limit: params.limit?.toString() || '10' }).toString()}`;
  return useSWR<{ repeatedQuestions: RepeatedQuestion[] }>(key, () => fetchAnalyticsV2<{ repeatedQuestions: RepeatedQuestion[] }>('repeated-questions', params), SWR_ANALYTICS_CONFIG);
}

export function useRAGLatency(params: FetchOptions) {
  const key = `/api/analytics-v2/rag-latency?${new URLSearchParams({ tenantId: params.tenantId, days: params.days?.toString() || '30' }).toString()}`;
  return useSWR<{ ragLatency: RAGLatencyMetric[] }>(key, () => fetchAnalyticsV2<{ ragLatency: RAGLatencyMetric[] }>('rag-latency', params), SWR_ANALYTICS_CONFIG);
}

export function useDocumentHealth(params: FetchOptions) {
  const key = `/api/analytics-v2/document-health?${new URLSearchParams({ tenantId: params.tenantId, limit: params.limit?.toString() || '20' }).toString()}`;
  return useSWR<{
    documentHealth: DocumentHealthMetric[];
    statusCounts: Record<string, number>;
    avgHealthScore: number;
  }>(key, () => fetchAnalyticsV2<{
    documentHealth: DocumentHealthMetric[];
    statusCounts: Record<string, number>;
    avgHealthScore: number;
  }>('document-health', params), SWR_ANALYTICS_CONFIG);
}

export function useCostModel(params: FetchOptions) {
  const key = `/api/analytics-v2/cost-model?${new URLSearchParams({ tenantId: params.tenantId, days: params.days?.toString() || '30' }).toString()}`;
  return useSWR<{
    costTrajectory: CostModelPoint[];
    totalActualCost: number;
    monthlyProjection: number;
  }>(key, () => fetchAnalyticsV2<{
    costTrajectory: CostModelPoint[];
    totalActualCost: number;
    monthlyProjection: number;
  }>('cost-model', params), SWR_ANALYTICS_CONFIG);
}

export function useUserFunnel(params: FetchOptions) {
  const key = `/api/analytics-v2/user-funnel?${new URLSearchParams({ tenantId: params.tenantId, days: params.days?.toString() || '30' }).toString()}`;
  return useSWR<{
    funnelMetrics: UserFunnelMetric[];
    overallConversionRate: number;
  }>(key, () => fetchAnalyticsV2<{
    funnelMetrics: UserFunnelMetric[];
    overallConversionRate: number;
  }>('user-funnel', params), SWR_ANALYTICS_CONFIG);
}

export async function fetchInsight(
  sectionName: string,
  metrics: Record<string, any>,
  tenantId: string
): Promise<string> {
  try {
    const res = await fetch('/api/analytics-v2/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectionName, metrics, tenantId }),
    });

    if (!res.ok) {
      throw new Error('Failed to fetch insight');
    }

    const data = await res.json() as InsightResponse;
    return data.insight;
  } catch (error) {
    console.error('Error fetching insight:', error);
    return 'Unable to generate insights at this time. Please try again later.';
  }
}
