'use client';

/**
 * Assistant V2 Sprint 1 attachment helpers.
 *
 * Picking strategy:
 *   1. If running inside Capacitor native AND the Camera plugin is
 *      pre-registered on Capacitor.Plugins, use the plugin so the homeowner
 *      gets a native sheet with both Camera and Photo Library options.
 *   2. Otherwise fall back to a standard HTML <input type="file" multiple
 *      accept="image/*">. On iOS WKWebView this still produces the native
 *      action sheet, so the fallback is fine for both web and the current
 *      Capacitor shells that do not bundle the Camera plugin.
 *
 * Bare-specifier import("@capacitor/camera") is guarded the same way as
 * lib/capacitor-native.ts: we never call it unless Capacitor.Plugins.Camera
 * already exists. Without that check, on iOS the unresolved fetch can
 * corrupt WKWebView's decide-policy state and break in-app navigation.
 *
 * Validation here is intentionally thin. The real allow-list lives on the
 * server (POST /api/assistant/media/upload). We pre-filter so the homeowner
 * sees a fast inline error before a 5 MB upload, but the server is the
 * source of truth.
 *
 * Client-side compression. The upload route runs on Vercel serverless,
 * which caps the request body at roughly 4.5 MB regardless of our
 * application code. iPhone photos are typically 10 to 15 MB, which
 * triggers a 413 Payload Too Large from the platform before our handler
 * even runs. The fix here is a client-side resize and re-encode:
 * decode the image, draw to a canvas sized to at most 2000 pixels on
 * the longest edge, export as JPEG at quality 0.85. This keeps the
 * post-compression body comfortably under the 4.5 MB cap while leaving
 * enough resolution for the Sprint 1b multimodal analysis pass.
 *
 * The longer-term plan is direct-to-Supabase signed upload URLs, which
 * lets the homeowner bypass our serverless function entirely and push
 * the original bytes to storage. Until that lands, compression is the
 * pragmatic fix. See compressForUpload below for the implementation.
 */

import { nanoid } from 'nanoid';

export const ASSISTANT_MEDIA_MAX_FILES = 6;
export const ASSISTANT_MEDIA_MAX_BYTES = 25 * 1024 * 1024;
export const ASSISTANT_MEDIA_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif';

export const ASSISTANT_MEDIA_ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

export interface SelectedAttachment {
  /** Stable local id, used as the React key in the preview row */
  id: string;
  file: File;
  previewUrl: string;
}

export type AttachmentRejectionReason =
  | 'too_many'
  | 'too_large'
  | 'unsupported_type'
  | 'empty';

export interface AttachmentRejection {
  filename: string;
  reason: AttachmentRejectionReason;
}

export interface AttachmentSelection {
  accepted: SelectedAttachment[];
  rejected: AttachmentRejection[];
}

/**
 * Normalize a FileList (or an array of File-like objects from Capacitor)
 * into the accepted/rejected split. capacity is the number of additional
 * files the caller can still take, computed from any existing selection.
 */
export function normalizeFiles(
  input: ArrayLike<File>,
  capacity: number,
): AttachmentSelection {
  const accepted: SelectedAttachment[] = [];
  const rejected: AttachmentRejection[] = [];
  let remaining = Math.max(0, capacity);

  for (let i = 0; i < input.length; i += 1) {
    const file = input[i];
    if (!file) continue;
    if (remaining <= 0) {
      rejected.push({ filename: file.name, reason: 'too_many' });
      continue;
    }
    if (file.size === 0) {
      rejected.push({ filename: file.name, reason: 'empty' });
      continue;
    }
    if (file.size > ASSISTANT_MEDIA_MAX_BYTES) {
      rejected.push({ filename: file.name, reason: 'too_large' });
      continue;
    }
    const type = (file.type || '').toLowerCase();
    if (!ASSISTANT_MEDIA_ALLOWED_MIME.has(type)) {
      // Some browsers report an empty type for HEIC. We accept those if the
      // extension looks right; the server validates strictly either way.
      const name = file.name.toLowerCase();
      const heicByName = name.endsWith('.heic') || name.endsWith('.heif');
      if (!heicByName) {
        rejected.push({ filename: file.name, reason: 'unsupported_type' });
        continue;
      }
    }

    accepted.push({
      id: nanoid(10),
      file,
      previewUrl: URL.createObjectURL(file),
    });
    remaining -= 1;
  }

  return { accepted, rejected };
}

