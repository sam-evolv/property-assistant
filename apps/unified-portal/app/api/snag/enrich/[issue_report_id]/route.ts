/**
 * POST /api/snag/enrich/[issue_report_id]
 *
 * Assistant V2 Sprint 2. Internal-only enrichment route. Called as a
 * fire-and-forget fetch from /api/snag/create immediately after the
 * snag is persisted.
 *
 * Spec: docs/specs/assistant-v2-sprint-2.md section 6.
 *
 * Auth. Two acceptable proofs:
 *   - x-internal-key header matching process.env.INTERNAL_ENRICHMENT_KEY
 *   - Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
 *
 * On a Sprint 1 placeholder, mediaAnalysisService.analyse persists a
 * neutral assistant_media_analysis row. This route additionally links
 * that row back to the issue via issue_reports.linked_analysis_id and
 * appends an issue_events row with event_type 'analysis_completed' so
 * the timeline reflects the enrichment.
 *
 * When the real model lands in Sprint 1b, mediaAnalysisService.analyse
 * is swapped in place. This route does not change.
 *
 * Gated on FEATURE_BUILDER_SNAG_APP.
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID, timingSafeEqual } from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { isBuilderSnagAppEnabled } from '@/lib/feature-flags';
import { snagFeatureDisabledResponse } from '@/lib/assistant/snag-auth';
import { analyse } from '@/lib/assistant/mediaAnalysisService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RouteParams {
  params: { issue_report_id: string };
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function isInternalCaller(request: NextRequest): boolean {
  const internalKey = process.env.INTERNAL_ENRICHMENT_KEY;
  const headerKey = request.headers.get('x-internal-key');
  if (internalKey && headerKey && safeEqual(headerKey, internalKey)) {
    return true;
  }
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice(7);
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceKey && safeEqual(token, serviceKey)) {
      return true;
    }
  }
  return false;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  if (!isBuilderSnagAppEnabled()) {
    return snagFeatureDisabledResponse();
  }

  if (!isInternalCaller(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const issueReportId = params.issue_report_id;
  if (!UUID_RE.test(issueReportId)) {
    return NextResponse.json({ error: 'issue_report_id must be a uuid' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: report, error: reportErr } = await supabase
    .from('issue_reports')
    .select('id, tenant_id, development_id, unit_id, user_id, title, description, logged_by_user_id, linked_analysis_id')
    .eq('id', issueReportId)
    .maybeSingle();
  if (reportErr) {
    console.error('[snag-enrich] report_lookup_failed reason=%s', reportErr.message);
    return NextResponse.json({ error: 'Could not load snag' }, { status: 500 });
  }
  if (!report) {
    return NextResponse.json({ error: 'Snag not found' }, { status: 404 });
  }
  if (report.linked_analysis_id) {
    return NextResponse.json({ ok: true, already_enriched: true, analysis_id: report.linked_analysis_id });
  }

  const { data: joinRows, error: joinErr } = await supabase
    .from('issue_report_media')
    .select('media_id')
    .eq('issue_report_id', issueReportId);
  if (joinErr) {
    console.error('[snag-enrich] media_lookup_failed reason=%s', joinErr.message);
    return NextResponse.json({ error: 'Could not load media' }, { status: 500 });
  }
  const mediaIds = (joinRows ?? []).map((j) => j.media_id as string);

  const userMessageParts = [report.title as string];
  if (report.description) userMessageParts.push(report.description as string);
  const userMessage = userMessageParts.join('\n\n');

  let result;
  try {
    result = await analyse({
      tenantId: report.tenant_id as string,
      developmentId: report.development_id as string,
      unitId: (report.unit_id as string | null) ?? null,
      conversationId: issueReportId,
      messageId: randomUUID(),
      userId: (report.logged_by_user_id as string | null) ?? (report.user_id as string | null) ?? null,
      userMessage,
      mediaIds,
    });
  } catch (err) {
    console.error(
      '[snag-enrich] analyse_failed issue=%s reason=%s',
      issueReportId,
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json({ error: 'Could not enrich snag' }, { status: 500 });
  }

  const { error: updateErr } = await supabase
    .from('issue_reports')
    .update({ linked_analysis_id: result.analysisId, updated_at: new Date().toISOString() })
    .eq('id', issueReportId);
  if (updateErr) {
    console.error('[snag-enrich] report_update_failed reason=%s', updateErr.message);
  }

  const { error: eventErr } = await supabase.from('issue_events').insert({
    tenant_id: report.tenant_id,
    issue_report_id: issueReportId,
    event_type: 'analysis_completed',
    actor_type: 'system',
    actor_id: null,
    metadata: {
      analysis_id: result.analysisId,
      model_provider: 'placeholder',
      action: result.action,
    },
  });
  if (eventErr) {
    console.error('[snag-enrich] event_insert_failed reason=%s', eventErr.message);
  }

  return NextResponse.json({
    ok: true,
    issue_report_id: issueReportId,
    analysis_id: result.analysisId,
    action: result.action,
  });
}
