/**
 * POST /api/assistant/chat/multimodal
 *
 * Assistant V2 Sprint 1. Entry point for chat messages that include
 * media. The existing text-only chat route (/api/chat) stays untouched.
 *
 * Spec: docs/specs/assistant-v2-sprint-1.md section 5.3,
 * docs/specs/assistant-v2-sprint-3-5a.md section 5.1 and 5.8.
 *
 * Sprint 1 scope:
 *   1. Verify the caller's tenant via lib/assistant/media-auth.
 *   2. Load the assistant_media rows referenced by media_ids and confirm
 *      every row belongs to the verified tenant. Cross-tenant media in
 *      the payload returns 403.
 *   3. Run the placeholder mediaAnalysisService.analyse. This persists
 *      one row in assistant_media_analysis with model_provider =
 *      'placeholder'.
 *   4. Return { message, analysis_id, action }. The decision engine and
 *      issue-report creation are explicitly deferred to Sprint 1b.
 *
 * Sprint 3.5a addition:
 *   5. When analyse returns action = 'create_issue_report', insert an
 *      issue_reports row with source = 'homeowner_assistant' and
 *      status = 'homeowner_new' (per spec section 5.1), link the
 *      analysis to it, and fire a non-blocking notification to the
 *      tenant's aftercare email. Currently the placeholder analysis
 *      never returns this action, so this path is dormant until Sprint
 *      1b replaces the placeholder with real multimodal reasoning.
 *
 * Gated on FEATURE_ASSISTANT_IMAGE_UPLOAD. With the flag off this route
 * returns 404 before any work happens.
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { waitUntil } from '@vercel/functions';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import {
  isAssistantImageUploadEnabled,
  isHomeownerIssuesEnabled,
  isHousingReasoningV1Enabled,
} from '@/lib/feature-flags';
import {
  resolveMediaAuth,
  mediaAuthErrorToResponse,
  featureDisabledResponse,
  MediaAuthError,
} from '@/lib/assistant/media-auth';
import {
  analyse,
  type AssistantAction,
  type SeverityLabel,
} from '@/lib/assistant/mediaAnalysisService';
import { analyseMessage } from '@/lib/housing-reasoning/v1/service';
import { HOUSING_REASONING_V1_PROMPT_VERSION } from '@/lib/housing-reasoning/v1/prompt';
import type { HousingReasoningResult, IssueSeverity } from '@/lib/housing-reasoning/v1/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_MEDIA_PER_MESSAGE = 6;
const MAX_MESSAGE_LENGTH = 4000;

// Housing Reasoning v0.1 (Sprint 1b). Storage + boundary-mapping constants for
// the flag-gated OpenAI path. The placeholder path does not use these.
const ASSISTANT_MEDIA_BUCKET = 'assistant-media';
const SIGNED_URL_TTL_SECONDS = 600;

// Boundary translation, not arbitrary: the v0.1 prompt scores severity on an
// impact scale (minor/moderate/major); issue_reports stores the existing
// low/medium/high/urgent labels. 'urgent' is reserved for ESCALATE_IMMEDIATELY
// and applied separately.
const SEVERITY_LABEL_BY_V1_SEVERITY: Record<IssueSeverity, SeverityLabel> = {
  minor: 'low',
  moderate: 'medium',
  major: 'high',
};

interface MultimodalBody {
  conversation_id?: unknown;
  message_text?: unknown;
  media_ids?: unknown;
  unit_id?: unknown;
  message_id?: unknown;
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
 * Fire-and-forget notification of an aftercare email for a new
 * homeowner-raised issue. Mirrors the enrichment trigger pattern in
 * /api/snag/create: kept alive by waitUntil so the lambda is not torn
 * down before the outbound fetch leaves, but never blocks the response
 * to the homeowner. The INTERNAL_ENRICHMENT_KEY env var is reused so
 * there is one internal secret to rotate, not two.
 *
 * If INTERNAL_ENRICHMENT_KEY is unset the call is skipped with a single
 * warning so the issue still gets created.
 */
