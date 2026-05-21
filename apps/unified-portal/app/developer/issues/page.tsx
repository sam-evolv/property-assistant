/**
 * /developer/issues
 *
 * Assistant V2 Sprint 3. Developer-facing dashboard for snag intelligence.
 * Server component that gates the route on FEATURE_DEVELOPER_DASHBOARD,
 * verifies the caller is admin or site_team via the snag-auth pattern,
 * fetches initial data (overview counts, list, developments) directly
 * via Supabase, and hands off to IssuesDashboardClient for the chips
 * and drawer.
 *
 * Spec: docs/specs/assistant-v2-sprint-3.md section 6.
 */

import { notFound } from 'next/navigation';
import { isDeveloperDashboardEnabled } from '@/lib/feature-flags';
import {
  resolveSnagAuth,
  SnagAuthError,
} from '@/lib/assistant/snag-auth';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { SnagNoAccess } from '../../snag/SnagNoAccess';
import { IssuesDashboardClient } from '@/components/issues/IssuesDashboardClient';
import {
  DashboardInitialData,
  IssueFilters,
  IssueListRow,
  IssueOverviewCounts,
  IssueSeverity,
  IssueSource,
  IssueStatus,
  PAGE_SIZE,
} from '@/components/issues/types';
import { parseFiltersFromSearchParams } from '@/components/issues/filter-url';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function DeveloperIssuesPage({ searchParams }: PageProps) {
  if (!isDeveloperDashboardEnabled()) notFound();

  let auth;
  try {
    auth = await resolveSnagAuth();
  } catch (err) {
    if (err instanceof SnagAuthError) {
      if (err.code === 'unauthenticated') {
        return <SnagNoAccess code="unauthenticated" />;
      }
      notFound();
    }
    throw err;
  }
  if (auth.role === 'snagger_external') notFound();

  const filters = parseFiltersFromSearchParams(searchParams);
  const initial = await loadInitialData(auth.tenantId, filters);

  return <IssuesDashboardClient initial={initial} initialFilters={filters} />;
}

function deriveUnitDisplayName(u: {
  unit_code: string | null;
  unit_number: string | null;
  address_line_1: string | null;
}): string {
  return u.unit_code ?? u.unit_number ?? u.address_line_1 ?? 'Unit';
}

async function loadInitialData(
  tenantId: string,
  filters: IssueFilters,
): Promise<DashboardInitialData> {
  const supabase = getSupabaseAdmin();
  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

  const overviewPromise = Promise.all([
    supabase
      .from('issue_reports')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .in('status', ['open', 'reopened']),
    supabase
      .from('issue_reports')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .in('severity_label', ['high', 'urgent']),
    supabase
      .from('issue_reports')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('created_at', sevenDaysAgo),
    supabase
      .from('issue_reports')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'resolved')
      .gte('resolved_at', thirtyDaysAgo),
  ]);

  const developmentsPromise = supabase
    .from('developments')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .order('name', { ascending: true });

  const [overviewRes, developmentsRes, listResult] = await Promise.all([
    overviewPromise,
    developmentsPromise,
    fetchList(tenantId, filters),
  ]);

  const [openR, highR, weekR, monthR] = overviewRes;
  const overview: IssueOverviewCounts = {
    open: openR.count ?? 0,
    high_priority: highR.count ?? 0,
    new_this_week: weekR.count ?? 0,
    resolved_this_month: monthR.count ?? 0,
  };

  const developments = (developmentsRes.data ?? []).map((d) => ({
    id: d.id as string,
    name: (d.name as string | null) ?? 'Scheme',
  }));

  return {
    overview,
    list: listResult,
    developments,
  };
}

interface ListShape {
  rows: IssueListRow[];
  total: number;
  limit: number;
  offset: number;
}