/**
 * Resident-facing copy for a rejection. Exact phrasing from the spec's
 * section 7.5. No em dashes, no AI language.
 */
export function rejectionMessage(reason: AttachmentRejectionReason): string {
  switch (reason) {
    case 'too_many':
      return 'You can attach up to 6 photos per message.';
    case 'too_large':
      return 'That photo is too large. Try one under 25 MB.';
    case 'unsupported_type':
      return "That file type isn't supported. Try a JPG, PNG, or HEIC.";
    case 'empty':
      return "That file looks empty. Try a different photo.";
    default:
      return "That photo could not be added.";
  }
}

/**
 * Compression threshold. Files at or below this size go to the upload
 * route as-is. Anything larger gets routed through the canvas resize
 * step. 1.5 MB is comfortably under Vercel's 4.5 MB body cap with
 * headroom for the multipart envelope, and below this size most photos
 * are already optimised (screenshots, social-app exports).
 */
const COMPRESSION_THRESHOLD_BYTES = 1_500_000;

/**
 * Resize target. 2000 px on the longest edge is plenty for the Sprint 1b
 * multimodal analysis pass and produces JPEG outputs in the 500 KB to
 * 1.5 MB range for a typical iPhone photo.
 */
const COMPRESSION_MAX_EDGE = 2000;
const COMPRESSION_JPEG_QUALITY = 0.85;

/**
 * Decode a file into an HTMLImageElement. Throws if the browser cannot
 * decode the bytes (HEIC on Chrome and Firefox is the known case). The
 * caller is responsible for catching and falling back to the original
 * upload.
 */
function decodeImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('decode_failed'));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

function replaceExtension(name: string, newExt: string): string {
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  return `${base}.${newExt}`;
}

/**
 * Compress a single file for upload. Skips the resize when the original
 * is already under the threshold or when the browser cannot decode the
 * format (HEIC on Chrome and Firefox). In the no-op cases the original
 * File object is returned unchanged so the rest of the pipeline can
 * stay file-shaped.
 *
 * On a decode failure the original is still returned; the server allow
 * list and the 25 MB cap remain the safety net. If the original exceeds
 * Vercel's body cap the upload will fail with a 413, which surfaces as
 * the generic "Couldn't upload that photo" error rather than crashing
 * the client.
 */