function triggerHomeownerIssueNotification(request: NextRequest, issueReportId: string): void {
  const internalKey = process.env.INTERNAL_ENRICHMENT_KEY;
  if (!internalKey) {
    console.warn(
      '[assistant-chat-multimodal] notification_skipped reason=INTERNAL_ENRICHMENT_KEY_unset issue=%s',
      issueReportId,
    );
    return;
  }

  const origin = resolveOrigin(request);
  const url = `${origin}/api/notifications/homeowner-issue`;

  try {
    waitUntil(
      fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-internal-key': internalKey,
        },
        body: JSON.stringify({ issue_report_id: issueReportId }),
      })
        .then((res) => {
          if (!res.ok) {
            console.warn(
              '[assistant-chat-multimodal] notification_fetch_non_ok issue=%s status=%s',
              issueReportId,
              res.status,
            );
          }
        })
        .catch((err) => {
          console.warn(
            '[assistant-chat-multimodal] notification_fetch_rejected issue=%s reason=%s',
            issueReportId,
            err instanceof Error ? err.message : String(err),
          );
        }),
    );
  } catch (err) {
    console.warn(
      '[assistant-chat-multimodal] notification_fetch_threw issue=%s reason=%s',
      issueReportId,
      err instanceof Error ? err.message : String(err),
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isAssistantImageUploadEnabled()) {
    return featureDisabledResponse();
  }

  let body: MultimodalBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const conversationId = typeof body.conversation_id === 'string' ? body.conversation_id : '';
  const messageText = typeof body.message_text === 'string' ? body.message_text : '';
  const requestedUnitId = typeof body.unit_id === 'string' ? body.unit_id : null;
  const providedMessageId = typeof body.message_id === 'string' ? body.message_id : null;

  if (!UUID_RE.test(conversationId)) {
    return NextResponse.json({ error: 'conversation_id is required' }, { status: 400 });
  }
  if (!isUuidArray(body.media_ids)) {
    return NextResponse.json({ error: 'media_ids is required' }, { status: 400 });
  }
  const mediaIds: string[] = Array.from(new Set(body.media_ids));
  if (mediaIds.length > MAX_MEDIA_PER_MESSAGE) {
    return NextResponse.json(
      { error: 'You can attach up to 6 photos per message.' },
      { status: 400 },
    );
  }
  if (messageText.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: 'Message text is too long.' },
      { status: 400 },
    );
  }
  if (providedMessageId && !UUID_RE.test(providedMessageId)) {
    return NextResponse.json({ error: 'message_id must be a uuid' }, { status: 400 });
  }

  let auth;
  try {
    auth = await resolveMediaAuth(request, {
      unitId: requestedUnitId,
      requireUnit: true,
    });
  } catch (err) {
    if (err instanceof MediaAuthError) return mediaAuthErrorToResponse(err);
    throw err;
  }

  if (!auth.developmentId) {
    return NextResponse.json(
      { error: 'Unit is not linked to a development' },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdmin();
  const { data: mediaRows, error: mediaErr } = await supabase
    .from('assistant_media')
    .select('id, tenant_id, unit_id, conversation_id, message_id, storage_path')
    .in('id', mediaIds);

  if (mediaErr) {
    console.error(
      '[assistant-chat-multimodal] media_lookup_failed reason=%s',
      mediaErr.message,
    );
    return NextResponse.json({ error: 'Could not load media' }, { status: 500 });
  }

  if (!mediaRows || mediaRows.length !== mediaIds.length) {
    return NextResponse.json({ error: 'One or more media not found' }, { status: 404 });
  }

  for (const m of mediaRows) {
    if (m.tenant_id !== auth.tenantId) {
      console.warn(
        '[assistant-chat-multimodal] CROSS_TENANT_MEDIA media_id=%s caller_tenant=%s media_tenant=%s',
        m.id,
        auth.tenantId,
        m.tenant_id,
      );
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (m.conversation_id && m.conversation_id !== conversationId) {
      return NextResponse.json(
        { error: 'Media belongs to a different conversation' },
        { status: 400 },
      );
    }
    if (auth.unitId && m.unit_id && m.unit_id !== auth.unitId) {
      return NextResponse.json(
        { error: 'Media belongs to a different unit' },
        { status: 400 },
      );
    }
  }

  // Use the message_id supplied in the body if any, otherwise reuse the
  // message_id the upload route stamped on the media rows (they all share
  // one in normal flows). Last resort, mint a fresh uuid.
  const messageId =
    providedMessageId ??
    (mediaRows[0]?.message_id as string | null | undefined) ??
    randomUUID();

  // Media analysis is feature-gated. With FEATURE_HOUSING_REASONING_V1 on, run
  // the OpenAI gpt-4o housing-reasoning service (Sprint 1b). With it off, fall
  // back to the unchanged Sprint 1 placeholder. The flag is read per-request,
  // so rollback is a config change (set the env var false, redeploy) with no
  // code revert. See lib/housing-reasoning/v1/service.ts.
  let residentMessage: string;
  let analysisId: string;
  let responseAction: AssistantAction;
  let createdIssueReportId: string | null = null;

  if (isHousingReasoningV1Enabled()) {
    // ===================================================================
    // Housing Reasoning v0.1 (Sprint 1b). BOUNDARY MAPPING LIVES HERE, by
    // design — analyseMessage() returns the locked v0.1 shape verbatim
    // (4 actions + minor/moderate/major) and this route translates it to the
    // existing issue_reports columns. The service stays pure. This route is
    // the homeowner-facing surface, so userType is always 'homeowner'.
    // See docs/prompts/housing-reasoning-v1.md.
    // ===================================================================

    // Resolve each media row to a short-lived signed URL and hand them to
    // OpenAI as image_url inputs. Same createSignedUrl + assistant-media bucket
    // pattern as /api/issues/[id] and the upload route; same image_url shape as
    // packages/api/src/extractors/vision.ts.
    const imageUrls: string[] = [];
    for (const m of mediaRows) {
      const path = (m as { storage_path: string | null }).storage_path;
      if (!path) continue;
      const { data: signed, error: signErr } = await supabase.storage
        .from(ASSISTANT_MEDIA_BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
      if (signErr || !signed?.signedUrl) {
        console.warn(
          '[assistant-chat-multimodal] sign_failed media_id=%s reason=%s',
          m.id,
          signErr?.message ?? 'no url',
        );
        continue;
      }
      imageUrls.push(signed.signedUrl);
    }

    const startedAt = Date.now();
    let reasoning: HousingReasoningResult;
    try {
      reasoning = await analyseMessage({
        userType: 'homeowner',
        text: messageText,
        images: imageUrls,
      });
    } catch (err) {
      console.error(
        '[assistant-chat-multimodal] housing_reasoning_failed reason=%s',
        err instanceof Error ? err.message : String(err),
      );
      return NextResponse.json(
        { error: 'Could not analyse the photo. Try again.' },
        { status: 500 },
      );
    }

    residentMessage = reasoning.message;

    // --- Boundary mapping (action + severity) ---
    // ANSWER_ONLY          -> no issue created, just return the answer text.
    // CREATE_ISSUE_REPORT  -> issue created, severity mapped minor/moderate/
    //                         major -> low/medium/high.
    // ESCALATE_IMMEDIATELY -> issue created, severity forced to 'urgent'
    //                         (overrides the model) and safety_risk = true.
    // REFER_TO_WARRANTY    -> issue created and flagged for warranty. NOTE:
    //                         issue_reports has no warranty or category column,
    //                         so the warranty signal and the v0.1 category both
    //                         live on the linked assistant_media_analysis row
    //                         (warranty_relevant / issue_category). FLAGGED:
    //                         a first-class warranty field on issue_reports
    //                         would need a migration (out of scope this PR).
    const action = reasoning.action;
    const ir = reasoning.issue_report;
    const createsIssue = action !== 'ANSWER_ONLY' && !!ir;
    const isEscalation = action === 'ESCALATE_IMMEDIATELY';
    const isWarranty = action === 'REFER_TO_WARRANTY';

    const severityLabel: SeverityLabel | null = !ir
      ? null
      : isEscalation
        ? 'urgent'
        : SEVERITY_LABEL_BY_V1_SEVERITY[ir.severity];

    // Response keeps the existing AssistantAction vocabulary so the client
    // contract is unchanged. ESCALATE and WARRANTY both create an issue.
    responseAction = isEscalation
      ? 'escalate_issue'
      : createsIssue
        ? 'create_issue_report'
        : 'answer_only';

    // Persist the analysis row so analysis_id is returned and the developer
    // dashboards (which read assistant_media_analysis) work for this path too.
    // category and warranty_relevant live here (issue_reports has neither).
    const { data: analysisRow, error: analysisErr } = await supabase
      .from('assistant_media_analysis')
      .insert({
        tenant_id: auth.tenantId,
        development_id: auth.developmentId,
        unit_id: auth.unitId,
        user_id: auth.userId,
        conversation_id: conversationId,
        message_id: messageId,
        analysis_scope: 'single_message',
        input_media_ids: mediaIds,
        issue_type: ir?.category ?? null,
        issue_category: ir?.category ?? null,
        room: ir?.area ?? null,
        visible_features: [],
        severity_score: null,
        severity_label: severityLabel,
        confidence_score: null,
        safety_risk: isEscalation,
        safety_risk_type: null,
        likely_trade: null,
        likely_system: null,
        potential_causes: [],
        recommended_action: action,
        resident_guidance: null,
        needs_more_info: false,
        more_info_requested: [],
        should_create_issue: createsIssue,
        should_escalate: isEscalation,
        escalation_level: isEscalation ? 'urgent' : 'none',
        requires_human_review: isWarranty,
        warranty_relevant: isWarranty,
        similar_issue_check_required: false,
        developer_summary: ir?.title ?? reasoning.message,
        raw_model_output: reasoning as unknown as Record<string, unknown>,
        model_provider: 'openai',
        model_name: 'gpt-4o',
        model_version: null,
        prompt_version: HOUSING_REASONING_V1_PROMPT_VERSION,
        processing_time_ms: Date.now() - startedAt,
      })
      .select('id')
      .single();

    if (analysisErr || !analysisRow) {
      console.error(
        '[assistant-chat-multimodal] analysis_insert_failed reason=%s',
        analysisErr?.message ?? 'no row',
      );
      return NextResponse.json(
        { error: 'Could not analyse the photo. Try again.' },
        { status: 500 },
      );
    }
    analysisId = analysisRow.id as string;

    // Create the issue (homeowner surface => status homeowner_new, source
    // homeowner_assistant), mirroring the placeholder path's linkage.
    if (createsIssue && ir && auth.unitId && auth.developmentId) {
      const title = ir.title.length > 200 ? `${ir.title.slice(0, 197)}...` : ir.title;

      const { data: issueRow, error: issueErr } = await supabase
        .from('issue_reports')
        .insert({
          tenant_id: auth.tenantId,
          development_id: auth.developmentId,
          unit_id: auth.unitId,
          user_id: auth.userId,
          title,
          description: ir.description || messageText || null,
          room: ir.area ?? null,
          issue_category: ir.category,
          status: 'homeowner_new',
          priority: 'normal',
          source: 'homeowner_assistant',
          severity_label: severityLabel,
          severity_score: null,
          safety_risk: isEscalation,
          likely_trade: null,
          likely_system: null,
          linked_analysis_id: analysisId,
          logged_by_user_id: auth.userId,
          logged_by_role: 'homeowner',
        })
        .select('id')
        .single();

      if (issueErr || !issueRow) {
        console.error(
          '[assistant-chat-multimodal] issue_insert_failed reason=%s',
          issueErr?.message ?? 'no row',
        );
      } else {
        createdIssueReportId = issueRow.id as string;

        const mediaJoinRows = mediaIds.map((mediaId) => ({
          tenant_id: auth.tenantId,
          issue_report_id: createdIssueReportId,
          media_id: mediaId,
        }));
        const { error: joinErr } = await supabase.from('issue_report_media').insert(mediaJoinRows);
        if (joinErr) {
          console.error(
            '[assistant-chat-multimodal] issue_media_join_failed reason=%s',
            joinErr.message,
          );
        }

        const { error: eventErr } = await supabase.from('issue_events').insert({
          tenant_id: auth.tenantId,
          issue_report_id: createdIssueReportId,
          event_type: 'homeowner_issue_created',
          actor_type: 'homeowner',
          actor_id: auth.userId,
          metadata: {
            source: 'homeowner_assistant',
            analysis_id: analysisId,
            media_count: mediaIds.length,
            housing_reasoning_action: action,
          },
        });
        if (eventErr) {
          console.error('[assistant-chat-multimodal] event_insert_failed reason=%s', eventErr.message);
        }

        if (isHomeownerIssuesEnabled()) {
          triggerHomeownerIssueNotification(request, createdIssueReportId);
        }
      }
    }
  } else {
    // ===== Sprint 1 placeholder path. Unchanged. =====
    let result;
    try {
      result = await analyse({
        tenantId: auth.tenantId,
        developmentId: auth.developmentId,
        unitId: auth.unitId,
        conversationId,
        messageId,
        userId: auth.userId,
        userMessage: messageText,
        mediaIds,
      });
    } catch (err) {
      console.error(
        '[assistant-chat-multimodal] analyse_failed reason=%s',
        err instanceof Error ? err.message : String(err),
      );
      return NextResponse.json(
        { error: 'Could not analyse the photo. Try again.' },
        { status: 500 },
      );
    }

    residentMessage = result.residentMessage;
    analysisId = result.analysisId;
    responseAction = result.action;

    // Sprint 3.5a section 5.1. When the AI determines the upload represents
    // an actual issue (not a curiosity question, not "look at my kitchen"),
    // create an issue_reports row in the homeowner_new state and fire the
    // aftercare email notification. The placeholder mediaAnalysisService
    // currently never returns 'create_issue_report', so this branch is
    // dormant until the flag above is turned on.
    if (result.action === 'create_issue_report' && auth.unitId && auth.developmentId) {
      const titleSource =
        result.structured.developer_summary?.trim() ||
        result.structured.issue_type?.trim() ||
        'Photo from homeowner';
      const title = titleSource.length > 200 ? `${titleSource.slice(0, 197)}...` : titleSource;

      const { data: issueRow, error: issueErr } = await supabase
        .from('issue_reports')
        .insert({
          tenant_id: auth.tenantId,
          development_id: auth.developmentId,
          unit_id: auth.unitId,
          user_id: auth.userId,
          title,
          description: messageText || result.structured.developer_summary || null,
          room: result.structured.room ?? null,
          status: 'homeowner_new',
          priority: 'normal',
          source: 'homeowner_assistant',
          severity_label: result.structured.severity_label,
          severity_score: result.structured.severity_score,
          safety_risk: result.structured.safety_risk,
          likely_trade: result.structured.likely_trade,
          likely_system: result.structured.likely_system,
          linked_analysis_id: result.analysisId,
          logged_by_user_id: auth.userId,
          logged_by_role: 'homeowner',
        })
        .select('id')
        .single();

      if (issueErr || !issueRow) {
        console.error(
          '[assistant-chat-multimodal] issue_insert_failed reason=%s',
          issueErr?.message ?? 'no row',
        );
      } else {
        createdIssueReportId = issueRow.id as string;

        const mediaJoinRows = mediaIds.map((mediaId) => ({
          tenant_id: auth.tenantId,
          issue_report_id: createdIssueReportId,
          media_id: mediaId,
        }));
        const { error: joinErr } = await supabase.from('issue_report_media').insert(mediaJoinRows);
        if (joinErr) {
          console.error(
            '[assistant-chat-multimodal] issue_media_join_failed reason=%s',
            joinErr.message,
          );
        }

        const { error: eventErr } = await supabase.from('issue_events').insert({
          tenant_id: auth.tenantId,
          issue_report_id: createdIssueReportId,
          event_type: 'homeowner_issue_created',
          actor_type: 'homeowner',
          actor_id: auth.userId,
          metadata: {
            source: 'homeowner_assistant',
            analysis_id: result.analysisId,
            media_count: mediaIds.length,
          },
        });
        if (eventErr) {
          console.error('[assistant-chat-multimodal] event_insert_failed reason=%s', eventErr.message);
        }

        if (isHomeownerIssuesEnabled()) {
          triggerHomeownerIssueNotification(request, createdIssueReportId);
        }
      }
    }
  }

  return NextResponse.json({
    message: residentMessage,
    analysis_id: analysisId,
    action: responseAction,
    message_id: messageId,
    conversation_id: conversationId,
    issue_report_id: createdIssueReportId,
  });
}
