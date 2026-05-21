/**
 * GET /api/issues/[id]
 *
 * Assistant V2 Sprint 3. Full issue detail for the developer dashboard
 * drawer and standalone page.
 *
 * Spec: docs/specs/assistant-v2-sprint-3.md section 5.3.
 *
 * Returns:
 *   - the issue row with unit display_name and development name joined
 *   - media with one-hour signed URLs (and thumbnails)
 *   - the linked assistant_media_analysis row, or null
 *   - the full event timeline from issue_events, ordered ascending
 *   - all notes from issue_notes, ordered descending, with author emails
 *
 * Access scoping. The caller must access the issue's development under
 * their site_team_members membership. snagger_external is rejected with
 * 403 before any DB lookup.
 *
 * Gated on FEATURE_DEVELOPER_DASHBOARD.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { isDeveloperDashboardEnabled } from '@/lib/feature-flags';
import {
  resolveSnagAuth,
  assertCanAccessDevelopment,
  snagAuthErrorToResponse,
  snagFeatureDisabledResponse,
  SnagAuthError,
} from '@/lib/assistant/snag-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const BUCKET = 'assistant-media';

interface RouteParams {
  params: { id: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  if (!isDeveloperDashboardEnabled()) {
    return snagFeatureDisabledResponse();
  }

  const issueReportId = params.id;
  if (!UUID_RE.test(issueReportId)) {
    return NextResponse.json({ error: 'id must be a uuid' }, { status: 400 });
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

  const supabase = getSupabaseAdmin();

  const { data: report, error: reportErr } = await supabase
    .from('issue_reports')
    .select(
      'id, tenant_id, development_id, unit_id, user_id, title, description, room, status, priority, severity_label, severity_score, safety_risk, likely_trade, likely_system, source, logged_by_user_id, logged_by_role, linked_analysis_id, developer_flagged, developer_flagged_at, developer_flagged_by, created_at, updated_at, resolved_at',
    )
    .eq('id', issueReportId)
    .maybeSingle();

  if (reportErr) {
    console.error('[issues-detail] lookup_failed reason=%s', reportErr.message);
    return NextResponse.json({ error: 'Could not load issue' }, { status: 500 });
  }
  if (!report) {
    return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
  }
  if (report.tenant_id !== auth.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    assertCanAccessDevelopment(auth, report.development_id as string);
  } catch (err) {
    if (err instanceof SnagAuthError) return snagAuthErrorToResponse(err);
    throw err;
  }

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
  if (unitRes.error) {
    console.error('[issues-detail] unit_lookup_failed reason=%s', unitRes.error.message);
  }
  if (devRes.error) {
    console.error('[issues-detail] development_lookup_failed reason=%s', devRes.error.message);
  }

  const unitRow = unitRes.data;
  const unitDisplayName = unitRow
    ? ((unitRow.unit_code as string | null) ??
      (unitRow.unit_number as string | null) ??
      (unitRow.address_line_1 as string | null) ??
      'Unit')
    : null;
  const developmentName = devRes.data ? ((devRes.data.name as string | null) ?? null) : null;

  const { data: joinRows, error: joinErr } = await supabase
    .from('issue_report_media')
    .select('media_id')
    .eq('issue_report_id', issueReportId);
  if (joinErr) {
    console.error('[issues-detail] join_lookup_failed reason=%s', joinErr.message);
    return NextResponse.json({ error: 'Could not load media' }, { status: 500 });
  }
  const mediaIds = (joinRows ?? []).map((j) => j.media_id as string);
  let mediaPayload: Array<{
    id: string;
    storage_path: string;
    thumbnail_path: string | null;
    mime_type: string;
    width: number | null;
    height: number | null;
    signed_url: string;
    thumbnail_url: string;
    expires_at: string;
  }> = [];

  if (mediaIds.length > 0) {
    const { data: mediaRows, error: mediaErr } = await supabase
      .from('assistant_media')
      .select('id, tenant_id, storage_path, thumbnail_path, mime_type, width, height')
      .in('id', mediaIds);
    if (mediaErr) {
      console.error('[issues-detail] media_lookup_failed reason=%s', mediaErr.message);
      return NextResponse.json({ error: 'Could not load media' }, { status: 500 });
    }
    const expiresIso = new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString();
    for (const m of mediaRows ?? []) {
      if (m.tenant_id !== auth.tenantId) continue;
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

  let analysis: Record<string, unknown> | null = null;
  const linkedAnalysisId = report.linked_analysis_id as string | null;
  if (linkedAnalysisId) {
    const { data: analysisRow, error: analysisErr } = await supabase
      .from('assistant_media_analysis')
      .select('*')
      .eq('id', linkedAnalysisId)
      .maybeSingle();
    if (analysisErr) {
      console.error('[issues-detail] analysis_lookup_failed reason=%s', analysisErr.message);
    } else if (analysisRow) {
      analysis = analysisRow as Record<string, unknown>;
    }
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
  if (eventsRes.error) {
    console.error('[issues-detail] events_lookup_failed reason=%s', eventsRes.error.message);
  }
  if (notesRes.error) {
    console.error('[issues-detail] notes_lookup_failed reason=%s', notesRes.error.message);
  }
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

  return NextResponse.json({
    report: {
      ...report,
      unit_display_name: unitDisplayName,
      development_name: developmentName,
    },
    media: mediaPayload,
    analysis,
    events: events.map((e) => ({
      id: e.id,
      event_type: e.event_type,
      actor_type: e.actor_type,
      actor_id: e.actor_id,
      actor_email: e.actor_id ? emailByUserId.get(e.actor_id as string) ?? null : null,
      metadata: e.metadata,
      created_at: e.created_at,
    })),
    notes: notes.map((n) => ({
      id: n.id,
      author_user_id: n.author_user_id,
      author_role: n.author_role,
      author_email: emailByUserId.get(n.author_user_id as string) ?? null,
      body: n.body,
      created_at: n.created_at,
    })),
  });
}
