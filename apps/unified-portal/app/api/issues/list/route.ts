/**
 * GET /api/issues/list
 *
 * Assistant V2 Sprint 3. Paginated list of issues for the developer
 * dashboard. Sprint 3.1 added optional unit grouping.
 *
 * Spec:
 *   docs/specs/assistant-v2-sprint-3.md   section 5.2 (base flat list)
 *   docs/specs/assistant-v2-sprint-3-1.md section 4   (unit grouping)
 *
 * Query params (all optional):
 *   - development_id  uuid, single
 *   - unit_id         uuid, single. Filters the flat list to one unit.
 *                     Also valid alongside group_by_unit=true (still
 *                     scopes the matching set).
 *   - status          comma-separated, defaults to 'open,reopened'
 *   - severity        comma-separated: low,medium,high,urgent
 *   - source          comma-separated: homeowner_assistant,site_team_snag,snagger_external
 *   - flagged         boolean; if 'true' returns only developer-flagged rows
 *   - q               case-insensitive title substring match; trimmed,
 *                     non-empty after trim, max 200 chars
 *   - sort            'created_at_desc' (default), 'severity_desc', 'created_at_asc'
 *   - group_by_unit   boolean; if 'true' returns the unit-grouped shape
 *                     (units array). Pagination then operates at the unit
 *                     level instead of at the row level.
 *   - limit           default 50, max 200
 *   - offset          default 0
 *
 * Grouping semantics (when group_by_unit=true):
 *   - All filters apply to the matching set per unit. A unit appears in
 *     the response only if it has at least one matching issue.
 *   - The per-unit chips and sort metadata (open_count, urgent_high_count,
 *     worst_severity) describe the unit's true open + reopened state,
 *     regardless of the filters. The chips describe the unit, the filter
 *     shapes the grid.
 *   - issues[] for each unit holds the top 3 most recent matching issues.
 *   - Issues with unit_id NULL are excluded from the grouped view.
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
const MAX_SEARCH_LEN = 200;
const TOP_ISSUES_PER_UNIT = 3;
const MAX_MATCHING_ROWS = 5000;

const SEVERITY_RANK: Record<string, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function escapeIlikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}

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

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

type IssueRow = {
  id: string;
  tenant_id: string;
  development_id: string;
  unit_id: string | null;
  title: string | null;
  source: string | null;
  severity_label: string | null;
  severity_score: number | null;
  status: string | null;
  priority: string | null;
  room: string | null;
  developer_flagged: boolean | null;
  logged_by_role: string | null;
  created_at: string;
  resolved_at: string | null;
};

type RowSelectFields =
  'id, tenant_id, development_id, unit_id, title, source, severity_label, severity_score, status, priority, room, developer_flagged, logged_by_role, created_at, resolved_at';
const ROW_SELECT: RowSelectFields =
  'id, tenant_id, development_id, unit_id, title, source, severity_label, severity_score, status, priority, room, developer_flagged, logged_by_role, created_at, resolved_at';

function buildResponseRow(
  r: IssueRow,
  unitDisplayName: string | null,
  developmentName: string | null,
  mediaCount: number,
  noteCount: number,
  newlyEscalated: boolean,
  latestEscalationAt: string | null,
) {
  return {
    id: r.id,
    title: r.title,
    source: r.source,
    severity_label: r.severity_label,
    severity_score: r.severity_score,
    status: r.status,
    priority: r.priority,
    room: r.room,
    unit_display_name: unitDisplayName,
    development_name: developmentName,
    media_count: mediaCount,
    note_count: noteCount,
    developer_flagged: r.developer_flagged,
    created_at: r.created_at,
    resolved_at: r.resolved_at,
    logged_by_role: r.logged_by_role,
    newly_escalated: newlyEscalated,
    latest_escalation_at: latestEscalationAt,
  };
}

// Sprint 3.5a.2: returns the timestamp of the most recent
// 'escalated_from_homeowner' event per issue id (no age cutoff). Powers
// both the 7-day sort-to-top behaviour and the 24-hour "Newly
// escalated" pill. Only queries issues whose source is currently
// 'homeowner_escalated', which is the only set that can match.
async function fetchLatestEscalationTimestamps(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  rows: IssueRow[],
): Promise<Map<string, string>> {
  const candidateIds = rows
    .filter((r) => r.source === 'homeowner_escalated')
    .map((r) => r.id);
  if (candidateIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from('issue_events')
    .select('issue_report_id, created_at')
    .eq('event_type', 'escalated_from_homeowner')
    .in('issue_report_id', candidateIds)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[issues-list] latest_escalation_lookup_failed reason=%s', error.message);
    return new Map();
  }
  const latest = new Map<string, string>();
  for (const row of data ?? []) {
    const id = row.issue_report_id as string;
    if (!latest.has(id)) {
      latest.set(id, row.created_at as string);
    }
  }
  return latest;
}

function isFreshlyEscalated(latestEscalationAt: string | null, nowMs: number): boolean {
  if (!latestEscalationAt) return false;
  const t = new Date(latestEscalationAt).getTime();
  if (!Number.isFinite(t)) return false;
  return nowMs - t < SEVEN_DAYS_MS;
}

function isNewlyEscalated(latestEscalationAt: string | null, nowMs: number): boolean {
  if (!latestEscalationAt) return false;
  const t = new Date(latestEscalationAt).getTime();
  if (!Number.isFinite(t)) return false;
  return nowMs - t < TWENTY_FOUR_HOURS_MS;
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
  const unitIdParam = url.searchParams.get('unit_id');
  const statusParam = url.searchParams.get('status');
  const severityParam = url.searchParams.get('severity');
  const sourceParam = url.searchParams.get('source');
  const flaggedParam = url.searchParams.get('flagged');
  const qParam = url.searchParams.get('q');
  const sortParam = url.searchParams.get('sort') ?? 'created_at_desc';
  const groupByUnitParam = url.searchParams.get('group_by_unit');
  const limitParam = url.searchParams.get('limit');
  const offsetParam = url.searchParams.get('offset');

  if (developmentIdParam && !UUID_RE.test(developmentIdParam)) {
    return NextResponse.json({ error: 'development_id must be a uuid' }, { status: 400 });
  }
  if (unitIdParam && !UUID_RE.test(unitIdParam)) {
    return NextResponse.json({ error: 'unit_id must be a uuid' }, { status: 400 });
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

  let searchTerm: string | null = null;
  if (qParam !== null) {
    const trimmed = qParam.trim();
    if (trimmed.length === 0) {
      return NextResponse.json({ error: 'q must not be empty' }, { status: 400 });
    }
    if (trimmed.length > MAX_SEARCH_LEN) {
      return NextResponse.json({ error: 'q exceeds 200 characters' }, { status: 400 });
    }
    searchTerm = trimmed;
  }

  let limit = limitParam ? parseInt(limitParam, 10) : DEFAULT_LIMIT;
  let offset = offsetParam ? parseInt(offsetParam, 10) : 0;
  if (!Number.isFinite(limit) || limit <= 0) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  if (!Number.isFinite(offset) || offset < 0) offset = 0;

  const groupByUnit = groupByUnitParam === 'true';

  const supabase = getSupabaseAdmin();

  if (groupByUnit) {
    return await handleGrouped({
      supabase,
      tenantId: auth.tenantId,
      developmentId: developmentIdParam,
      unitId: unitIdParam,
      statuses,
      severities,
      sources,
      flagged: flaggedParam === 'true',
      searchTerm,
      limit,
      offset,
    });
  }

  // Sprint 3.5a.2: fetch up to MAX_MATCHING_ROWS so freshly-escalated
  // items can float to the top regardless of where the existing sort
  // would have placed them. Sort and pagination happen in memory below.
  let query = supabase
    .from('issue_reports')
    .select(ROW_SELECT)
    .eq('tenant_id', auth.tenantId);

  if (developmentIdParam) {
    query = query.eq('development_id', developmentIdParam);
  }
  if (unitIdParam) {
    query = query.eq('unit_id', unitIdParam);
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
  if (searchTerm) {
    query = query.ilike('title', `%${escapeIlikePattern(searchTerm)}%`);
  }
  query = query.limit(MAX_MATCHING_ROWS);

  const { data: rows, error: listErr } = await query;
  if (listErr) {
    console.error('[issues-list] list_failed reason=%s', listErr.message);
    return NextResponse.json({ error: 'Could not load issues' }, { status: 500 });
  }
  const reportRows = (rows ?? []) as IssueRow[];

  const latestEscalationByIssue = await fetchLatestEscalationTimestamps(supabase, reportRows);
  const nowMs = Date.now();
  const sortedRows = sortFlatRows(reportRows, latestEscalationByIssue, sortParam, nowMs);

  const totalCount = sortedRows.length;
  const pagedRows = sortedRows.slice(offset, offset + limit);
  const issueIds = pagedRows.map((r) => r.id);

  const unitIds = Array.from(
    new Set(pagedRows.map((r) => r.unit_id).filter((v): v is string => !!v)),
  );
  const developmentIds = Array.from(
    new Set(pagedRows.map((r) => r.development_id).filter((v): v is string => !!v)),
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

  const { mediaCounts, noteCounts } = await fetchAuxCounts(supabase, issueIds);

  return NextResponse.json({
    rows: pagedRows.map((r) => {
      const unit = r.unit_id ? unitsById.get(r.unit_id) ?? null : null;
      const dev = developmentsById.get(r.development_id) ?? null;
      const escAt = latestEscalationByIssue.get(r.id) ?? null;
      return buildResponseRow(
        r,
        unit?.display_name ?? null,
        dev?.name ?? null,
        mediaCounts.get(r.id) ?? 0,
        noteCounts.get(r.id) ?? 0,
        isNewlyEscalated(escAt, nowMs),
        escAt,
      );
    }),
    total: totalCount,
    limit,
    offset,
  });
}

function sortFlatRows(
  rows: IssueRow[],
  latestEscalationByIssue: Map<string, string>,
  sortParam: string,
  nowMs: number,
): IssueRow[] {
  type Decorated = {
    row: IssueRow;
    escAt: string | null;
    fresh: boolean;
    resolved: boolean;
    createdMs: number;
  };
  const decorated: Decorated[] = rows.map((r) => {
    const escAt = latestEscalationByIssue.get(r.id) ?? null;
    return {
      row: r,
      escAt,
      fresh: isFreshlyEscalated(escAt, nowMs),
      resolved: r.status === 'resolved' || r.status === 'closed',
      createdMs: new Date(r.created_at).getTime(),
    };
  });
  decorated.sort((a, b) => {
    const groupA = a.fresh ? 0 : a.resolved ? 2 : 1;
    const groupB = b.fresh ? 0 : b.resolved ? 2 : 1;
    if (groupA !== groupB) return groupA - groupB;

    if (groupA === 0) {
      const ta = new Date(a.escAt as string).getTime();
      const tb = new Date(b.escAt as string).getTime();
      if (tb !== ta) return tb - ta;
    }

    if (sortParam === 'severity_desc') {
      const aSev = a.row.severity_score ?? -1;
      const bSev = b.row.severity_score ?? -1;
      if (aSev !== bSev) return bSev - aSev;
      return b.createdMs - a.createdMs;
    }
    if (sortParam === 'created_at_asc') {
      return a.createdMs - b.createdMs;
    }
    return b.createdMs - a.createdMs;
  });
  return decorated.map((d) => d.row);
}

type GroupedParams = {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  tenantId: string;
  developmentId: string | null;
  unitId: string | null;
  statuses: string[] | null;
  severities: string[] | null;
  sources: string[] | null;
  flagged: boolean;
  searchTerm: string | null;
  limit: number;
  offset: number;
};

async function handleGrouped(params: GroupedParams) {
  const {
    supabase,
    tenantId,
    developmentId,
    unitId,
    statuses,
    severities,
    sources,
    flagged,
    searchTerm,
    limit,
    offset,
  } = params;

  let matching = supabase
    .from('issue_reports')
    .select(ROW_SELECT)
    .eq('tenant_id', tenantId)
    .not('unit_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(MAX_MATCHING_ROWS);

  if (developmentId) {
    matching = matching.eq('development_id', developmentId);
  }
  if (unitId) {
    matching = matching.eq('unit_id', unitId);
  }
  if (statuses && statuses.length > 0) {
    matching = matching.in('status', statuses);
  }
  if (severities && severities.length > 0) {
    matching = matching.in('severity_label', severities);
  }
  if (sources && sources.length > 0) {
    matching = matching.in('source', sources);
  }
  if (flagged) {
    matching = matching.eq('developer_flagged', true);
  }
  if (searchTerm) {
    matching = matching.ilike('title', `%${escapeIlikePattern(searchTerm)}%`);
  }

  const { data: matchingRowsRaw, error: matchingErr } = await matching;
  if (matchingErr) {
    console.error('[issues-list] grouped_match_failed reason=%s', matchingErr.message);
    return NextResponse.json({ error: 'Could not load issues' }, { status: 500 });
  }
  const matchingRows = (matchingRowsRaw ?? []) as IssueRow[];

  const matchingByUnit = new Map<string, IssueRow[]>();
  for (const r of matchingRows) {
    if (!r.unit_id) continue;
    let bucket = matchingByUnit.get(r.unit_id);
    if (!bucket) {
      bucket = [];
      matchingByUnit.set(r.unit_id, bucket);
    }
    bucket.push(r);
  }
  const unitIdsWithMatches = Array.from(matchingByUnit.keys());

  if (unitIdsWithMatches.length === 0) {
    return NextResponse.json({ units: [], total_units: 0, limit, offset });
  }

  let openStatsQuery = supabase
    .from('issue_reports')
    .select('unit_id, severity_label')
    .eq('tenant_id', tenantId)
    .in('status', ['open', 'reopened'])
    .in('unit_id', unitIdsWithMatches);
  const { data: openStatsRaw, error: openStatsErr } = await openStatsQuery;
  if (openStatsErr) {
    console.error('[issues-list] grouped_open_stats_failed reason=%s', openStatsErr.message);
    return NextResponse.json({ error: 'Could not load issues' }, { status: 500 });
  }
  const openStatsRows = (openStatsRaw ?? []) as Array<{
    unit_id: string | null;
    severity_label: string | null;
  }>;

  type UnitStats = {
    open_count: number;
    urgent_high_count: number;
    worst_severity: string | null;
    has_urgent: boolean;
    has_high: boolean;
  };
  const statsByUnit = new Map<string, UnitStats>();
  for (const id of unitIdsWithMatches) {
    statsByUnit.set(id, {
      open_count: 0,
      urgent_high_count: 0,
      worst_severity: null,
      has_urgent: false,
      has_high: false,
    });
  }
  for (const row of openStatsRows) {
    const uid = row.unit_id;
    if (!uid) continue;
    const s = statsByUnit.get(uid);
    if (!s) continue;
    s.open_count += 1;
    const sev = row.severity_label;
    if (sev === 'urgent' || sev === 'high') {
      s.urgent_high_count += 1;
      if (sev === 'urgent') s.has_urgent = true;
      else s.has_high = true;
    }
    if (sev) {
      const currentRank = s.worst_severity ? SEVERITY_RANK[s.worst_severity] ?? 0 : 0;
      const newRank = SEVERITY_RANK[sev] ?? 0;
      if (newRank > currentRank) s.worst_severity = sev;
    }
  }

  const { data: unitRowsRaw, error: unitErr } = await supabase
    .from('units')
    .select('id, unit_code, unit_number, address_line_1, development_id')
    .in('id', unitIdsWithMatches);
  if (unitErr) {
    console.error('[issues-list] grouped_unit_lookup_failed reason=%s', unitErr.message);
    return NextResponse.json({ error: 'Could not load issues' }, { status: 500 });
  }
  const unitInfoById = new Map<
    string,
    {
      display_name: string;
      development_id: string | null;
    }
  >();
  for (const u of unitRowsRaw ?? []) {
    unitInfoById.set(u.id as string, {
      display_name: deriveUnitDisplayName({
        unit_code: (u.unit_code as string | null) ?? null,
        unit_number: (u.unit_number as string | null) ?? null,
        address_line_1: (u.address_line_1 as string | null) ?? null,
      }),
      development_id: (u.development_id as string | null) ?? null,
    });
  }

  const developmentIds = Array.from(
    new Set(
      Array.from(unitInfoById.values())
        .map((u) => u.development_id)
        .filter((v): v is string => !!v),
    ),
  );
  const developmentsById = new Map<string, { name: string | null }>();
  if (developmentIds.length > 0) {
    const { data: devRows, error: devErr } = await supabase
      .from('developments')
      .select('id, name')
      .in('id', developmentIds);
    if (devErr) {
      console.error('[issues-list] grouped_development_lookup_failed reason=%s', devErr.message);
    } else {
      for (const d of devRows ?? []) {
        developmentsById.set(d.id as string, { name: (d.name as string | null) ?? null });
      }
    }
  }

  // Sprint 3.5a.2: compute latest_escalation_at per issue and per unit
  // so units with a freshly-escalated homeowner issue (within 7 days)
  // sort above all other units.
  const latestEscalationByIssue = await fetchLatestEscalationTimestamps(
    supabase,
    matchingRows,
  );
  const latestEscalationByUnit = new Map<string, string>();
  for (const r of matchingRows) {
    if (!r.unit_id) continue;
    const escAt = latestEscalationByIssue.get(r.id);
    if (!escAt) continue;
    const current = latestEscalationByUnit.get(r.unit_id);
    if (!current || new Date(escAt).getTime() > new Date(current).getTime()) {
      latestEscalationByUnit.set(r.unit_id, escAt);
    }
  }
  const nowMs = Date.now();

  type SortableUnit = {
    unit_id: string;
    unit_display_name: string;
    development_id: string | null;
    development_name: string | null;
    stats: UnitStats;
    latest_escalation_at: string | null;
    fresh: boolean;
  };
  const sortableUnits: SortableUnit[] = unitIdsWithMatches.map((id) => {
    const info = unitInfoById.get(id);
    const display = info?.display_name ?? 'Unit';
    const devId = info?.development_id ?? null;
    const devName = devId ? developmentsById.get(devId)?.name ?? null : null;
    const stats = statsByUnit.get(id) ?? {
      open_count: 0,
      urgent_high_count: 0,
      worst_severity: null,
      has_urgent: false,
      has_high: false,
    };
    const escAt = latestEscalationByUnit.get(id) ?? null;
    return {
      unit_id: id,
      unit_display_name: display,
      development_id: devId,
      development_name: devName,
      stats,
      latest_escalation_at: escAt,
      fresh: isFreshlyEscalated(escAt, nowMs),
    };
  });

  sortableUnits.sort((a, b) => {
    if (a.fresh && b.fresh) {
      const ta = new Date(a.latest_escalation_at as string).getTime();
      const tb = new Date(b.latest_escalation_at as string).getTime();
      if (tb !== ta) return tb - ta;
    } else if (a.fresh) {
      return -1;
    } else if (b.fresh) {
      return 1;
    }
    const tierA = a.stats.has_urgent ? 0 : a.stats.has_high ? 1 : 2;
    const tierB = b.stats.has_urgent ? 0 : b.stats.has_high ? 1 : 2;
    if (tierA !== tierB) return tierA - tierB;
    if (a.stats.open_count !== b.stats.open_count) {
      return b.stats.open_count - a.stats.open_count;
    }
    return a.unit_display_name.localeCompare(b.unit_display_name);
  });

  const totalUnits = sortableUnits.length;
  const paginated = sortableUnits.slice(offset, offset + limit);

  const topIssueIds: string[] = [];
  const topRowsByUnit = new Map<string, IssueRow[]>();
  for (const u of paginated) {
    const all = matchingByUnit.get(u.unit_id) ?? [];
    const top = all.slice(0, TOP_ISSUES_PER_UNIT);
    topRowsByUnit.set(u.unit_id, top);
    for (const r of top) topIssueIds.push(r.id);
  }

  const { mediaCounts, noteCounts } = await fetchAuxCounts(supabase, topIssueIds);

  const units = paginated.map((u) => {
    const topRows = topRowsByUnit.get(u.unit_id) ?? [];
    return {
      unit_id: u.unit_id,
      unit_display_name: u.unit_display_name,
      development_id: u.development_id,
      development_name: u.development_name,
      open_count: u.stats.open_count,
      urgent_high_count: u.stats.urgent_high_count,
      worst_severity: u.stats.worst_severity,
      latest_escalation_at: u.latest_escalation_at,
      issues: topRows.map((r) => {
        const escAt = latestEscalationByIssue.get(r.id) ?? null;
        return buildResponseRow(
          r,
          u.unit_display_name,
          u.development_name,
          mediaCounts.get(r.id) ?? 0,
          noteCounts.get(r.id) ?? 0,
          isNewlyEscalated(escAt, nowMs),
          escAt,
        );
      }),
    };
  });

  return NextResponse.json({
    units,
    total_units: totalUnits,
    limit,
    offset,
  });
}

async function fetchAuxCounts(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  issueIds: string[],
): Promise<{ mediaCounts: Map<string, number>; noteCounts: Map<string, number> }> {
  const mediaCounts = new Map<string, number>();
  const noteCounts = new Map<string, number>();
  if (issueIds.length === 0) {
    return { mediaCounts, noteCounts };
  }
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
  return { mediaCounts, noteCounts };
}
