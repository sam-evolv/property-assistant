/**
 * /developer/issues/[id]
 *
 * Assistant V2 Sprint 3. Server-rendered standalone detail page for an
 * issue. Same shared component as the drawer renders the body so a
 * link copied from the drawer's menu opens the identical view as a
 * full page.
 *
 * Spec: docs/specs/assistant-v2-sprint-3.md section 6.6.
 *
 * Gates on FEATURE_DEVELOPER_DASHBOARD (404 when off). Verifies the
 * caller is admin or site_team via snag-auth. snagger_external sees
 * 404. Resolves all data server-side (issue, media with signed URLs,
 * analysis, events, notes) and hands off to IssueStandalonePageClient
 * which wraps the shared content with a header (back link, flag
 * toggle, copy-link menu) and provides URL refresh after flag toggles.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { isDeveloperDashboardEnabled } from '@/lib/feature-flags';
import {
  resolveSnagAuth,
  assertCanAccessDevelopment,
  SnagAuthError,
} from '@/lib/assistant/snag-auth';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { SnagNoAccess } from '../../../snag/SnagNoAccess';
import { IssueStandaloneClient } from './IssueStandaloneClient';
import {
  IssueAnalysis,
  IssueDetailResponse,
  IssueEvent,
  IssueMedia,
  IssueNote,
  IssueReport,
  IssueSeverity,
  IssueSource,
  IssueStatus,
} from '@/components/issues/types';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const BUCKET = 'assistant-media';

interface PageProps {
  params: { id: string };
}

export default async function DeveloperIssueDetailPage({ params }: PageProps) {
  if (!isDeveloperDashboardEnabled()) notFound();
  if (!UUID_RE.test(params.id)) notFound();

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

  const detail = await loadDetail(params.id, auth.tenantId);
  if (!detail) notFound();

  try {
    assertCanAccessDevelopment(auth, detail.report.development_id);
  } catch {
    notFound();
  }

  return (
    <div className="min-h-screen">
      <header className="px-6 py-4 border-b border-neutral-200 bg-white flex items-center gap-2">
        <Link
          href="/developer/issues"
          className="inline-flex items-center gap-1 text-body-sm text-neutral-700 hover:text-neutral-900 px-2 py-1 -ml-2 rounded-md hover:bg-neutral-100"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to issues
        </Link>
      </header>
      <main className="px-6 py-6 max-w-3xl mx-auto">
        <IssueStandaloneClient initialDetail={detail} />
      </main>
    </div>
  );
}

async function loadDetail(
  issueReportId: string,
  tenantId: string,
): Promise<IssueDetailResponse | null> {
  const supabase = getSupabaseAdmin();

  const { data: report } = await supabase
    .from('issue_reports')
    .select(
      'id, tenant_id, development_id, unit_id, user_id, title, description, room, status, priority, severity_label, severity_score, safety_risk, likely_trade, likely_system, source, logged_by_user_id, logged_by_role, linked_analysis_id, developer_flagged, developer_flagged_at, developer_flagged_by, created_at, updated_at, resolved_at',
    )
    .eq('id', issueReportId)
    .maybeSingle();

  if (!report || report.tenant_id !== tenantId) return null;

  const unitId = report.unit_id as string | null;
  const developmentId = report.development_id as string;

  const [unitRes, devRes] = await Promise.all([
    unitId
      ? supabase
          .from('units')
          .select('id, unit_code, unit_number, address_line_1')
          .eq('id', unitId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from('developments').select('id, name').eq('id', developmentId).maybeSingle(),
  ]);
  const unitRow = unitRes.data;
  const unitDisplayName = unitRow
    ? ((unitRow.unit_code as string | null) ??
      (unitRow.unit_number as string | null) ??
      (unitRow.address_line_1 as string | null) ??
      'Unit')
    : null;
  const developmentName = devRes.data ? ((devRes.data.name as string | null) ?? null) : null;

  const { data: joinRows } = await supabase
    .from('issue_report_media')
    .select('media_id')
    .eq('issue_report_id', issueReportId);
  const mediaIds = (joinRows ?? []).map((j) => j.media_id as string);

  const mediaPayload: IssueMedia[] = [];
  if (mediaIds.length > 0) {
    const { data: mediaRows } = await supabase
      .from('assistant_media')
      .select('id, tenant_id, storage_path, thumbnail_path, mime_type, width, height')
      .in('id', mediaIds);
    const expiresIso = new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString();
    for (const m of mediaRows ?? []) {
      if (m.tenant_id !== tenantId) continue;
      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(m.storage_path as string, SIGNED_URL_TTL_SECONDS);
      let thumbUrl = signed?.signedUrl ?? '';
      if (m.thumbnail_path) {
        const { data: thumbSigned } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(m.thumbnail_path as string, SIGNED_URL_TTL_SECONDS);
        if (thumbSigned?.signedUrl) thumbUrl = thumbSigned.signedUrl;
      }
      mediaPayload.push({
        id: m.id as string,
        storage_path: m.storage_path as string,
        thumbnail_path: (m.thumbnail_path as string | null) ?? null,
        mime_type: m.mime_type as string,
        width: (m.width as number | null) ?? null,
        height: (m.height as number | null) ?? null,
        signed_url: signed?.signedUrl ?? '',
        thumbnail_url: thumbUrl,
        expires_at: expiresIso,
      });
    }
  }

  let analysis: IssueAnalysis | null = null;
  const linkedAnalysisId = report.linked_analysis_id as string | null;
  if (linkedAnalysisId) {
    const { data: analysisRow } = await supabase
      .from('assistant_media_analysis')
      .select('*')
      .eq('id', linkedAnalysisId)
      .maybeSingle();
    if (analysisRow) analysis = analysisRow as IssueAnalysis;
  }

  const [eventsRes, notesRes] = await Promise.all([
    supabase
      .from('issue_events')
      .select('id, event_type, actor_type, actor_id, metadata, created_at')
      .eq('issue_report_id', issueReportId)
      .order('created_at', { ascending: true }),
    supabase
      .from('issue_notes')
      .select('id, author_user_id, author_role, body, created_at')
      .eq('issue_report_id', issueReportId)
      .order('created_at', { ascending: false }),
  ]);
  const events = eventsRes.data ?? [];
  const notes = notesRes.data ?? [];

  const userIds = new Set<string>();
  for (const e of events) {
    const aid = e.actor_id as string | null;
    if (aid) userIds.add(aid);
  }
  for (const n of notes) {
    const aid = n.author_user_id as string | null;
    if (aid) userIds.add(aid);
  }
  const emailByUserId = new Map<string, string>();
  for (const id of userIds) {
    const { data: u } = await supabase.auth.admin.getUserById(id);
    if (u?.user?.email) emailByUserId.set(id, u.user.email);
  }

  const reportPayload: IssueReport = {
    id: report.id as string,
    tenant_id: report.tenant_id as string,
    development_id: report.development_id as string,
    unit_id: (report.unit_id as string | null) ?? null,
    user_id: (report.user_id as string | null) ?? null,
    title: report.title as string,
    description: (report.description as string | null) ?? null,
    room: (report.room as string | null) ?? null,
    status: report.status as IssueStatus,
    priority: (report.priority as string | null) ?? null,
    severity_label: (report.severity_label as IssueSeverity | null) ?? null,
    severity_score: (report.severity_score as number | null) ?? null,
    safety_risk: (report.safety_risk as string | null) ?? null,
    likely_trade: (report.likely_trade as string | null) ?? null,
    likely_system: (report.likely_system as string | null) ?? null,
    source: report.source as IssueSource,
    logged_by_user_id: (report.logged_by_user_id as string | null) ?? null,
    logged_by_role: (report.logged_by_role as string | null) ?? null,
    linked_analysis_id: (report.linked_analysis_id as string | null) ?? null,
    developer_flagged: !!report.developer_flagged,
    developer_flagged_at: (report.developer_flagged_at as string | null) ?? null,
    developer_flagged_by: (report.developer_flagged_by as string | null) ?? null,
    created_at: report.created_at as string,
    updated_at: (report.updated_at as string | null) ?? null,
    resolved_at: (report.resolved_at as string | null) ?? null,
    unit_display_name: unitDisplayName,
    development_name: developmentName,
  };

  const eventsPayload: IssueEvent[] = events.map((e) => ({
    id: e.id as string,
    event_type: e.event_type as string,
    actor_type: (e.actor_type as string | null) ?? null,
    actor_id: (e.actor_id as string | null) ?? null,
    actor_email: e.actor_id ? emailByUserId.get(e.actor_id as string) ?? null : null,
    metadata: (e.metadata as Record<string, unknown> | null) ?? null,
    created_at: e.created_at as string,
  }));

  const notesPayload: IssueNote[] = notes.map((n) => ({
    id: n.id as string,
    author_user_id: n.author_user_id as string,
    author_role: n.author_role as string,
    author_email: emailByUserId.get(n.author_user_id as string) ?? null,
    body: n.body as string,
    created_at: n.created_at as string,
  }));

  return {
    report: reportPayload,
    media: mediaPayload,
    analysis,
    events: eventsPayload,
    notes: notesPayload,
  };
}
