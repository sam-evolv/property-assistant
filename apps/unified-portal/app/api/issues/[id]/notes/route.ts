/**
 * POST /api/issues/[id]/notes
 *
 * Assistant V2 Sprint 3. Append a note to an issue and record a
 * note_added event on the timeline.
 *
 * Spec: docs/specs/assistant-v2-sprint-3.md section 5.5.
 *
 * Unlike the other dashboard routes, this one allows ALL authenticated
 * roles including snagger_external. Notes are context, not status
 * mutations, so a snagger can leave a note from the snagger-side surface
 * even if they cannot open the dashboard.
 *
 * Body must be non-empty and at most 2000 chars. The note insert and the
 * issue_events insert are recorded with the caller's role and user id.
 * The event metadata includes the new note_id for the timeline.
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
const MAX_NOTE_LEN = 2000;

interface RouteParams {
  params: { id: string };
}

interface NoteBody {
  body?: unknown;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  if (!isDeveloperDashboardEnabled()) {
    return snagFeatureDisabledResponse();
  }

  const issueReportId = params.id;
  if (!UUID_RE.test(issueReportId)) {
    return NextResponse.json({ error: 'id must be a uuid' }, { status: 400 });
  }

  let payload: NoteBody;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const rawBody = typeof payload.body === 'string' ? payload.body.trim() : '';
  if (!rawBody) {
    return NextResponse.json({ error: 'body is required' }, { status: 400 });
  }
  if (rawBody.length > MAX_NOTE_LEN) {
    return NextResponse.json({ error: 'body is too long' }, { status: 400 });
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
    .select('id, tenant_id, development_id')
    .eq('id', issueReportId)
    .maybeSingle();
  if (reportErr) {
    console.error('[issues-notes] lookup_failed reason=%s', reportErr.message);
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

  const { data: noteRow, error: insertErr } = await supabase
    .from('issue_notes')
    .insert({
      tenant_id: auth.tenantId,
      issue_report_id: issueReportId,
      author_user_id: auth.userId,
      author_role: auth.role,
      body: rawBody,
    })
    .select('id, tenant_id, issue_report_id, author_user_id, author_role, body, created_at')
    .single();
  if (insertErr || !noteRow) {
    console.error('[issues-notes] insert_failed reason=%s', insertErr?.message ?? 'no row');
    return NextResponse.json({ error: 'Could not save note' }, { status: 500 });
  }

  const { error: eventErr } = await supabase.from('issue_events').insert({
    tenant_id: auth.tenantId,
    issue_report_id: issueReportId,
    event_type: 'note_added',
    actor_type: auth.role,
    actor_id: auth.userId,
    metadata: { note_id: noteRow.id },
  });
  if (eventErr) {
    console.error('[issues-notes] event_insert_failed reason=%s', eventErr.message);
  }

  return NextResponse.json({ note: noteRow });
}