async function fetchList(tenantId: string, filters: IssueFilters): Promise<ListShape> {
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from('issue_reports')
    .select(
      'id, tenant_id, development_id, unit_id, title, source, severity_label, severity_score, status, priority, room, developer_flagged, logged_by_role, created_at, resolved_at',
      { count: 'exact' },
    )
    .eq('tenant_id', tenantId);

  if (filters.development_id) {
    query = query.eq('development_id', filters.development_id);
  }
  if (filters.status.length > 0) {
    query = query.in('status', filters.status as IssueStatus[]);
  }
  if (filters.severity.length > 0) {
    query = query.in('severity_label', filters.severity as IssueSeverity[]);
  }
  if (filters.source.length > 0) {
    query = query.in('source', filters.source as IssueSource[]);
  }
  if (filters.flagged) {
    query = query.eq('developer_flagged', true);
  }

  if (filters.sort === 'created_at_asc') {
    query = query.order('created_at', { ascending: true });
  } else if (filters.sort === 'severity_desc') {
    query = query
      .order('severity_score', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }
  query = query.range(0, PAGE_SIZE - 1);

  const { data: rowsData, count } = await query;
  const reportRows = rowsData ?? [];
  const issueIds = reportRows.map((r) => r.id as string);
  const unitIds = Array.from(
    new Set(
      reportRows
        .map((r) => r.unit_id as string | null)
        .filter((v): v is string => !!v),
    ),
  );
  const developmentIds = Array.from(
    new Set(reportRows.map((r) => r.development_id as string).filter((v): v is string => !!v)),
  );

  const unitsById = new Map<string, { display_name: string }>();
  if (unitIds.length > 0) {
    const { data } = await supabase
      .from('units')
      .select('id, unit_code, unit_number, address_line_1')
      .in('id', unitIds);
    for (const u of data ?? []) {
      unitsById.set(u.id as string, {
        display_name: deriveUnitDisplayName({
          unit_code: (u.unit_code as string | null) ?? null,
          unit_number: (u.unit_number as string | null) ?? null,
          address_line_1: (u.address_line_1 as string | null) ?? null,
        }),
      });
    }
  }

  const developmentsById = new Map<string, { name: string | null }>();
  if (developmentIds.length > 0) {
    const { data } = await supabase
      .from('developments')
      .select('id, name')
      .in('id', developmentIds);
    for (const d of data ?? []) {
      developmentsById.set(d.id as string, { name: (d.name as string | null) ?? null });
    }
  }

  const mediaCounts = new Map<string, number>();
  const noteCounts = new Map<string, number>();
  if (issueIds.length > 0) {
    const [mediaRes, notesRes] = await Promise.all([
      supabase.from('issue_report_media').select('issue_report_id').in('issue_report_id', issueIds),
      supabase.from('issue_notes').select('issue_report_id').in('issue_report_id', issueIds),
    ]);
    for (const j of mediaRes.data ?? []) {
      const k = j.issue_report_id as string;
      mediaCounts.set(k, (mediaCounts.get(k) ?? 0) + 1);
    }
    for (const j of notesRes.data ?? []) {
      const k = j.issue_report_id as string;
      noteCounts.set(k, (noteCounts.get(k) ?? 0) + 1);
    }
  }

  const rows: IssueListRow[] = reportRows.map((r) => {
    const unitId = r.unit_id as string | null;
    const devId = r.development_id as string;
    const unit = unitId ? unitsById.get(unitId) ?? null : null;
    const dev = developmentsById.get(devId) ?? null;
    return {
      id: r.id as string,
      title: r.title as string,
      source: r.source as IssueSource,
      severity_label: (r.severity_label as IssueSeverity | null) ?? null,
      severity_score: (r.severity_score as number | null) ?? null,
      status: r.status as IssueStatus,
      priority: (r.priority as string | null) ?? null,
      room: (r.room as string | null) ?? null,
      unit_display_name: unit?.display_name ?? null,
      development_name: dev?.name ?? null,
      media_count: mediaCounts.get(r.id as string) ?? 0,
      note_count: noteCounts.get(r.id as string) ?? 0,
      developer_flagged: !!r.developer_flagged,
      created_at: r.created_at as string,
      resolved_at: (r.resolved_at as string | null) ?? null,
      logged_by_role: (r.logged_by_role as string | null) ?? null,
    };
  });

  return {
    rows,
    total: count ?? rows.length,
    limit: PAGE_SIZE,
    offset: 0,
  };
}
