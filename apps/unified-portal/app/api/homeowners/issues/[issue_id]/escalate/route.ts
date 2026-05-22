/**
 * POST /api/homeowners/issues/[issue_id]/escalate
 *
 * Assistant V2 Sprint 3.5a. Promote a homeowner-raised issue into the
 * operational snag workflow. The source moves to 'homeowner_escalated'
 * (the trail back to the homeowner is preserved) and the status moves
 * to 'open' so the row appears in the regular /developer/issues
 * dashboard and the unit grouped view.
 *
 * Spec: docs/specs/assistant-v2-sprint-3-5a.md section 5.5.
 *
 * Access scoping. admin and site_team only. snagger_external is
 * rejected with 403. The issue's source must be 'homeowner_assistant'
 * (you cannot re-escalate an already-escalated issue).
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
const MAX_NOTE_LEN = 2000;

interface RouteParams {
  params: { issue_id: string };
}

interface EscalateBody {
  note?: unknown;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  if (!isHomeownerIssuesEnabled()) {
    return snagFeatureDisabledResponse();
  }

  const issueReportId = params.issue_id;
  if (!UUID_RE.test(issueReportId)) {
    return NextResponse.json({ error: 'issue_id must be a uuid' }, { status: 400 });
  }

  let payload: EscalateBody;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  let noteText: string | null = null;
  if (payload.note !== undefined && payload.note !== null) {
    if (typeof payload.note !== 'string') {
      return NextResponse.json({ error: 'note must be a string' }, { status: 400 });
    }
    const trimmed = payload.note.trim();
    if (trimmed.length > MAX_NOTE_LEN) {
      return NextResponse.json({ error: 'note is too long' }, { status: 400 });
    }
    if (trimmed.length > 0) {
      noteText = trimmed;
    }
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
    console.error('[homeowners-issues-escalate] lookup_failed reason=%s', reportErr.message);
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

  let noteId: string | null = null;
  if (noteText) {
    const { data: noteRow, error: noteErr } = await supabase
      .from('issue_notes')
      .insert({
        tenant_id: auth.tenantId,
        issue_report_id: issueReportId,
        author_user_id: auth.userId,
        author_role: auth.role,
        body: noteText,
      })
      .select('id')
      .single();
    if (noteErr || !noteRow) {
      console.error(
        '[homeowners-issues-escalate] note_insert_failed reason=%s',
        noteErr?.message ?? 'no row',
      );
      return NextResponse.json({ error: 'Could not save note' }, { status: 500 });
    }
    noteId = noteRow.id as string;
  }

  const nowIso = new Date().toISOString();
  const { data: updated, error: updateErr } = await supabase
    .from('issue_reports')
    .update({
      source: 'homeowner_escalated',
      status: 'open',
      updated_at: nowIso,
    })
    .eq('id', issueReportId)
    .select(
      'id, tenant_id, development_id, unit_id, title, description, room, source, status, priority, severity_label, severity_score, resolution_type, logged_by_role, created_at, updated_at, resolved_at',
    )
    .single();
  if (updateErr || !updated) {
    console.error(
      '[homeowners-issues-escalate] update_failed reason=%s',
      updateErr?.message ?? 'no row',
    );
    return NextResponse.json({ error: 'Could not escalate issue' }, { status: 500 });
  }

  const eventMetadata: Record<string, unknown> = {};
  if (noteId) eventMetadata.note_id = noteId;

  const { error: eventErr } = await supabase.from('issue_events').insert({
    tenant_id: auth.tenantId,
    issue_report_id: issueReportId,
    event_type: 'escalated_from_homeowner',
    actor_type: auth.role,
    actor_id: auth.userId,
    metadata: eventMetadata,
  });
  if (eventErr) {
    console.error('[homeowners-issues-escalate] event_insert_failed reason=%s', eventErr.message);
  }

  return NextResponse.json({ issue: updated, note_id: noteId });
}
