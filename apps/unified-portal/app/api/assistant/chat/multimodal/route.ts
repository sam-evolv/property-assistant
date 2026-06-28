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
  isOpenhouseAgentV1Enabled,
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
import { callAgent } from '@/lib/openhouse-agent/v1/service';
import { OPENHOUSE_AGENT_V1_PROMPT_VERSION } from '@/lib/openhouse-agent/v1/prompt';
import type { OpenhouseAgentResult } from '@/lib/openhouse-agent/v1/types';
import { loadHouseContext } from '@/lib/house-context';
import { logTurn } from '@/lib/assistant-analytics/logger';
import type { AttachedMediaItem, LogInput } from '@/lib/assistant-analytics/types';

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

// ── Anonymous per-turn analytics ──────────────────────────────────────────
// Flag-path labels stored in assistant_analytics_anonymous.flag_path.
const ANALYTICS_FLAG_OPENHOUSE_AGENT = 'openhouse_agent_v1';
const ANALYTICS_FLAG_HOUSING_REASONING = 'housing_reasoning_v1';
const ANALYTICS_FLAG_PLACEHOLDER = 'placeholder';

// gpt-4o pricing in USD per 1M tokens, hardcoded (NOT a live feed — update by
// hand if pricing changes). Cost is stored in micro-USD (millionths of a
// dollar), so one input token costs GPT4O_USD_PER_1M_INPUT micro-USD and the
// total is simply in*rate_in + out*rate_out.
const GPT4O_USD_PER_1M_INPUT = 2.5;
const GPT4O_USD_PER_1M_OUTPUT = 10.0;

function computeCostUsdMicro(tokensIn: number | null, tokensOut: number | null): number | null {
  if (tokensIn == null && tokensOut == null) return null;
  return Math.round((tokensIn ?? 0) * GPT4O_USD_PER_1M_INPUT + (tokensOut ?? 0) * GPT4O_USD_PER_1M_OUTPUT);
}

// ── Document link backfill (OpenHouse agent path only) ────────────────────
// The chat bubble only turns a bare absolute http(s) URL into a tappable link.
// The agent reliably NAMES the right document ("Here's your BER certificate:
// BER Certificate - A2 - 34 Bayly") but does not always paste the URL, so the
// homeowner sees dead text. This backfill is deterministic and model-independent:
// for each document in the house context, if the reply mentions the document's
// title (or its distinctive lead phrase) but does not already contain the URL,
// append the URL so the bubble linkifies it. If the agent already pasted the URL
// it is left untouched. Nothing is invented: only URLs already in the context
// for this home are ever added.
interface ContextDocument {
  title: string;
  url: string;
}

function extractContextDocuments(houseContext: unknown): ContextDocument[] {
  if (!houseContext || typeof houseContext !== 'object') return [];
  const docs = (houseContext as { documents?: unknown }).documents;
  if (!Array.isArray(docs)) return [];
  const out: ContextDocument[] = [];
  for (const d of docs) {
    if (d && typeof d === 'object') {
      const title = (d as { title?: unknown }).title;
      const url = (d as { url?: unknown }).url;
      if (typeof title === 'string' && typeof url === 'string' && title && url) {
        out.push({ title, url });
      }
    }
  }
  return out;
}

// The lead phrase is the document title up to its first " - " (e.g. "BER
// Certificate" from "BER Certificate - A2 - 34 Bayly"), lowercased. This is what
// the agent tends to echo, so matching on it catches the common case where the
// agent shortens the title.
function documentLeadPhrase(title: string): string {
  const head = title.split(' - ')[0] ?? title;
  return head.trim().toLowerCase();
}

function backfillDocumentLinks(message: string, documents: ContextDocument[]): string {
  if (!message || documents.length === 0) return message;
  const lower = message.toLowerCase();
  const appended: string[] = [];
  const already = new Set<string>();
  for (const doc of documents) {
    if (message.includes(doc.url)) {
      // The agent already pasted this URL; nothing to do for it.
      already.add(doc.url);
    }
  }
  for (const doc of documents) {
    if (already.has(doc.url)) continue;
    if (appended.includes(doc.url)) continue;
    const fullTitle = doc.title.toLowerCase();
    const lead = documentLeadPhrase(doc.title);
    const mentioned = lower.includes(fullTitle) || (lead.length >= 4 && lower.includes(lead));
    if (mentioned) {
      appended.push(doc.url);
    }
  }
  if (appended.length === 0) return message;
  // One link per line so each renders as its own tappable anchor. A blank line
  // separates the links from the agent's prose.
  return `${message.trimEnd()}\n\n${appended.join('\n')}`;
}

