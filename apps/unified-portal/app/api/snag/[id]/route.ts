/**
 * GET /api/snag/[id]
 *
 * Assistant V2 Sprint 2. Returns a single snag with its linked media
 * (one-hour signed URLs) and the full event timeline.
 *
 * Spec: docs/specs/assistant-v2-sprint-2.md section 5.5.
 *
 * Caller must be able to access the report's development_id under their
 * site_team_members membership; cross-tenant or out-of-scope reports
 * surface as 403.
 *
 * Gated on FEATURE_BUILDER_SNAG_APP.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { isBuilderSnagAppEnabled } from '@/lib/feature-flags';
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
  if (!isBuilderSnagAppEnabled()) {
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

  const supabase = getSupabaseAdmin();

  const { data: report, error: reportErr } = await supabase
    .from('issue_reports')
    .select(
      'id, tenant_id, development_id, unit_id, user_id, title, description, room, status, priority, severity_label, severity_score, safety_risk, likely_trade, likely_system, source, logged_by_user_id, logged_by_role, linked_analysis_id, created_at, updated_at',
    )
    .eq('id', issueReportId)
    .maybeSingle();

  if (reportErr) {
    console.error('[snag-detail] lookup_failed reason=%s', reportErr.message);
    return NextResponse.json({ error: 'Could not load snag' }, { status: 500 });
  }
  if (!report) {
    return NextResponse.json({ error: 'Snag not found' }, { status: 404 });
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

  const { data: joinRows, error: joinErr } = await supabase
    .from('issue_report_media')
    .select('media_id')
    .eq('issue_report_id', issueReportId);
  if (joinErr) {
    console.error('[snag-detail] join_lookup_failed reason=%s', joinErr.message);
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
      console.error('[snag-detail] media_lookup_failed reason=%s', mediaErr.message);
      return NextResponse.json({ error: 'Could not load media' }, { status: 500 });
    }

    const expiresIso = new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString();
    for (const m of mediaRows ?? []) {
      if (m.tenant_id !== auth.tenantId) {
        continue;
      }
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

  const { data: events, error: eventsErr } = await supabase
    .from('issue_events')
    .select('id, event_type, actor_type, actor_id, metadata, created_at')
    .eq('issue_report_id', issueReportId)
    .order('created_at', { ascending: true });
  if (eventsErr) {
    console.error('[snag-detail] events_lookup_failed reason=%s', eventsErr.message);
  }

  return NextResponse.json({
    report,
    media: mediaPayload,
    events: events ?? [],
  });
}
