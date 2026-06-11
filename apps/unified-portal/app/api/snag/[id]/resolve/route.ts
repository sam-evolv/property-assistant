/**
 * POST /api/snag/[id]/resolve
 *
 * Mark-off (de-snag): sets an open snag to resolved, optionally attaching
 * completion photos and a note. The completion evidence lands as
 * issue_report_media rows plus a 'snag_resolved' issue_events entry whose
 * metadata carries the completion media ids — the per-house statement of
 * completion is built from this trail.
 *
 * Body: { media_ids?: string[], note?: string }
 *
 * Auth via snag-auth (admin / site_team / snagger_external scoped to the
 * snag's development). Gated on FEATURE_BUILDER_SNAG_APP.
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
const OPEN_STATUSES = ['open', 'reopened'];
const MAX_COMPLETION_PHOTOS = 6;
const MAX_NOTE_LENGTH = 1000;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!isBuilderSnagAppEnabled()) {
    return snagFeatureDisabledResponse();
  }

  const issueReportId = params.id;
  if (!UUID_RE.test(issueReportId)) {
    return NextResponse.json({ error: 'Invalid snag id' }, { status: 400 });
  }

  let auth;
  try {
    auth = await resolveSnagAuth(request);
  } catch (err) {
    if (err instanceof SnagAuthError) return snagAuthErrorToResponse(err);
    throw err;
  }

  let body: { media_ids?: unknown; note?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // empty body is fine — completion photos are optional
  }
  const mediaIds = Array.isArray(body.media_ids)
    ? body.media_ids.filter((m): m is string => typeof m === 'string' && UUID_RE.test(m)).slice(0, MAX_COMPLETION_PHOTOS)
    : [];
  const note =
    typeof body.note === 'string' && body.note.trim()
      ? body.note.trim().slice(0, MAX_NOTE_LENGTH)
      : null;

  const supabase = getSupabaseAdmin();

  const { data: report, error: loadErr } = await supabase
    .from('issue_reports')
    .select('id, tenant_id, development_id, status')
    .eq('id', issueReportId)
    .maybeSingle();
  if (loadErr) {
    return NextResponse.json({ error: 'Could not load snag' }, { status: 500 });
  }
  if (!report || report.tenant_id !== auth.tenantId) {
    return NextResponse.json({ error: 'Snag not found' }, { status: 404 });
  }
  try {
    assertCanAccessDevelopment(auth, report.development_id);
  } catch (err) {
    if (err instanceof SnagAuthError) return snagAuthErrorToResponse(err);
    throw err;
  }
  if (!OPEN_STATUSES.includes(report.status)) {
    return NextResponse.json({ error: 'This snag is already done' }, { status: 409 });
  }

  // Completion media must belong to this tenant.
  if (mediaIds.length > 0) {
    const { data: media } = await supabase
      .from('assistant_media')
      .select('id, tenant_id')
      .in('id', mediaIds);
    const valid = new Set(
      (media || []).filter((m) => m.tenant_id === auth.tenantId).map((m) => m.id),
    );
    if (valid.size !== mediaIds.length) {
      return NextResponse.json({ error: 'Invalid completion photos' }, { status: 400 });
    }
  }

  const resolvedAt = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from('issue_reports')
    .update({ status: 'resolved', resolved_at: resolvedAt, updated_at: resolvedAt })
    .eq('id', issueReportId)
    .eq('tenant_id', auth.tenantId);
  if (updateErr) {
    return NextResponse.json({ error: 'Could not mark snag done' }, { status: 500 });
  }

  if (mediaIds.length > 0) {
    const { error: joinErr } = await supabase.from('issue_report_media').insert(
      mediaIds.map((mediaId) => ({
        tenant_id: auth.tenantId,
        issue_report_id: issueReportId,
        media_id: mediaId,
      })),
    );
    if (joinErr) {
      console.error('[snag-resolve] completion_media_join_failed reason=%s', joinErr.message);
    }
  }

  const { error: eventErr } = await supabase.from('issue_events').insert({
    tenant_id: auth.tenantId,
    issue_report_id: issueReportId,
    event_type: 'snag_resolved',
    actor_type: auth.role,
    actor_id: auth.userId,
    metadata: {
      completion: true,
      completion_media_ids: mediaIds,
      note,
    },
  });
  if (eventErr) {
    console.error('[snag-resolve] event_insert_failed reason=%s', eventErr.message);
  }

  return NextResponse.json({ success: true, status: 'resolved', resolved_at: resolvedAt });
}
