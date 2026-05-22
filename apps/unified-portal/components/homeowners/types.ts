/**
 * Sprint 3.5a homeowner-issue types. Shared by the Reported Issues
 * card and the three resolution-action modals. Mirrors the response
 * shape of GET /api/homeowners/[id]/issues.
 */

export type HomeownerIssueStatus = 'homeowner_new' | 'open' | 'reopened' | 'resolved';

export type HomeownerIssueSource =
  | 'homeowner_assistant'
  | 'site_team_snag'
  | 'snagger_external'
  | 'homeowner_escalated';

export type HomeownerIssueResolutionType = 'direct_reply' | 'warranty_referral' | null;

export interface HomeownerIssueMedia {
  id: string;
  signed_url: string;
  thumbnail_url: string;
  mime_type: string;
  width: number | null;
  height: number | null;
  expires_at: string;
}

export interface HomeownerIssueAnalysis {
  id?: string;
  model_provider?: string | null;
  model_name?: string | null;
  developer_summary?: string | null;
  severity_label?: string | null;
  severity_score?: number | null;
  safety_risk?: boolean | null;
  likely_trade?: string | null;
  likely_system?: string | null;
  recommended_action?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
}

export interface HomeownerIssue {
  id: string;
  title: string;
  description: string | null;
  room: string | null;
  source: HomeownerIssueSource;
  status: HomeownerIssueStatus;
  priority: string | null;
  severity_label: string | null;
  severity_score: number | null;
  safety_risk: boolean | null;
  likely_trade: string | null;
  likely_system: string | null;
  resolution_type: HomeownerIssueResolutionType;
  logged_by_role: string | null;
  created_at: string;
  updated_at: string | null;
  resolved_at: string | null;
  analysis: HomeownerIssueAnalysis | null;
  first_media: HomeownerIssueMedia | null;
}

export interface HomeownerIssuesResponse {
  unit_id: string;
  issues: HomeownerIssue[];
}

const STATUS_ORDER: Record<HomeownerIssueStatus, number> = {
  homeowner_new: 0,
  open: 1,
  reopened: 2,
  resolved: 3,
};

export function compareIssues(a: HomeownerIssue, b: HomeownerIssue): number {
  const orderA = STATUS_ORDER[a.status] ?? 99;
  const orderB = STATUS_ORDER[b.status] ?? 99;
  if (orderA !== orderB) return orderA - orderB;
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

export function statusPillClass(status: HomeownerIssueStatus): string {
  // Sprint 3.5a.3: warm-gold text on warm-gold backgrounds failed the
  // WCAG AA 4.5:1 contrast target at small font sizes. The amber-700/800
  // text was darkened to gold-950 (#6B4E1C), which clears 7:1 against
  // amber-100 while preserving the visual category.
  switch (status) {
    case 'homeowner_new':
      return 'bg-amber-100 text-gold-950';
    case 'open':
      return 'bg-blue-100 text-blue-800';
    case 'reopened':
      return 'bg-amber-100 text-gold-950';
    case 'resolved':
      return 'bg-green-100 text-green-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

export function statusPillLabel(
  status: HomeownerIssueStatus,
  resolutionType: HomeownerIssueResolutionType,
): string {
  switch (status) {
    case 'homeowner_new':
      return 'Awaiting review';
    case 'open':
      return 'Open';
    case 'reopened':
      return 'Reopened';
    case 'resolved':
      if (resolutionType === 'direct_reply') return 'Resolved by reply';
      if (resolutionType === 'warranty_referral') return 'Warranty referral';
      return 'Resolved';
    default:
      return status;
  }
}

export function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now - then);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  if (diff < minute) return 'just now';
  if (diff < hour) {
    const m = Math.floor(diff / minute);
    return `${m}m ago`;
  }
  if (diff < day) {
    const h = Math.floor(diff / hour);
    return `${h}h ago`;
  }
  if (diff < week) {
    const d = Math.floor(diff / day);
    return `${d}d ago`;
  }
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