// ── Conversation memory (OpenHouse agent path only) ───────────────────────
// Turns are stored in assistant_conversation_turns (migration 065), keyed by the
// bare conversation_id. We replay the most recent turns to the model so the
// homeowner has cross-turn continuity. This is identifiable personal data, NOT
// the anonymous analytics row — see the migration header.
const HISTORY_MAX_TURNS = 6; // up to 3 user + 3 assistant turns
const HISTORY_TOKEN_BUDGET = 2000; // hard cap on the replayed history
const HISTORY_IMAGE_PLACEHOLDER = '[user sent a photo]';

type PriorMessage = { role: 'user' | 'assistant'; content: string };

// Columns selected from assistant_media for the tenant/conversation/unit checks
// and signed-URL resolution.
interface MediaRow {
  id: string;
  tenant_id: string;
  unit_id: string | null;
  conversation_id: string | null;
  message_id: string | null;
  storage_path: string | null;
}

// Rough token estimate (~4 chars/token). Avoids adding a tokenizer dependency;
// used only to bound how much history we replay, so an approximation is fine.
function estimateHistoryTokens(text: string): number {
  return Math.ceil((text?.length ?? 0) / 4);
}

// Load up to the last HISTORY_MAX_TURNS turns for this conversation, oldest
// first, trimmed from the OLDEST end to HISTORY_TOKEN_BUDGET (recent turns are
// kept). System turns are stripped (defensive — the table only stores
// user/assistant). Image turns are replaced with a short placeholder rather than
// re-sending the large, possibly-expired signed URLs. Best-effort: a read
// failure returns [] and never blocks the turn.
async function loadPriorMessages(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  tenantId: string,
  conversationId: string,
): Promise<PriorMessage[]> {
  const { data, error } = await supabase
    .from('assistant_conversation_turns')
    .select('role, content, has_image, created_at')
    .eq('tenant_id', tenantId)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    // Both rows of one exchange share created_at (one INSERT, one now()), so add a
    // deterministic tiebreaker. role ASC puts 'assistant' before 'user' within an
    // exchange in this DESC fetch, which becomes user-before-assistant after the
    // reverse() below — the correct chronological order.
    .order('role', { ascending: true })
    .limit(HISTORY_MAX_TURNS);

  if (error || !data) {
    if (error) {
      console.warn('[assistant-chat-multimodal] history_load_failed reason=%s', error.message);
    }
    return [];
  }

  const chronological: PriorMessage[] = [...data]
    .reverse()
    .filter((t) => t.role === 'user' || t.role === 'assistant')
    .map((t) => {
      const text = (typeof t.content === 'string' ? t.content : '').trim();
      const content = t.has_image
        ? text
          ? `${text}\n${HISTORY_IMAGE_PLACEHOLDER}`
          : HISTORY_IMAGE_PLACEHOLDER
        : text;
      return { role: t.role as 'user' | 'assistant', content };
    })
    .filter((m) => m.content.length > 0);

  // Trim from the oldest end until within the token budget, keeping recent turns.
  let total = chronological.reduce((sum, m) => sum + estimateHistoryTokens(m.content), 0);
  let start = 0;
  while (start < chronological.length && total > HISTORY_TOKEN_BUDGET) {
    total -= estimateHistoryTokens(chronological[start].content);
    start += 1;
  }
  return chronological.slice(start);
}