export async function compressForUpload(file: File): Promise<File> {
  if (file.size <= COMPRESSION_THRESHOLD_BYTES) return file;
  if (typeof document === 'undefined') return file;

  let img: HTMLImageElement;
  try {
    img = await decodeImage(file);
  } catch {
    // HEIC on non-Safari browsers, or any other undecodable input.
    // Fall back to the original; the server will validate and the
    // upload will either succeed or surface the generic error.
    return file;
  }

  const naturalWidth = img.naturalWidth || img.width;
  const naturalHeight = img.naturalHeight || img.height;
  if (!naturalWidth || !naturalHeight) return file;

  const longestEdge = Math.max(naturalWidth, naturalHeight);
  const scale = longestEdge > COMPRESSION_MAX_EDGE ? COMPRESSION_MAX_EDGE / longestEdge : 1;
  const targetWidth = Math.max(1, Math.round(naturalWidth * scale));
  const targetHeight = Math.max(1, Math.round(naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  const blob = await canvasToBlob(canvas, 'image/jpeg', COMPRESSION_JPEG_QUALITY);
  if (!blob || blob.size >= file.size) {
    // The re-encode came out larger than the original (rare, but can
    // happen for already heavily-compressed sources). Keep the
    // original.
    return file;
  }

  const newName = replaceExtension(file.name, 'jpg');
  return new File([blob], newName, { type: 'image/jpeg', lastModified: file.lastModified });
}

/**
 * Compress an array of selections sequentially. Sequential rather than
 * parallel because decoding multiple 12 MP photos at once on a low-end
 * Android WebView can spike memory enough to OOM the tab. The wall-clock
 * cost is modest (typically under three seconds for six photos).
 */
export async function compressSelectionsForUpload(
  selections: SelectedAttachment[],
): Promise<SelectedAttachment[]> {
  const out: SelectedAttachment[] = [];
  for (const sel of selections) {
    const compressed = await compressForUpload(sel.file);
    if (compressed === sel.file) {
      out.push(sel);
    } else {
      out.push({ ...sel, file: compressed });
    }
  }
  return out;
}

/**
 * Release the object URLs held by an array of selections. The caller is
 * responsible for calling this when files are removed or after the message
 * is sent.
 */
export function revokeSelections(selections: SelectedAttachment[]): void {
  for (const sel of selections) {
    try {
      URL.revokeObjectURL(sel.previewUrl);
    } catch {
      // best effort
    }
  }
}

interface CapacitorRuntime {
  isNativePlatform?: () => boolean;
  Plugins?: Record<string, unknown>;
}

function getCapacitor(): CapacitorRuntime | null {
  if (typeof window === 'undefined') return null;
  const cap = (window as unknown as { Capacitor?: CapacitorRuntime }).Capacitor;
  return cap ?? null;
}

/**
 * True when the Capacitor Camera plugin is registered on the current native
 * shell. Mirrors the existing guard in lib/capacitor-native.ts so we never
 * issue an unresolved bare-specifier import on web or on shells that ship
 * without the plugin.
 */
function isCapacitorCameraAvailable(): boolean {
  const cap = getCapacitor();
  if (!cap || typeof cap.isNativePlatform !== 'function') return false;
  if (!cap.isNativePlatform()) return false;
  const plugin = cap.Plugins?.Camera as
    | { pickImages?: unknown; getPhoto?: unknown }
    | undefined;
  return !!plugin && (typeof plugin.pickImages === 'function' || typeof plugin.getPhoto === 'function');
}

/**
 * Convert a Capacitor Photo result into a File. The plugin can return
 * either a webPath (a blob: URL) or base64. We prefer webPath because it
 * lets the browser materialise the bytes directly without a base64 round
 * trip.
 */
async function capacitorPhotoToFile(
  photo: { webPath?: string; path?: string; format?: string },
  fallbackName: string,
): Promise<File | null> {
  const src = photo.webPath || photo.path;
  if (!src) return null;
  try {
    const res = await fetch(src);
    const blob = await res.blob();
    const ext = (photo.format || '').toLowerCase() || 'jpg';
    const type = blob.type && blob.type.startsWith('image/')
      ? blob.type
      : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    return new File([blob], `${fallbackName}.${ext}`, { type });
  } catch {
    return null;
  }
}

/**
 * Pick images via the Capacitor Camera plugin. Returns null if the plugin
 * is not available, so the caller can fall back to the HTML file input.
 *
 * On native, this presents the platform's native sheet for Camera vs
 * Photo Library, which matches the spec for the mobile experience.
 */
export async function pickImagesViaCapacitor(
  limit: number,
): Promise<File[] | null> {
  if (!isCapacitorCameraAvailable()) return null;

  try {
    const specifier = '@capacitor/camera';
    // @ts-ignore optional dependency, dynamic specifier to avoid webpack static resolution
    const mod = await import(/* webpackIgnore: true */ specifier);
    const camera = mod?.Camera;
    if (!camera) return null;

    if (typeof camera.pickImages === 'function') {
      const result = await camera.pickImages({ limit: Math.max(1, limit) });
      const photos: Array<{ webPath?: string; path?: string; format?: string }> = Array.isArray(result?.photos)
        ? result.photos
        : [];
      const files: File[] = [];
      for (let i = 0; i < photos.length; i += 1) {
        const f = await capacitorPhotoToFile(photos[i], `attachment-${Date.now()}-${i}`);
        if (f) files.push(f);
      }
      return files;
    }

    if (typeof camera.getPhoto === 'function') {
      const result = await camera.getPhoto({
        resultType: 'uri',
        source: 'Prompt',
        quality: 90,
        allowEditing: false,
      });
      const f = await capacitorPhotoToFile(result, `attachment-${Date.now()}`);
      return f ? [f] : [];
    }

    return null;
  } catch {
    return null;
  }
}
