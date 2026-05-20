/**
 * POST /api/assistant/media/upload
 *
 * Assistant V2 Sprint 1. Accepts a multipart upload of one to six image
 * files, validates each, generates a server-side thumbnail, persists an
 * assistant_media row per file, and returns signed URLs for both the
 * original and the thumbnail.
 *
 * Spec: docs/specs/assistant-v2-sprint-1.md sections 4 and 5.1.
 *
 * Auth. Two caller types supported via lib/assistant/media-auth:
 *   - homeowner via x-qr-token header (tenant_id derived from the unit
 *     bound to the token, not from the request body)
 *   - admin via Supabase session cookie (tenant_id from the admins row)
 *
 * Storage paths follow:
 *   {tenant_id}/{development_id}/{unit_id}/{conversation_id}/{media_id}.{ext}
 *   {tenant_id}/{development_id}/{unit_id}/{conversation_id}/thumbnails/{media_id}.jpg
 *
 * All new behaviour is gated on FEATURE_ASSISTANT_IMAGE_UPLOAD. With the
 * flag off the route returns 404 before any auth or DB work happens.
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
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
export const maxDuration = 60;

const BUCKET = 'assistant-media';
const MAX_FILES_PER_REQUEST = 6;
const MAX_BYTES = 25 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const THUMBNAIL_LONGEST_EDGE = 800;
const THUMBNAIL_JPEG_QUALITY = 80;
const UPLOADS_PER_USER_PER_HOUR = 20;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
]);

const EXT_FOR_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
};

interface RateBucket {
  count: number;
  resetAt: number;
}
const uploadRateBuckets = new Map<string, RateBucket>();
function checkUploadRate(key: string): boolean {
  const now = Date.now();
  const entry = uploadRateBuckets.get(key);
  if (!entry || now > entry.resetAt) {
    uploadRateBuckets.set(key, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }
  if (entry.count >= UPLOADS_PER_USER_PER_HOUR) return false;
  entry.count += 1;
  return true;
}

interface UploadOutcome {
  media_id: string;
  signed_url: string;
  thumbnail_url: string;
  width: number | null;
  height: number | null;
}

export async function POST(request: NextRequest) {
  if (!isAssistantImageUploadEnabled()) {
    return featureDisabledResponse();
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const conversationId = String(form.get('conversation_id') ?? '');
  const messageIdRaw = form.get('message_id');
  const unitIdRaw = form.get('unit_id');
  const requestedUnitId = typeof unitIdRaw === 'string' && unitIdRaw ? unitIdRaw : null;
  const messageId =
    typeof messageIdRaw === 'string' && messageIdRaw ? messageIdRaw : randomUUID();

  if (!UUID_RE.test(conversationId)) {
    return NextResponse.json({ error: 'conversation_id is required' }, { status: 400 });
  }
  if (!UUID_RE.test(messageId)) {
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

  const rateKey = `${auth.tenantId}:${auth.userId ?? auth.unitId ?? 'anon'}`;
  if (!checkUploadRate(rateKey)) {
    return NextResponse.json(
      { error: 'Upload limit reached. Try again later.' },
      { status: 429 },
    );
  }

  const files = form.getAll('files').filter((v): v is File => v instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: 'Attach at least one photo.' }, { status: 400 });
  }
  if (files.length > MAX_FILES_PER_REQUEST) {
    return NextResponse.json(
      { error: 'You can attach up to 6 photos per message.' },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdmin();
  const outcomes: UploadOutcome[] = [];
  const writtenObjects: string[] = [];

  try {
    for (const file of files) {
      if (file.size === 0) {
        return NextResponse.json({ error: 'One of the files was empty.' }, { status: 400 });
      }
      if (file.size > MAX_BYTES) {
        return NextResponse.json(
          { error: 'That photo is too large. Try one under 25 MB.' },
          { status: 400 },
        );
      }
      const mimeType = (file.type || '').toLowerCase();
      if (!ALLOWED_MIME.has(mimeType)) {
        return NextResponse.json(
          { error: "That file type isn't supported. Try a JPG, PNG, or HEIC." },
          { status: 400 },
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());

      // Read dimensions; HEIC files may not have parseable metadata via sharp
      // without libheif. We capture whatever sharp gives us and never fail
      // the upload over missing dimensions alone.
      let width: number | null = null;
      let height: number | null = null;
      try {
        const meta = await sharp(buffer).metadata();
        width = typeof meta.width === 'number' ? meta.width : null;
        height = typeof meta.height === 'number' ? meta.height : null;
      } catch {
        // Leave dimensions null; the analysis pipeline reads pixels itself.
      }

      // Thumbnail: max 800px on the longest edge, JPEG q80, EXIF stripped.
      // sharp().jpeg() strips metadata by default (does not call
      // withMetadata()), which is what we want.
      let thumbnailBuffer: Buffer | null = null;
      try {
        thumbnailBuffer = await sharp(buffer)
          .rotate()
          .resize({
            width: THUMBNAIL_LONGEST_EDGE,
            height: THUMBNAIL_LONGEST_EDGE,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .jpeg({ quality: THUMBNAIL_JPEG_QUALITY })
          .toBuffer();
      } catch (thumbErr) {
        // HEIC without libheif at runtime will land here. The original is
        // still useful for Sprint 1b analysis, so we proceed but log it.
        console.warn(
          '[assistant-media-upload] thumbnail_failed mime=%s reason=%s',
          mimeType,
          thumbErr instanceof Error ? thumbErr.message : String(thumbErr),
        );
      }

      const mediaId = randomUUID();
      const ext = EXT_FOR_MIME[mimeType] ?? 'bin';
      const basePath = `${auth.tenantId}/${auth.developmentId}/${auth.unitId}/${conversationId}`;
      const originalPath = `${basePath}/${mediaId}.${ext}`;
      const thumbnailPath = thumbnailBuffer
        ? `${basePath}/thumbnails/${mediaId}.jpg`
        : null;

      const { error: originalErr } = await supabase.storage
        .from(BUCKET)
        .upload(originalPath, buffer, {
          contentType: mimeType,
          upsert: false,
        });
      if (originalErr) {
        console.error(
          '[assistant-media-upload] storage_failed path=%s reason=%s',
          originalPath,
          originalErr.message,
        );
        return NextResponse.json(
          { error: 'Could not save that photo. Try again.' },
          { status: 500 },
        );
      }
      writtenObjects.push(originalPath);

      if (thumbnailBuffer && thumbnailPath) {
        const { error: thumbErr } = await supabase.storage
          .from(BUCKET)
          .upload(thumbnailPath, thumbnailBuffer, {
            contentType: 'image/jpeg',
            upsert: false,
          });
        if (thumbErr) {
          console.warn(
            '[assistant-media-upload] thumbnail_upload_failed path=%s reason=%s',
            thumbnailPath,
            thumbErr.message,
          );
        } else {
          writtenObjects.push(thumbnailPath);
        }
      }

      const { error: insertErr } = await supabase
        .from('assistant_media')
        .insert({
          id: mediaId,
          tenant_id: auth.tenantId,
          development_id: auth.developmentId,
          unit_id: auth.unitId,
          user_id: auth.userId,
          conversation_id: conversationId,
          message_id: messageId,
          media_type: 'image',
          storage_path: originalPath,
          thumbnail_path: thumbnailPath,
          mime_type: mimeType,
          file_size_bytes: file.size,
          width,
          height,
        });
      if (insertErr) {
        console.error(
          '[assistant-media-upload] insert_failed media_id=%s reason=%s',
          mediaId,
          insertErr.message,
        );
        return NextResponse.json(
          { error: 'Could not save that photo. Try again.' },
          { status: 500 },
        );
      }

      const { data: signed, error: signedErr } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(originalPath, SIGNED_URL_TTL_SECONDS);
      if (signedErr || !signed?.signedUrl) {
        console.error(
          '[assistant-media-upload] sign_failed path=%s reason=%s',
          originalPath,
          signedErr?.message,
        );
        return NextResponse.json(
          { error: 'Could not finalize the upload. Try again.' },
          { status: 500 },
        );
      }

      let thumbnailUrl = signed.signedUrl;
      if (thumbnailPath) {
        const { data: thumbSigned } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(thumbnailPath, SIGNED_URL_TTL_SECONDS);
        if (thumbSigned?.signedUrl) thumbnailUrl = thumbSigned.signedUrl;
      }

      outcomes.push({
        media_id: mediaId,
        signed_url: signed.signedUrl,
        thumbnail_url: thumbnailUrl,
        width,
        height,
      });
    }
  } catch (err) {
    // Best-effort rollback of storage objects written before the failure.
    // The DB rows (if any) stay; they have RLS off and storage_path nulled
    // would be more disruptive than leaving an orphan that future cleanup
    // will catch. Storage objects are the larger waste.
    for (const path of writtenObjects) {
      await supabase.storage.from(BUCKET).remove([path]).catch(() => null);
    }
    console.error(
      '[assistant-media-upload] unexpected reason=%s',
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json(
      { error: 'Could not upload the photo. Try again.' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    message_id: messageId,
    conversation_id: conversationId,
    unit_id: auth.unitId,
    media: outcomes,
  });
}
