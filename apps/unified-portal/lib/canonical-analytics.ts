export interface CanonicalMetricError {
  metric: string;
  reason: string;
  attempted_query?: string;
}

export interface CanonicalAnalyticsSummary {
  total_events: number;
  total_questions: number;
  questions_in_window: number;
  active_units_in_window: number;
  active_tenants_in_window: number;
  recovered_events_count: number;
  inferred_events_count: number;
  live_events_count: number;
  total_qr_scans: number;
  total_signups: number;
  total_document_opens: number;
  qr_scans_in_window: number;
  signups_in_window: number;
  document_opens_in_window: number;
  computed_at: string;
  time_window: string;
  time_window_days: number;
  scope: string;
  project_id?: string;
  developer_id?: string;
  errors: CanonicalMetricError[];
}

export type CanonicalScope = 'superadmin' | 'developer';
export type CanonicalTimeWindow = '7d' | '14d' | '30d' | '90d';

export interface CanonicalSummaryParams {
  scope: CanonicalScope;
  project_id?: string;
  developer_id?: string;
  time_window?: CanonicalTimeWindow;
}

export function formatMetricForDisplay(value: number | null | undefined, fallback: string = '0'): string {
  if (value === null || value === undefined) return fallback;
  return value.toLocaleString();
}

export function hasMetricError(summary: CanonicalAnalyticsSummary, metric: string): boolean {
  return summary.errors.some(e => e.metric === metric || e.metric === 'all');
}

export function getMetricErrorReason(summary: CanonicalAnalyticsSummary, metric: string): string | null {
  const error = summary.errors.find(e => e.metric === metric || e.metric === 'all');
  return error?.reason || null;
}

export function getAIInsightFromSummary(summary: CanonicalAnalyticsSummary): string {
  if (summary.errors.length > 0) {
    const failedMetrics = summary.errors.map(e => e.metric).join(', ');
    return `Analytics data unavailable due to: ${failedMetrics} query failures. Please try again later.`;
  }
  
  if (summary.total_events === 0) {
    return 'No analytics events recorded yet. Activity tracking will begin once users interact with the platform.';
  }
  
  const questionRate = summary.total_questions > 0 
    ? ((summary.questions_in_window / summary.total_questions) * 100).toFixed(1)
    : '0';
  
  const recoveredPct = summary.total_events > 0
    ? ((summary.recovered_events_count / summary.total_events) * 100).toFixed(1)
    : '0';

  const parts: string[] = [];
  
  parts.push(`${summary.total_questions.toLocaleString()} total questions recorded`);
  parts.push(`${summary.questions_in_window.toLocaleString()} in the last ${summary.time_window_days} days (${questionRate}% of total)`);
  parts.push(`${summary.active_tenants_in_window.toLocaleString()} active users in window`);
  
  if (summary.recovered_events_count > 0) {
    parts.push(`${summary.recovered_events_count.toLocaleString()} recovered events (${recoveredPct}%)`);
  }
  
  return parts.join('. ') + '.';
}

export function assertSummaryConsistency(
  summaryA: CanonicalAnalyticsSummary,
  summaryB: CanonicalAnalyticsSummary,
  context: string
): void {
  if (process.env.NODE_ENV !== 'development') return;

  const metricsToCheck = [
    'total_events',
    'total_questions', 
    'questions_in_window',
    'active_tenants_in_window',
  ] as const;

  for (const metric of metricsToCheck) {
    if (summaryA[metric] !== summaryB[metric]) {
      console.error(
        `[ANALYTICS CONSISTENCY ERROR] ${context}: Metric '${metric}' differs between sources. ` +
        `A: ${summaryA[metric]}, B: ${summaryB[metric]}. ` +
        `Computed at A: ${summaryA.computed_at}, B: ${summaryB.computed_at}`
      );
    }
  }
}
