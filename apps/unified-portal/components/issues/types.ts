/**
 * Shared types for the Sprint 3 developer dashboard. Matches the
 * response shapes from /api/issues/list and /api/issues/[id].
 *
 * Spec: docs/specs/assistant-v2-sprint-3.md sections 5.2 and 5.3.
 */

export type IssueSeverity = 'low' | 'medium' | 'high' | 'urgent';
export type IssueStatus = 'open' | 'reopened' | 'resolved' | 'closed';
export type IssueSource =
  | 'homeowner_assistant'
  | 'site_team_snag'
  | 'snagger_external';

export interface IssueListRow {
  id: string;
  title: string;
  source: IssueSource;
  severity_label: IssueSeverity | null;
  severity_score: number | null;
  status: IssueStatus;
  priority: string | null;
  room: string | null;
  unit_display_name: string | null;
  development_name: string | null;
  media_count: number;
  note_count: number;
  developer_flagged: boolean;
  created_at: string;
  resolved_at: string | null;
  logged_by_role: string | null;
  // Sprint 3.5a.1: true when source is 'homeowner_escalated' and the
  // most recent 'escalated_from_homeowner' event landed within 24h.
  // Used to render a "From homeowner" marker on dashboard rows. Older
  // server responses without this field fall through as undefined.
  newly_escalated?: boolean;
}

export interface IssueListResponse {
  rows: IssueListRow[];
  total: number;
  limit: number;
  offset: number;
}

export interface IssueUnitGroup {
  unit_id: string;
  unit_display_name: string;
  development_id: string | null;
  development_name: string | null;
  open_count: number;
  urgent_high_count: number;
  worst_severity: IssueSeverity | null;
  issues: IssueListRow[];
}

export interface IssueUnitListResponse {
  units: IssueUnitGroup[];
  total_units: number;
  limit: number;
  offset: number;
}

export type IssueDashboardView = 'unit' | 'activity';

export interface IssueOverviewCounts {
  open: number;
  high_priority: number;
  new_this_week: number;
  resolved_this_month: number;
}

export interface IssueMedia {
  id: string;
  storage_path: string;
  thumbnail_path: string | null;
  mime_type: string;
  width: number | null;
  height: number | null;
  signed_url: string;
  thumbnail_url: string;
  expires_at: string;
}

export interface IssueEvent {
  id: string;
  event_type: string;
  actor_type: string | null;
  actor_id: string | null;
  actor_email: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface IssueNote {
  id: string;
  author_user_id: string;
  author_role: string;
  author_email: string | null;
  body: string;
  created_at: string;
}

export interface IssueReport {
  id: string;
  tenant_id: string;
  development_id: string;
  unit_id: string | null;
  user_id: string | null;
  title: string;
  description: string | null;
  room: string | null;
  status: IssueStatus;
  priority: string | null;
  severity_label: IssueSeverity | null;
  severity_score: number | null;
  safety_risk: string | null;
  likely_trade: string | null;
  likely_system: string | null;
  source: IssueSource;
  logged_by_user_id: string | null;
  logged_by_role: string | null;
  linked_analysis_id: string | null;
  developer_flagged: boolean;
  developer_flagged_at: string | null;
  developer_flagged_by: string | null;
  created_at: string;
  updated_at: string | null;
  resolved_at: string | null;
  unit_display_name: string | null;
  development_name: string | null;
}

export interface IssueAnalysis {
  id?: string;
  model_provider?: string | null;
  model_name?: string | null;
  summary?: string | null;
  severity_label?: string | null;
  severity_score?: number | null;
  safety_risk?: string | null;
  likely_trade?: string | null;
  likely_system?: string | null;
  suggested_priority?: string | null;
  ai_reasoning?: string | null;
  reasoning?: string | null;
  evidence?: Array<{ description?: string; confidence?: number } | string> | null;
  recommended_action?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
}

export interface IssueDetailResponse {
  report: IssueReport;
  media: IssueMedia[];
  analysis: IssueAnalysis | null;
  events: IssueEvent[];
  notes: IssueNote[];
}

export interface DevelopmentLite {
  id: string;
  name: string;
}

export interface DashboardInitialData {
  overview: IssueOverviewCounts;
  list: IssueListResponse;
  developments: DevelopmentLite[];
}

export interface IssueFilters {
  status: IssueStatus[];
  severity: IssueSeverity[];
  source: IssueSource[];
  development_id: string | null;
  flagged: boolean;
  search: string;
  sort: 'created_at_desc' | 'severity_desc' | 'created_at_asc';
}

export const DEFAULT_FILTERS: IssueFilters = {
  status: ['open', 'reopened'],
  severity: [],
  source: [],
  development_id: null,
  flagged: false,
  search: '',
  sort: 'created_at_desc',
};

export const PAGE_SIZE = 50;

export function severityBarClass(severity: IssueSeverity | null): string {
  switch (severity) {
    case 'urgent':
      return 'bg-red-600';
    case 'high':
      return 'bg-red-500';
    case 'medium':
      return 'bg-amber-500';
    case 'low':
      return 'bg-neutral-300';
    default:
      return 'bg-neutral-200';
  }
}

export function statusDotClass(status: IssueStatus): string {
  switch (status) {
    case 'resolved':
      return 'bg-green-500';
    case 'reopened':
      return 'bg-amber-500';
    case 'closed':
      return 'bg-neutral-400';
    default:
      return 'bg-neutral-500';
  }
}

export function statusLabel(status: IssueStatus): string {
  switch (status) {
    case 'resolved':
      return 'Resolved';
    case 'reopened':
      return 'Reopened';
    case 'closed':
      return 'Closed';
    default:
      return 'Open';
  }
}

export function sourceLabel(source: IssueSource): string {
  switch (source) {
    case 'homeowner_assistant':
      return 'Homeowner';
    case 'site_team_snag':
      return 'Site team';
    case 'snagger_external':
      return 'Snagger';
    default:
      return source;
  }
}

export function severityLabel(severity: IssueSeverity | null): string {
  if (!severity) return 'Unassessed';
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}
