/**
 * POST /api/issues/[id]/flag
 *
 * Assistant V2 Sprint 3. Toggles the developer flag on an issue and
 * appends a flagged or unflagged event to the timeline.
 *
 * Spec: docs/specs/assistant-v2-sprint-3.md section 5.4.
 *
 * When setting developer_flagged to true we also write
 * developer_flagged_at and developer_flagged_by. When toggling off we
 * clear both. An issue_events row is inserted in either case with
 * event_type 'flagged' or 'unflagged'.
 *
 * Access scoping. admin and site_team only. snagger_external is
 * rejected with 403.
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

interface RouteParams {
  params: { id: string };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
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
    .select('id, tenant_id, development_id, developer_flagged')
    .eq('id', issueReportId)
    .maybeSingle();
  if (reportErr) {
    console.error('[issues-flag] lookup_failed reason=%s', reportErr.message);
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

  const currentlyFlagged = !!report.developer_flagged;
  const nextFlagged = !currentlyFlagged;
  const nowIso = new Date().toISOString();

  const { error: updateErr } = await supabase
    .from('issue_reports')
    .update({
      developer_flagged: nextFlagged,
      developer_flagged_at: nextFlagged ? nowIso : null,
      developer_flagged_by: nextFlagged ? auth.userId : null,
      updated_at: nowIso,
    })
    .eq('id', issueReportId);
  if (updateErr) {
    console.error('[issues-flag] update_failed reason=%s', updateErr.message);
    return NextResponse.json({ error: 'Could not update flag' }, { status: 500 });
  }

  const { error: eventErr } = await supabase.from('issue_events').insert({
    tenant_id: auth.tenantId,
    issue_report_id: issueReportId,
    event_type: nextFlagged ? 'flagged' : 'unflagged',
    actor_type: auth.role,
    actor_id: auth.userId,
    metadata: {},
  });
  if (eventErr) {
    console.error('[issues-flag] event_insert_failed reason=%s', eventErr.message);
  }

  return NextResponse.json({
    issue_report_id: issueReportId,
    developer_flagged: nextFlagged,
    developer_flagged_at: nextFlagged ? nowIso : null,
    developer_flagged_by: nextFlagged ? auth.userId : null,
  });
}
