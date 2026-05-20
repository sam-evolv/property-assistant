/**
 * POST /api/assistant/media/signed-url
 *
 * Assistant V2 Sprint 1. Return a fresh signed URL pair (original +
 * thumbnail) for an assistant_media row that the caller is authorised
 * to read.
 *
 * Spec: docs/specs/assistant-v2-sprint-1.md section 5.2.
 *
 * Auth. The caller's tenant is verified via lib/assistant/media-auth.
 * The media row's tenant is then cross-checked against the verified
 * tenant. Cross-tenant access is the named cross-tenant block in
 * the acceptance criteria; it returns 403.
 *
 * Gated on FEATURE_ASSISTANT_IMAGE_UPLOAD.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { isAssistantImageUploadEnabled } from '@/lib/feature-flags';
import {
  resolveMediaAuth,
  mediaAuthErrorToResponse,
  featureDisabledResponse,
  MediaAuthError,
} from '@/lib/assistant/media-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const BUCKET = 'assistant-media';
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  if (!isAssistantImageUploadEnabled()) {
    return featureDisabledResponse();
  }

  let body: { media_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const mediaId = typeof body.media_id === 'string' ? body.media_id : '';
  if (!UUID_RE.test(mediaId)) {
    return NextResponse.json({ error: 'media_id is required' }, { status: 400 });
  }

  let auth;
  try {
    auth = await resolveMediaAuth(request);
  } catch (err) {
    if (err instanceof MediaAuthError) return mediaAuthErrorToResponse(err);
    throw err;
  }

  const supabase = getSupabaseAdmin();
  const { data: media, error: mediaErr } = await supabase
    .from('assistant_media')
    .select('id, tenant_id, unit_id, storage_path, thumbnail_path')
    .eq('id', mediaId)
    .maybeSingle();

  if (mediaErr || !media) {
    return NextResponse.json({ error: 'Media not found' }, { status: 404 });
  }

  if (media.tenant_id !== auth.tenantId) {
    console.warn(
      '[assistant-media-signed-url] CROSS_TENANT_ACCESS media_id=%s caller_tenant=%s media_tenant=%s caller_type=%s',
      mediaId,
      auth.tenantId,
      media.tenant_id,
      auth.callerType,
    );
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Homeowner callers may only fetch media bound to their own unit. Admins
  // (with a tenant-wide session) can fetch any media in their tenant; the
  // developer dashboard is the named consumer in the spec.
  if (auth.callerType === 'homeowner' && auth.unitId && media.unit_id !== auth.unitId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: signed, error: signedErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(media.storage_path as string, SIGNED_URL_TTL_SECONDS);
  if (signedErr || !signed?.signedUrl) {
    console.error(
      '[assistant-media-signed-url] sign_failed media_id=%s reason=%s',
      mediaId,
      signedErr?.message,
    );
    return NextResponse.json({ error: 'Could not sign media URL' }, { status: 500 });
  }

  let thumbnailUrl = signed.signedUrl;
  if (media.thumbnail_path) {
    const { data: thumbSigned } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(media.thumbnail_path as string, SIGNED_URL_TTL_SECONDS);
    if (thumbSigned?.signedUrl) thumbnailUrl = thumbSigned.signedUrl;
  }

  const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString();

  return NextResponse.json({
    media_id: mediaId,
    signed_url: signed.signedUrl,
    thumbnail_url: thumbnailUrl,
    expires_at: expiresAt,
  });
}
