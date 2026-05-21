/**
 * POST /api/snag/create
 *
 * Assistant V2 Sprint 2. The main builder-side snag creation route.
 * A site team member or accepted external snagger logs a snag with one
 * or more photos attached.
 *
 * Spec: docs/specs/assistant-v2-sprint-2.md section 5.3.
 *
 * Flow:
 *   1. Verify caller's identity and active membership via resolveSnagAuth.
 *   2. Validate body shape and the development_id / unit_id / media_ids
 *      payload.
 *   3. Verify development_id belongs to caller's tenant and (for
 *      snagger_external) is in their development_ids array.
 *   4. Verify unit_id belongs to same tenant and same development.
 *   5. Verify every media_id belongs to caller's tenant.
 *   6. Insert issue_reports with source, logged_by_user_id, logged_by_role.
 *   7. Insert issue_report_media rows linking each media to the issue.
 *   8. Insert one issue_events row with event_type 'snag_logged'.
 *   9. Fire-and-forget POST to /api/snag/enrich/[issue_report_id] so
 *      assistant_media_analysis runs asynchronously.
 *  10. Return the new issue_report_id immediately.
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
export const maxDuration = 30;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_MEDIA_PER_SNAG = 6;
const MAX_TITLE_LEN = 200;
const MAX_DESCRIPTION_LEN = 4000;
const MAX_ROOM_LEN = 120;

interface CreateBody {
  development_id?: unknown;
  unit_id?: unknown;
  title?: unknown;
  description?: unknown;
  room?: unknown;
  media_ids?: unknown;
}

function isUuidArray(v: unknown): v is string[] {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    v.every((s) => typeof s === 'string' && UUID_RE.test(s))
  );
}

function resolveOrigin(request: NextRequest): string {
  const host = request.headers.get('host');
  if (host) {
    const proto = request.headers.get('x-forwarded-proto') ?? 'https';
    return `${proto}://${host}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'http://localhost:3000';
}

/**
 * Fire-and-forget. Never throws into the request handler. If the
 * INTERNAL_ENRICHMENT_KEY is unset the call is skipped with a single
 * warning so local dev still works.
 */
