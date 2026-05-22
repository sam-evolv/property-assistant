/**
 * POST /api/homeowners/issues/[issue_id]/resolve
 *
 * Assistant V2 Sprint 3.5a. The reply-and-resolve action for an
 * unescalated homeowner-raised issue. The site team writes a reply,
 * the reply is stored as an issue_notes row, and the issue moves to
 * resolved with resolution_type='direct_reply'.
 *
 * Spec: docs/specs/assistant-v2-sprint-3-5a.md section 5.4.
 *
 * In V1 the reply is captured as a note but not sent back to the
 * homeowner. Sprint 1b will add the messaging loop; this route's
 * shape stays the same when that happens, the UI just gains the
 * delivery affordance.
 *
 * Access scoping. admin and site_team only. snagger_external is
 * rejected with 403. The issue's source must be 'homeowner_assistant'
 * (escalated and snagger-side issues use different routes).
 *
 * Gated on FEATURE_HOMEOWNER_ISSUES.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { isHomeownerIssuesEnabled } from '@/lib/feature-flags';
import {
  resolveSnagAuth,
  snagAuthErrorToResponse,
  snagFeatureDisabledResponse,
  SnagAuthError,
} from '@/lib/assistant/snag-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_REPLY_LEN = 2000;

interface RouteParams {
  params: { issue_id: string };
}

interface ResolveBody {
  reply_body?: unknown;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  if (!isHomeownerIssuesEnabled()) {
    return snagFeatureDisabledResponse();
  }

  const issueReportId = params.issue_id;
  if (!UUID_RE.test(issueReportId)) {
    return NextResponse.json({ error: 'issue_id must be a uuid' }, { status: 400 });
  }

  let payload: ResolveBody;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const replyBody = typeof payload.reply_body === 'string' ? payload.reply_body.trim() : '';
  if (!replyBody) {
    return NextResponse.json({ error: 'reply_body is required' }, { status: 400 });
  }
  if (replyBody.length > MAX_REPLY_LEN) {
    return NextResponse.json({ error: 'reply_body is too long' }, { status: 400 });
  }

  let auth;
  try {
    auth = await resolveSnagAuth(request);
  } catch (err) {
    if (err instanceof SnagAuthError) return snagAuthErrorToResponse(err);
    throw err;
  }
  if (auth.role !== 'admin' && auth.role !== 'site_team') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();

  const { data: report, error: reportErr } = await supabase
    .from('issue_reports')
    .select('id, tenant_id, source, status')
    .eq('id', issueReportId)
    .maybeSingle();
  if (reportErr) {
    console.error('[homeowners-issues-resolve] lookup_failed reason=%s', reportErr.message);
    return NextResponse.json({ error: 'Could not load issue' }, { status: 500 });
  }
  if (!report) {
    return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
  }
  if (report.tenant_id !== auth.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (report.source !== 'homeowner_assistant') {
    return NextResponse.json(
      { error: 'This action only applies to unescalated homeowner issues.' },
      { status: 400 },
    );
  }

  const { data: noteRow, error: noteErr } = await supabase
    .from('issue_notes')
    .insert({
      tenant_id: auth.tenantId,
      issue_report_id: issueReportId,
      author_user_id: auth.userId,
      author_role: auth.role,
      body: replyBody,
    })
    .select('id')
    .single();
  if (noteErr || !noteRow) {
    console.error(
      '[homeowners-issues-resolve] note_insert_failed reason=%s',
      noteErr?.message ?? 'no row',
    );
    return NextResponse.json({ error: 'Could not save reply' }, { status: 500 });
  }

  const nowIso = new Date().toISOString();
  const { data: updated, error: updateErr } = await supabase
    .from('issue_reports')
    .update({
      status: 'resolved',
      resolution_type: 'direct_reply',
      resolved_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', issueReportId)
    .select(
      'id, tenant_id, development_id, unit_id, title, description, room, source, status, priority, severity_label, severity_score, resolution_type, logged_by_role, created_at, updated_at, resolved_at',
    )
    .single();
  if (updateErr || !updated) {
    console.error(
      '[homeowners-issues-resolve] update_failed reason=%s',
      updateErr?.message ?? 'no row',
    );
    return NextResponse.json({ error: 'Could not resolve issue' }, { status: 500 });
  }

  const { error: eventErr } = await supabase.from('issue_events').insert({
    tenant_id: auth.tenantId,
    issue_report_id: issueReportId,
    event_type: 'resolved_by_reply',
    actor_type: auth.role,
    actor_id: auth.userId,
    metadata: { resolution_type: 'direct_reply', note_id: noteRow.id },
  });
  if (eventErr) {
    console.error('[homeowners-issues-resolve] event_insert_failed reason=%s', eventErr.message);
  }

  return NextResponse.json({ issue: updated, note_id: noteRow.id });
}
