import { createClient } from '@supabase/supabase-js';

/**
 * Documents live in the private `development_docs` bucket, but the URLs written
 * into `document_sections.metadata.file_url` (and `documents.file_url`) use the
 * public object path — `/storage/v1/object/public/development_docs/...`.
 *
 * Supabase only resolves that path for buckets flagged public, so every one of
 * those links answers `404 {"error":"Bucket not found","code":"NoSuchBucket"}`.
 * Rather than making the bucket public — which would expose every developer's
 * documents to anyone holding a URL — we mint a short-lived signed URL at read
 * time, after the caller has already been authorised and scoped.
 */

const SIGNED_URL_TTL_SECONDS = 60 * 60;

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export interface StorageRef {
  bucket: string;
  /** Object key within the bucket, decoded — `createSignedUrl` re-encodes it. */
  path: string;
}

/**
 * Resolve a stored document URL to the bucket/object it points at.
 *
 * Returns null when the URL is not a Supabase Storage object this project can
 * sign: legacy `/docs/...` app-served paths, externally hosted demo PDFs, and
 * URLs that are already signed (they carry their own token) are left alone.
 */
export function parseStorageRef(fileUrl: string | null | undefined): StorageRef | null {
  if (!fileUrl) return null;

  const marker = '/storage/v1/object/';
  const markerIndex = fileUrl.indexOf(marker);
  if (markerIndex === -1) return null;

  // Drop any query string (a signed URL's ?token=..., a cache buster).
  const [withoutQuery] = fileUrl.slice(markerIndex + marker.length).split('?');
  const segments = withoutQuery.split('/').filter(Boolean);
  if (segments.length < 2) return null;

  // The object path may be prefixed with an access mode: `public`, `sign` or
  // `authenticated`. Anything else is already the bucket name.
  const [first] = segments;
  if (first === 'sign') return null; // already signed — leave it as-is
  const rest = first === 'public' || first === 'authenticated' ? segments.slice(1) : segments;
  if (rest.length < 2) return null;

  const [bucket, ...pathSegments] = rest;
  const path = pathSegments
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    })
    .join('/');

  if (!bucket || !path) return null;
  return { bucket, path };
}

/**
 * Swap a stored document URL for a short-lived signed one.
 *
 * Falls back to the original URL if the object cannot be signed, so a missing
 * file behaves no worse than it does today.
 */
export async function signDocumentUrl(
  fileUrl: string | null | undefined,
  options: { download?: boolean; expiresIn?: number } = {}
): Promise<string | null> {
  if (!fileUrl) return fileUrl ?? null;

  const [signed] = await signDocumentUrls([fileUrl], options);
  return signed ?? fileUrl;
}

/**
 * Batch version of {@link signDocumentUrl}. Signing is grouped per bucket so a
 * list of documents costs one Storage round trip rather than one per document.
 * The returned array is index-aligned with `fileUrls`.
 */
export async function signDocumentUrls(
  fileUrls: (string | null | undefined)[],
  options: { download?: boolean; expiresIn?: number } = {}
): Promise<(string | null)[]> {
  const expiresIn = options.expiresIn ?? SIGNED_URL_TTL_SECONDS;
  const resolved: (string | null)[] = fileUrls.map((url) => url ?? null);

  // Group the signable URLs by bucket, keeping the positions each path fills so
  // duplicates (the same document listed twice) are signed once.
  const byBucket = new Map<string, Map<string, number[]>>();
  fileUrls.forEach((url, index) => {
    const ref = parseStorageRef(url);
    if (!ref) return;
    let paths = byBucket.get(ref.bucket);
    if (!paths) {
      paths = new Map<string, number[]>();
      byBucket.set(ref.bucket, paths);
    }
    const positions = paths.get(ref.path);
    if (positions) positions.push(index);
    else paths.set(ref.path, [index]);
  });

  if (byBucket.size === 0) return resolved;

  const supabase = getSupabaseClient();

  await Promise.all(
    Array.from(byBucket.entries()).map(async ([bucket, paths]) => {
      const pathList = Array.from(paths.keys());
      try {
        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUrls(pathList, expiresIn, options.download ? { download: true } : undefined);

        if (error || !data) return; // keep the original URLs

        for (const entry of data) {
          if (!entry?.signedUrl || !entry.path) continue;
          for (const index of paths.get(entry.path) ?? []) {
            resolved[index] = entry.signedUrl;
          }
        }
      } catch {
        // Signing failed — leave the original URLs in place.
      }
    })
  );

  return resolved;
}
