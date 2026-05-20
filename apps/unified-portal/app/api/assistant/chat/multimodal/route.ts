/**
 * POST /api/assistant/chat/multimodal
 *
 * Assistant V2 Sprint 1. Entry point for chat messages that include
 * media. The existing text-only chat route (/api/chat) stays untouched.
 *
 * Spec: docs/specs/assistant-v2-sprint-1.md section 5.3.
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
 * Gated on FEATURE_ASSISTANT_IMAGE_UPLOAD. With the flag off this route
 * returns 404 before any work happens.
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { isAssistantImageUploadEnabled } from '@/lib/feature-flags';
import {
  resolveMediaAuth,
  mediaAuthErrorToResponse,
  featureDisabledResponse,
  MediaAuthError,
} from '@/lib/assistant/media-auth';
import { analyse } from '@/lib/assistant/mediaAnalysisService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_MEDIA_PER_MESSAGE = 6;
const MAX_MESSAGE_LENGTH = 4000;

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
    .select('id, tenant_id, unit_id, conversation_id, message_id')
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

  return NextResponse.json({
    message: result.residentMessage,
    analysis_id: result.analysisId,
    action: result.action,
    message_id: messageId,
    conversation_id: conversationId,
  });
}
