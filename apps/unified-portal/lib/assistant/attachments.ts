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