function triggerEnrichment(request: NextRequest, issueReportId: string): void {
  const internalKey = process.env.INTERNAL_ENRICHMENT_KEY;
  if (!internalKey) {
    console.warn(
      '[snag-create] enrichment_skipped reason=INTERNAL_ENRICHMENT_KEY_unset issue=%s',
      issueReportId,
    );
    return;
  }

  const origin = resolveOrigin(request);
  const url = `${origin}/api/snag/enrich/${encodeURIComponent(issueReportId)}`;

  try {
    void fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-key': internalKey,
      },
      body: JSON.stringify({}),
    }).catch((err) => {
      console.warn(
        '[snag-create] enrichment_fetch_rejected issue=%s reason=%s',
        issueReportId,
        err instanceof Error ? err.message : String(err),
      );
    });
  } catch (err) {
    console.warn(
      '[snag-create] enrichment_fetch_threw issue=%s reason=%s',
      issueReportId,
      err instanceof Error ? err.message : String(err),
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isBuilderSnagAppEnabled()) {
    return snagFeatureDisabledResponse();
  }

  let body: CreateBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const developmentId = typeof body.development_id === 'string' ? body.development_id : '';
  const unitId = typeof body.unit_id === 'string' ? body.unit_id : '';
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const room = typeof body.room === 'string' ? body.room.trim() : '';

  if (!UUID_RE.test(developmentId)) {
    return NextResponse.json({ error: 'development_id must be a uuid' }, { status: 400 });
  }
  if (!UUID_RE.test(unitId)) {
    return NextResponse.json({ error: 'unit_id must be a uuid' }, { status: 400 });
  }
  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }
  if (title.length > MAX_TITLE_LEN) {
    return NextResponse.json({ error: 'title is too long' }, { status: 400 });
  }
  if (description.length > MAX_DESCRIPTION_LEN) {
    return NextResponse.json({ error: 'description is too long' }, { status: 400 });
  }
  if (room.length > MAX_ROOM_LEN) {
    return NextResponse.json({ error: 'room is too long' }, { status: 400 });
  }
  if (!isUuidArray(body.media_ids)) {
    return NextResponse.json({ error: 'media_ids must be a non-empty array of uuids' }, { status: 400 });
  }
  const mediaIds = Array.from(new Set(body.media_ids));
  if (mediaIds.length > MAX_MEDIA_PER_SNAG) {
    return NextResponse.json(
      { error: `You can attach up to ${MAX_MEDIA_PER_SNAG} photos per snag.` },
      { status: 400 },
    );
  }

  let auth;
  try {
    auth = await resolveSnagAuth(request);
    assertCanAccessDevelopment(auth, developmentId);
  } catch (err) {
    if (err instanceof SnagAuthError) return snagAuthErrorToResponse(err);
    throw err;
  }

  const supabase = getSupabaseAdmin();

  const { data: development, error: devErr } = await supabase
    .from('developments')
    .select('id, tenant_id')
    .eq('id', developmentId)
    .maybeSingle();
  if (devErr) {
    console.error('[snag-create] development_lookup_failed reason=%s', devErr.message);
    return NextResponse.json({ error: 'Could not load development' }, { status: 500 });
  }
  if (!development || development.tenant_id !== auth.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: unit, error: unitErr } = await supabase
    .from('units')
    .select('id, tenant_id, development_id')
    .eq('id', unitId)
    .maybeSingle();
  if (unitErr) {
    console.error('[snag-create] unit_lookup_failed reason=%s', unitErr.message);
    return NextResponse.json({ error: 'Could not load unit' }, { status: 500 });
  }
  if (!unit) {
    return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
  }
  if (unit.tenant_id !== auth.tenantId || unit.development_id !== developmentId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: mediaRows, error: mediaErr } = await supabase
    .from('assistant_media')
    .select('id, tenant_id, unit_id')
    .in('id', mediaIds);
  if (mediaErr) {
    console.error('[snag-create] media_lookup_failed reason=%s', mediaErr.message);
    return NextResponse.json({ error: 'Could not load media' }, { status: 500 });
  }
  if (!mediaRows || mediaRows.length !== mediaIds.length) {
    return NextResponse.json({ error: 'One or more media not found' }, { status: 404 });
  }
  for (const m of mediaRows) {
    if (m.tenant_id !== auth.tenantId) {
      console.warn(
        '[snag-create] CROSS_TENANT_MEDIA media_id=%s caller_tenant=%s media_tenant=%s',
        m.id,
        auth.tenantId,
        m.tenant_id,
      );
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const source = auth.role === 'snagger_external' ? 'snagger_external' : 'site_team_snag';

  const { data: issueRow, error: insertErr } = await supabase
    .from('issue_reports')
    .insert({
      tenant_id: auth.tenantId,
      development_id: developmentId,
      unit_id: unitId,
      user_id: auth.userId,
      title,
      description: description || null,
      room: room || null,
      status: 'open',
      priority: 'normal',
      source,
      logged_by_user_id: auth.userId,
      logged_by_role: auth.role,
    })
    .select('id')
    .single();

  if (insertErr || !issueRow) {
    console.error('[snag-create] issue_insert_failed reason=%s', insertErr?.message ?? 'no row');
    return NextResponse.json({ error: 'Could not log snag' }, { status: 500 });
  }

  const issueReportId = issueRow.id as string;

  const mediaJoinRows = mediaIds.map((mediaId) => ({
    tenant_id: auth.tenantId,
    issue_report_id: issueReportId,
    media_id: mediaId,
  }));
  const { error: joinErr } = await supabase.from('issue_report_media').insert(mediaJoinRows);
  if (joinErr) {
    console.error('[snag-create] issue_media_join_failed reason=%s', joinErr.message);
    return NextResponse.json({ error: 'Could not link media to snag' }, { status: 500 });
  }

  const { error: eventErr } = await supabase.from('issue_events').insert({
    tenant_id: auth.tenantId,
    issue_report_id: issueReportId,
    event_type: 'snag_logged',
    actor_type: auth.role,
    actor_id: auth.userId,
    metadata: { source, media_count: mediaIds.length },
  });
  if (eventErr) {
    console.error('[snag-create] event_insert_failed reason=%s', eventErr.message);
  }

  triggerEnrichment(request, issueReportId);

  return NextResponse.json({ issue_report_id: issueReportId });
}