// Persist the user turn and the assistant turn for this exchange. content holds
// text only (never image URLs); has_image flags that the user attached photos so
// the next load can show the placeholder. Awaited so the rows are durable before
// the next request reads them, but a write failure is logged and never fails the
// response the homeowner already has.
async function persistConversationTurns(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  params: {
    tenantId: string;
    conversationId: string;
    userId: string | null;
    messageId: string;
    userText: string;
    userHadImage: boolean;
    assistantText: string;
  },
): Promise<void> {
  try {
    const { error } = await supabase.from('assistant_conversation_turns').insert([
      {
        tenant_id: params.tenantId,
        conversation_id: params.conversationId,
        user_id: params.userId,
        message_id: params.messageId,
        role: 'user',
        content: params.userText ?? '',
        has_image: params.userHadImage,
      },
      {
        tenant_id: params.tenantId,
        conversation_id: params.conversationId,
        user_id: params.userId,
        message_id: params.messageId,
        role: 'assistant',
        content: params.assistantText ?? '',
        has_image: false,
      },
    ]);
    if (error) {
      console.warn('[assistant-chat-multimodal] turn_persist_failed reason=%s', error.message);
    }
  } catch (err) {
    console.warn(
      '[assistant-chat-multimodal] turn_persist_threw reason=%s',
      err instanceof Error ? err.message : String(err),
    );
  }
}

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

  // media_ids handling differs by path. The image-only paths (housing-reasoning-v1
  // and the Sprint 1 placeholder) require a valid uuid array. The OpenHouse agent
  // path (FEATURE_OPENHOUSE_AGENT_V1) also answers text-only turns, so a MISSING or
  // EMPTY media_ids is treated as text-only there. A present-but-malformed
  // media_ids (not a uuid array, and not an empty array) is a client bug, so it
  // 400s on every path rather than being silently dropped. Read the flag once here
  // and reuse it for the branch below.
  const agentEnabled = isOpenhouseAgentV1Enabled();
  const rawMediaIds = body.media_ids;
  const mediaValid = isUuidArray(rawMediaIds);
  const mediaMissing = rawMediaIds === undefined || rawMediaIds === null;
  const mediaEmptyArray = Array.isArray(rawMediaIds) && rawMediaIds.length === 0;
  const mediaMalformed = !mediaValid && !mediaMissing && !mediaEmptyArray;

  if (mediaMalformed) {
    return NextResponse.json({ error: 'media_ids is malformed' }, { status: 400 });
  }
  if (!mediaValid && !agentEnabled) {
    return NextResponse.json({ error: 'media_ids is required' }, { status: 400 });
  }
  const mediaIds: string[] = mediaValid ? Array.from(new Set(rawMediaIds as string[])) : [];
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

  // Text-only turns (agent path) carry no media_ids, so skip the media lookup
  // and cross-tenant checks entirely; mediaRows stays empty and the downstream
  // image-loading loops produce no image URLs.
  let mediaRows: MediaRow[] = [];
  if (mediaIds.length > 0) {
    const { data, error: mediaErr } = await supabase
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

    if (!data || data.length !== mediaIds.length) {
      return NextResponse.json({ error: 'One or more media not found' }, { status: 404 });
    }
    mediaRows = data as MediaRow[];

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
  }

  // Use the message_id supplied in the body if any, otherwise reuse the
  // message_id the upload route stamped on the media rows (they all share
  // one in normal flows). Last resort, mint a fresh uuid.
  const messageId =
    providedMessageId ??
    (mediaRows[0]?.message_id as string | null | undefined) ??
    randomUUID();

  // Media analysis is feature-gated with three tiers, in priority order:
  //   1. FEATURE_OPENHOUSE_AGENT_V1   -> OpenHouse Assistant general home agent
  //                                      (Sprint 2). See lib/openhouse-agent/v1.
  //   2. FEATURE_HOUSING_REASONING_V1 -> OpenAI gpt-4o snag-triage service
  //                                      (Sprint 1b). See lib/housing-reasoning/v1.
  //   3. neither                      -> unchanged Sprint 1 placeholder.
  // Each flag is read per-request, so rollback is a config change (unset the env
  // var, redeploy) with no code revert. The first two paths are byte-compatible
  // at the response boundary below.
  let residentMessage: string;
  let analysisId: string | null = null;
  let responseAction: AssistantAction;
  let createdIssueReportId: string | null = null;

  // ── Anonymous analytics setup (fire-and-forget) ───────────────────────────
  // userRole is coarse and non-identifying. userName (admin display name only;
  // homeowners on the QR path have none) is for redaction only. developmentId
  // is for development_type derivation only. Neither userName nor developmentId
  // is stored. Attachments on this route are images; we only know the count, so
  // we pass count-accurate placeholders to classifyImage (real mime/dimensions
  // are not fetched yet — a follow-up for when classification is wired).
  const analyticsUserRole: string | null = auth.adminSession?.role ?? auth.callerType;
  const analyticsUserName: string | null = auth.adminSession?.displayName ?? null;
  const analyticsAttachedMedia: AttachedMediaItem[] = mediaRows.map(() => ({
    mime: 'image/unknown',
    size: 0,
  }));

  // Path-level analytics fields, set inside the matched branch and read by the
  // success log just before the response is returned.
  let logFlagPath = ANALYTICS_FLAG_PLACEHOLDER;
  let logPromptVersion: string | null = null;
  let logModelUsed: string | null = null;
  let logTokensIn: number | null = null;
  let logTokensOut: number | null = null;
  let logLatencyMs: number | null = null;
  let logSeverityReturned: string | null = null;
  let logCategoryReturned: string | null = null;

  // Fire one anonymous analytics row WITHOUT blocking or delaying the response.
  // waitUntil keeps the lambda alive until the insert completes (same pattern
  // as triggerHomeownerIssueNotification); logTurn itself never throws.
  const fireAnalytics = (fields: Partial<LogInput> & { flagPath: string }): void => {
    const input: LogInput = {
      userRole: analyticsUserRole,
      userName: analyticsUserName,
      developmentId: auth.developmentId,
      messageText,
      attachedMedia: analyticsAttachedMedia,
      audioTranscript: null,
      ...fields,
    };
    waitUntil(logTurn(input).catch(() => {}));
  };

  if (agentEnabled) {
    // ===================================================================
    // OpenHouse Assistant v1 (Sprint 2). General home agent, highest
    // priority. callAgent() returns { message, issue_report? } with NO action
    // enum; this route derives the existing AssistantAction and the
    // issue_reports columns from it, keeping the response shape identical to
    // the housing-reasoning path. Boundary mapping lives here; the service
    // stays pure. userType is always 'homeowner' on this surface.
    // See docs/prompts/openhouse-assistant-v1.md.
    // ===================================================================

    // Resolve each media row to a short-lived signed URL (same createSignedUrl +
    // assistant-media bucket pattern as the housing-reasoning path below).
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

    // Load the structured briefing of this homeowner's actual home (development,
    // unit, every room with dimensions, and scheme-level heating/broadband/waste/
    // parking facts) so the agent answers from real data instead of deferring to
    // the Documents tab. Service-role queries; any failure degrades to null/empty
    // fields and never breaks the chat turn. developmentId is guaranteed by the
    // early return near the top of this handler; unitId by requireUnit:true in
    // resolveMediaAuth. See lib/house-context.
    const houseContext = await loadHouseContext({
      tenantId: auth.tenantId,
      developmentId: auth.developmentId!,
      unitId: auth.unitId!,
      supabase,
    });

    // Short-term conversation memory: replay the most recent turns (token-
    // bounded, oldest trimmed, image turns reduced to a placeholder) so the
    // homeowner has continuity across the conversation. See migration 065.
    const priorMessages = await loadPriorMessages(supabase, auth.tenantId, conversationId);

    const startedAt = Date.now();
    let agentResult: OpenhouseAgentResult;
    try {
      agentResult = await callAgent({
        userType: 'homeowner',
        text: messageText,
        images: imageUrls,
        priorMessages,
        // Voice notes are not delivered to this route yet (the body carries
        // media_ids only). When that plumbing exists, transcribe upstream via
        // lib/agent-intelligence/transcription.ts and pass the transcript as
        // the `audio` param.
        houseContext,
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error(
        '[assistant-chat-multimodal] openhouse_agent_failed reason=%s',
        reason,
      );
      fireAnalytics({
        flagPath: ANALYTICS_FLAG_OPENHOUSE_AGENT,
        promptVersion: OPENHOUSE_AGENT_V1_PROMPT_VERSION,
        modelUsed: 'gpt-4o',
        latencyMs: Date.now() - startedAt,
        errored: true,
        errorType: `model_call_failed: ${reason}`,
      });
      return NextResponse.json(
        { error: 'Could not analyse the photo. Try again.' },
        { status: 500 },
      );
    }

    residentMessage = agentResult.message;
    // Deterministically ensure any document the agent named is accompanied by its
    // real URL, so the chat bubble renders it as a tappable link even when the
    // model wrote only the document's name. Uses only URLs already in this home's
    // context; never invents a link. No-op when no document is referenced.
    residentMessage = backfillDocumentLinks(
      residentMessage,
      extractContextDocuments(houseContext),
    );
    logFlagPath = ANALYTICS_FLAG_OPENHOUSE_AGENT;
    logPromptVersion = OPENHOUSE_AGENT_V1_PROMPT_VERSION;
    logModelUsed = 'gpt-4o';
    logTokensIn = agentResult.usage?.input_tokens ?? null;
    logTokensOut = agentResult.usage?.output_tokens ?? null;
    logLatencyMs = Date.now() - startedAt;
    const ir = agentResult.issue_report ?? null;

    if (!ir) {
      // Ordinary chat turn. Nothing to analyse from a snag perspective: no
      // assistant_media_analysis row and no issue_reports row are created.
      // analysisId and createdIssueReportId both stay null.
      responseAction = 'answer_only';
    } else {
      // Something should be logged. Persist exactly as the v1 path does: one
      // assistant_media_analysis row, then the issue_reports row, the media
      // join, the event, and the aftercare notification. The agent has no
      // escalate/warranty action, so safety/escalation/warranty flags are false
      // and severity maps minor/moderate/major -> low/medium/high.
      responseAction = 'create_issue_report';
      const severityLabel: SeverityLabel = SEVERITY_LABEL_BY_V1_SEVERITY[ir.severity];
      logSeverityReturned = severityLabel;
      logCategoryReturned = ir.category;

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
          issue_type: ir.category,
          issue_category: ir.category,
          room: ir.area ?? null,
          visible_features: [],
          severity_score: null,
          severity_label: severityLabel,
          confidence_score: null,
          safety_risk: false,
          safety_risk_type: null,
          likely_trade: null,
          likely_system: null,
          potential_causes: [],
          recommended_action: 'CREATE_ISSUE_REPORT',
          resident_guidance: null,
          needs_more_info: false,
          more_info_requested: [],
          should_create_issue: true,
          should_escalate: false,
          escalation_level: 'none',
          requires_human_review: false,
          warranty_relevant: false,
          similar_issue_check_required: false,
          developer_summary: ir.title,
          raw_model_output: agentResult as unknown as Record<string, unknown>,
          model_provider: 'openai',
          model_name: 'gpt-4o',
          model_version: null,
          prompt_version: OPENHOUSE_AGENT_V1_PROMPT_VERSION,
          processing_time_ms: Date.now() - startedAt,
        })
        .select('id')
        .single();

      if (analysisErr || !analysisRow) {
        console.error(
          '[assistant-chat-multimodal] analysis_insert_failed reason=%s',
          analysisErr?.message ?? 'no row',
        );
        fireAnalytics({
          flagPath: logFlagPath,
          promptVersion: logPromptVersion,
          modelUsed: logModelUsed,
          tokensIn: logTokensIn,
          tokensOut: logTokensOut,
          costUsdMicro: computeCostUsdMicro(logTokensIn, logTokensOut),
          latencyMs: logLatencyMs,
          responseText: residentMessage,
          severityReturned: logSeverityReturned,
          categoryReturned: logCategoryReturned,
          errored: true,
          errorType: `analysis_insert_failed: ${analysisErr?.message ?? 'no row'}`,
        });
        return NextResponse.json(
          { error: 'Could not analyse the photo. Try again.' },
          { status: 500 },
        );
      }
      analysisId = analysisRow.id as string;

      if (auth.unitId && auth.developmentId) {
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
            safety_risk: false,
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
              openhouse_agent: true,
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

    // Persist this exchange so the next turn has context (migration 065). Both
    // the user turn and the assistant turn are written; content is text only and
    // has_image flags photo attachments for the placeholder on the next load.
    await persistConversationTurns(supabase, {
      tenantId: auth.tenantId,
      conversationId,
      userId: auth.userId ?? null,
      messageId,
      userText: messageText,
      userHadImage: mediaIds.length > 0,
      assistantText: residentMessage,
    });
  } else if (isHousingReasoningV1Enabled()) {
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
      const reason = err instanceof Error ? err.message : String(err);
      console.error(
        '[assistant-chat-multimodal] housing_reasoning_failed reason=%s',
        reason,
      );
      fireAnalytics({
        flagPath: ANALYTICS_FLAG_HOUSING_REASONING,
        promptVersion: HOUSING_REASONING_V1_PROMPT_VERSION,
        modelUsed: 'gpt-4o',
        latencyMs: Date.now() - startedAt,
        errored: true,
        errorType: `model_call_failed: ${reason}`,
      });
      return NextResponse.json(
        { error: 'Could not analyse the photo. Try again.' },
        { status: 500 },
      );
    }

    residentMessage = reasoning.message;
    logFlagPath = ANALYTICS_FLAG_HOUSING_REASONING;
    logPromptVersion = HOUSING_REASONING_V1_PROMPT_VERSION;
    logModelUsed = 'gpt-4o';
    logTokensIn = reasoning.usage?.input_tokens ?? null;
    logTokensOut = reasoning.usage?.output_tokens ?? null;
    logLatencyMs = Date.now() - startedAt;

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
    logSeverityReturned = severityLabel;
    logCategoryReturned = ir?.category ?? null;

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
      fireAnalytics({
        flagPath: logFlagPath,
        promptVersion: logPromptVersion,
        modelUsed: logModelUsed,
        tokensIn: logTokensIn,
        tokensOut: logTokensOut,
        costUsdMicro: computeCostUsdMicro(logTokensIn, logTokensOut),
        latencyMs: logLatencyMs,
        responseText: residentMessage,
        severityReturned: logSeverityReturned,
        categoryReturned: logCategoryReturned,
        errored: true,
        errorType: `analysis_insert_failed: ${analysisErr?.message ?? 'no row'}`,
      });
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
    // ===== Sprint 1 placeholder path. Unchanged (analytics aside). =====
    const placeholderStartedAt = Date.now();
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
      const reason = err instanceof Error ? err.message : String(err);
      console.error(
        '[assistant-chat-multimodal] analyse_failed reason=%s',
        reason,
      );
      fireAnalytics({
        flagPath: ANALYTICS_FLAG_PLACEHOLDER,
        modelUsed: 'placeholder',
        latencyMs: Date.now() - placeholderStartedAt,
        errored: true,
        errorType: `analyse_failed: ${reason}`,
      });
      return NextResponse.json(
        { error: 'Could not analyse the photo. Try again.' },
        { status: 500 },
      );
    }

    residentMessage = result.residentMessage;
    analysisId = result.analysisId;
    responseAction = result.action;
    logFlagPath = ANALYTICS_FLAG_PLACEHOLDER;
    logModelUsed = 'placeholder';
    logLatencyMs = Date.now() - placeholderStartedAt;
    logSeverityReturned = result.structured?.severity_label ?? null;
    logCategoryReturned = result.structured?.issue_type ?? null;

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

  // Anonymous analytics for the successful turn. Fired after the response is
  // built and never awaited (waitUntil inside fireAnalytics), so it cannot add
  // latency to the user's reply.
  fireAnalytics({
    flagPath: logFlagPath,
    promptVersion: logPromptVersion,
    modelUsed: logModelUsed,
    tokensIn: logTokensIn,
    tokensOut: logTokensOut,
    costUsdMicro: computeCostUsdMicro(logTokensIn, logTokensOut),
    latencyMs: logLatencyMs,
    responseText: residentMessage,
    actionReturned: responseAction,
    issueCreated: !!createdIssueReportId,
    severityReturned: logSeverityReturned,
    categoryReturned: logCategoryReturned,
    errored: false,
  });

  return NextResponse.json({
    message: residentMessage,
    analysis_id: analysisId,
    action: responseAction,
    message_id: messageId,
    conversation_id: conversationId,
    issue_report_id: createdIssueReportId,
  });
}
