/**
 * GET /api/issues/list
 *
 * Assistant V2 Sprint 3. Paginated list of issues for the developer
 * dashboard.
 *
 * Spec: docs/specs/assistant-v2-sprint-3.md section 5.2.
 *
 * Query params (all optional):
 *   - development_id  uuid, single
 *   - status          comma-separated, defaults to 'open,reopened'
 *   - severity        comma-separated: low,medium,high,urgent
 *   - source          comma-separated: homeowner_assistant,site_team_snag,snagger_external
 *   - flagged         boolean; if 'true' returns only developer-flagged rows
 *   - sort            'created_at_desc' (default), 'severity_desc', 'created_at_asc'
 *   - limit           default 50, max 200
 *   - offset          default 0
 *
 * Each row joins unit display_name and development name so the dashboard
 * does not need extra fetches per row. Media URLs are NOT included; media
 * is fetched on the detail view.
 *
 * Scoped to the caller's tenant. snagger_external is rejected with 403
 * before any DB work because the dashboard is developer-side only.
 *
 * Gated on FEATURE_DEVELOPER_DASHBOARD.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { isDeveloperDashboardEnabled } from '@/lib/feature-flags';
import {
  resolveSnagAuth,
  snagAuthErrorToResponse,
  snagFeatureDisabledResponse,
  SnagAuthError,
} from '@/lib/assistant/snag-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const DEFAULT_STATUS = ['open', 'reopened'];
const VALID_STATUSES = new Set(['open', 'reopened', 'resolved', 'closed']);
const VALID_SEVERITIES = new Set(['low', 'medium', 'high', 'urgent']);
const VALID_SOURCES = new Set(['homeowner_assistant', 'site_team_snag', 'snagger_external']);
const VALID_SORTS = new Set(['created_at_desc', 'severity_desc', 'created_at_asc']);

function parseCsv(value: string | null, allowed: Set<string>): string[] | null {
  if (!value) return null;
  const items = value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const item of items) {
    if (!allowed.has(item)) return null;
  }
  return items.length > 0 ? items : null;
}

function deriveUnitDisplayName(u: {
  unit_code: string | null;
  unit_number: string | null;
  address_line_1: string | null;
}): string {
  return u.unit_code ?? u.unit_number ?? u.address_line_1 ?? 'Unit';
}

export async function GET(request: NextRequest) {
  if (!isDeveloperDashboardEnabled()) {
    return snagFeatureDisabledResponse();
  }

  let auth;
  try {
    auth = await resolveSnagAuth(request);
  } catch (err) {
    if (err instanceof SnagAuthError) return snagAuthErrorToResponse(err);
    throw err;
  }
  if (auth.role === 'snagger_external') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const developmentIdParam = url.searchParams.get('development_id');
  const statusParam = url.searchParams.get('status');
  const severityParam = url.searchParams.get('severity');
  const sourceParam = url.searchParams.get('source');
  const flaggedParam = url.searchParams.get('flagged');
  const sortParam = url.searchParams.get('sort') ?? 'created_at_desc';
  const limitParam = url.searchParams.get('limit');
  const offsetParam = url.searchParams.get('offset');

  if (developmentIdParam && !UUID_RE.test(developmentIdParam)) {
    return NextResponse.json({ error: 'development_id must be a uuid' }, { status: 400 });
  }
  const statuses = statusParam ? parseCsv(statusParam, VALID_STATUSES) : DEFAULT_STATUS;
  if (statusParam && !statuses) {
    return NextResponse.json({ error: 'invalid status filter' }, { status: 400 });
  }
  const severities = parseCsv(severityParam, VALID_SEVERITIES);
  if (severityParam && !severities) {
    return NextResponse.json({ error: 'invalid severity filter' }, { status: 400 });
  }
  const sources = parseCsv(sourceParam, VALID_SOURCES);
  if (sourceParam && !sources) {
    return NextResponse.json({ error: 'invalid source filter' }, { status: 400 });
  }
  if (!VALID_SORTS.has(sortParam)) {
    return NextResponse.json({ error: 'invalid sort' }, { status: 400 });
  }

  let limit = limitParam ? parseInt(limitParam, 10) : DEFAULT_LIMIT;
  let offset = offsetParam ? parseInt(offsetParam, 10) : 0;
  if (!Number.isFinite(limit) || limit <= 0) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  if (!Number.isFinite(offset) || offset < 0) offset = 0;

  const supabase = getSupabaseAdmin();

  let query = supabase
    .from('issue_reports')
    .select(
      'id, tenant_id, development_id, unit_id, title, source, severity_label, severity_score, status, priority, room, developer_flagged, logged_by_role, created_at, resolved_at',
      { count: 'exact' },
    )
    .eq('tenant_id', auth.tenantId);

  if (developmentIdParam) {
    query = query.eq('development_id', developmentIdParam);
  }
  if (statuses && statuses.length > 0) {
    query = query.in('status', statuses);
  }
  if (severities && severities.length > 0) {
    query = query.in('severity_label', severities);
  }
  if (sources && sources.length > 0) {
    query = query.in('source', sources);
  }
  if (flaggedParam === 'true') {
    query = query.eq('developer_flagged', true);
  }

  if (sortParam === 'created_at_asc') {
    query = query.order('created_at', { ascending: true });
  } else if (sortParam === 'severity_desc') {
    query = query
      .order('severity_score', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }
  query = query.range(offset, offset + limit - 1);

  const { data: rows, error: listErr, count } = await query;
  if (listErr) {
    console.error('[issues-list] list_failed reason=%s', listErr.message);
    return NextResponse.json({ error: 'Could not load issues' }, { status: 500 });
  }
  const reportRows = rows ?? [];
  const issueIds = reportRows.map((r) => r.id as string);

  const unitIds = Array.from(
    new Set(reportRows.map((r) => r.unit_id as string | null).filter((v): v is string => !!v)),
  );
  const developmentIds = Array.from(
    new Set(reportRows.map((r) => r.development_id as string).filter((v): v is string => !!v)),
  );

  const unitsById = new Map<string, { display_name: string }>();
  if (unitIds.length > 0) {
    const { data: unitRows, error: unitErr } = await supabase
      .from('units')
      .select('id, unit_code, unit_number, address_line_1')
      .in('id', unitIds);
    if (unitErr) {
      console.error('[issues-list] unit_lookup_failed reason=%s', unitErr.message);
    } else {
      for (const u of unitRows ?? []) {
        unitsById.set(u.id as string, {
          display_name: deriveUnitDisplayName({
            unit_code: (u.unit_code as string | null) ?? null,
            unit_number: (u.unit_number as string | null) ?? null,
            address_line_1: (u.address_line_1 as string | null) ?? null,
          }),
        });
      }
    }
  }

  const developmentsById = new Map<string, { name: string | null }>();
  if (developmentIds.length > 0) {
    const { data: devRows, error: devErr } = await supabase
      .from('developments')
      .select('id, name')
      .in('id', developmentIds);
    if (devErr) {
      console.error('[issues-list] development_lookup_failed reason=%s', devErr.message);
    } else {
      for (const d of devRows ?? []) {
        developmentsById.set(d.id as string, { name: (d.name as string | null) ?? null });
      }
    }
  }

  const mediaCounts = new Map<string, number>();
  const noteCounts = new Map<string, number>();
  if (issueIds.length > 0) {
    const [mediaRes, notesRes] = await Promise.all([
      supabase.from('issue_report_media').select('issue_report_id').in('issue_report_id', issueIds),
      supabase.from('issue_notes').select('issue_report_id').in('issue_report_id', issueIds),
    ]);
    if (mediaRes.error) {
      console.error('[issues-list] media_count_failed reason=%s', mediaRes.error.message);
    } else {
      for (const j of mediaRes.data ?? []) {
        const k = j.issue_report_id as string;
        mediaCounts.set(k, (mediaCounts.get(k) ?? 0) + 1);
      }
    }
    if (notesRes.error) {
      console.error('[issues-list] note_count_failed reason=%s', notesRes.error.message);
    } else {
      for (const j of notesRes.data ?? []) {
        const k = j.issue_report_id as string;
        noteCounts.set(k, (noteCounts.get(k) ?? 0) + 1);
      }
    }
  }

  return NextResponse.json({
    rows: reportRows.map((r) => {
      const unitId = r.unit_id as string | null;
      const devId = r.development_id as string;
      const unit = unitId ? unitsById.get(unitId) ?? null : null;
      const dev = developmentsById.get(devId) ?? null;
      return {
        id: r.id,
        title: r.title,
        source: r.source,
        severity_label: r.severity_label,
        severity_score: r.severity_score,
        status: r.status,
        priority: r.priority,
        room: r.room,
        unit_display_name: unit?.display_name ?? null,
        development_name: dev?.name ?? null,
        media_count: mediaCounts.get(r.id as string) ?? 0,
        note_count: noteCounts.get(r.id as string) ?? 0,
        developer_flagged: r.developer_flagged,
        created_at: r.created_at,
        resolved_at: r.resolved_at,
        logged_by_role: r.logged_by_role,
      };
    }),
    total: count ?? reportRows.length,
    limit,
    offset,
  });
}
