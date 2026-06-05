// lib/dev-app/snags.ts
// Types, vocab and helpers for the V1 snagging "system of account" (migration 067).
// Kept framework-agnostic so it can be shared by API routes and UI.

export const SNAG_STATUSES = [
  'open',
  'in_progress',
  'resolved',
  'verified',
  'disputed',
  'wont_fix',
] as const;
export type SnagStatus = (typeof SNAG_STATUSES)[number];

export const SNAG_SEVERITIES = ['safety', 'major', 'minor', 'cosmetic'] as const;
export type SnagSeverity = (typeof SNAG_SEVERITIES)[number];

export const SNAG_SOURCES = ['in_app', 'uploaded_report', 'homeowner_chat', 'import'] as const;
export type SnagSource = (typeof SNAG_SOURCES)[number];

export const SNAG_CREATED_BY_ROLES = [
  'builder_crew',
  'purchaser_snagger',
  'homeowner',
  'site_manager',
  'developer',
] as const;
export type SnagCreatedByRole = (typeof SNAG_CREATED_BY_ROLES)[number];

// Still needs work (drives the attention feed and the "open" count on a unit).
export const OPEN_SNAG_STATUSES: SnagStatus[] = ['open', 'in_progress', 'disputed'];
// Closed out.
export const CLOSED_SNAG_STATUSES: SnagStatus[] = ['resolved', 'verified', 'wont_fix'];

export interface Snag {
  id: string;
  tenant_id: string | null;
  development_id: string;
  unit_id: string;
  title: string | null;
  description: string;
  status: SnagStatus;
  severity: SnagSeverity;
  trade: string | null;
  location: string | null;
  responsible_contractor_id: string | null;
  created_by_role: SnagCreatedByRole | null;
  created_by_user_id: string | null;
  reported_by: string | null;
  source: SnagSource;
  photo_url: string | null;
  photo_urls: string[];
  ai_classification: Record<string, unknown> | null;
  ai_dedup_group: string | null;
  sla_due_at: string | null;
  verified_by: string | null;
  verified_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  offline_client_id: string | null;
  issue_report_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Contractor {
  id: string;
  tenant_id: string;
  name: string;
  trades: string[];
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  external_ref: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ContractorScorecardRow {
  contractor_id: string;
  tenant_id: string;
  name: string;
  total_snags: number;
  safety_snags: number;
  open_snags: number;
  closed_snags: number;
  avg_days_to_close: number | null;
}

export function isSnagStatus(v: unknown): v is SnagStatus {
  return typeof v === 'string' && (SNAG_STATUSES as readonly string[]).includes(v);
}

export function isSnagSeverity(v: unknown): v is SnagSeverity {
  return typeof v === 'string' && (SNAG_SEVERITIES as readonly string[]).includes(v);
}

/**
 * Confirms the authenticated user owns the development the unit belongs to, via
 * developments.developer_user_id — the app-code enforcement model used across
 * the dev-app routes. Returns the unit's ids, or null if not owned / not found.
 *
 * `supabase` must be the cookie-scoped user client (createServerSupabaseClient).
 */
export async function getOwnedUnit(
  supabase: any,
  userId: string,
  unitId: string,
): Promise<{ id: string; tenant_id: string; development_id: string } | null> {
  const { data: unit } = await supabase
    .from('units')
    .select('id, tenant_id, development_id')
    .eq('id', unitId)
    .single();
  if (!unit) return null;

  const { data: dev } = await supabase
    .from('developments')
    .select('id')
    .eq('id', unit.development_id)
    .eq('developer_user_id', userId)
    .single();
  if (!dev) return null;

  return { id: unit.id, tenant_id: unit.tenant_id, development_id: unit.development_id };
}
