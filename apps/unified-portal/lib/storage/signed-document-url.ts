import { createClient } from '@supabase/supabase-js';

/**
 * Documents live in private Storage buckets (`development_docs`,
 * `onboarding-files`), but the URLs written into the database use the *public*
 * object path — `/storage/v1/object/public/development_docs/...` — or, for
 * onboarding, a bare object key with no bucket at all.
 *
 * Supabase only resolves the public path for buckets flagged public, so every
 * one of those links answers `404 {"error":"Bucket not found","code":"NoSuchBucket"}`.
 * Rather than making the buckets public — which would expose every developer's
 * documents to anyone holding a URL — we mint a short-lived signed URL at read
 * time, after the caller has already been authorised and scoped.
 */

const SIGNED_URL_TTL_SECONDS = 60 * 60;

export interface SignOptions {
  download?: boolean;
  expiresIn?: number;
}

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
  const path = pathSegments.map(decodeSegment).join('/');

  if (!bucket || !path) return null;
  return { bucket, path };
}

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * Canonical URL for a Storage object: `<base>/storage/v1/object/<bucket>/<key>`.
 *
 * Use this when persisting a pointer to an object in a PRIVATE bucket. Do not
 * use `getPublicUrl()` there — it returns a `/object/public/...` URL that the
 * Storage API refuses with "Bucket not found", which is how 154 documents ended
 * up unreachable. Readers resolve either shape through {@link parseStorageRef}
 * and sign it.
 */
export function storageObjectUrl(bucket: string, path: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
  const key = path.replace(/^\/+/, '');
  return `${base}/storage/v1/object/${bucket}/${key}`;
}

/**
 * Sign a batch of object keys in one bucket. Returns a map of key -> signed
 * URL, omitting any key Storage could not resolve so callers keep their
 * original value rather than a broken one.
 */
async function signPathsInBucket(
  bucket: string,
  paths: string[],
  options: SignOptions
): Promise<Map<string, string>> {
  const signed = new Map<string, string>();
  if (!paths.length) return signed;

  try {
    const { data, error } = await getSupabaseClient()
      .storage
      .from(bucket)
      .createSignedUrls(
        paths,
        options.expiresIn ?? SIGNED_URL_TTL_SECONDS,
        options.download ? { download: true } : undefined
      );

    if (error || !data) return signed;

    for (const entry of data) {
      if (entry?.signedUrl && entry.path) signed.set(entry.path, entry.signedUrl);
    }
  } catch {
    // Signing failed — callers keep the original URLs.
  }

  return signed;
}

/**
 * Swap a stored document URL for a short-lived signed one.
 *
 * Falls back to the original URL if the object cannot be signed, so a missing
 * file behaves no worse than it does today.
 */
export async function signDocumentUrl(
  fileUrl: string | null | undefined,
  options: SignOptions = {}
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
  options: SignOptions = {}
): Promise<(string | null)[]> {
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

  await Promise.all(
    Array.from(byBucket.entries()).map(async ([bucket, paths]) => {
      const signed = await signPathsInBucket(bucket, Array.from(paths.keys()), options);
      for (const [path, positions] of paths) {
        const url = signed.get(path);
        if (!url) continue;
        for (const index of positions) resolved[index] = url;
      }
    })
  );

  return resolved;
}

/**
 * Sign bare object keys in a known bucket — for columns that store a Storage
 * path rather than a URL (onboarding uploads keep `submissionId/folder/file`).
 * Values that are already absolute URLs are passed through {@link signDocumentUrls}.
 * The returned array is index-aligned with `paths`.
 */
export async function signStoragePaths(
  bucket: string,
  paths: (string | null | undefined)[],
  options: SignOptions = {}
): Promise<(string | null)[]> {
  const resolved: (string | null)[] = paths.map((path) => path ?? null);

  const keyPositions = new Map<string, number[]>();
  const urlIndexes: number[] = [];

  paths.forEach((path, index) => {
    if (!path) return;
    if (path.startsWith('http://') || path.startsWith('https://')) {
      urlIndexes.push(index);
      return;
    }
    const key = path.replace(/^\/+/, '');
    if (!key) return;
    const positions = keyPositions.get(key);
    if (positions) positions.push(index);
    else keyPositions.set(key, [index]);
  });

  await Promise.all([
    (async () => {
      const signed = await signPathsInBucket(bucket, Array.from(keyPositions.keys()), options);
      for (const [key, positions] of keyPositions) {
        const url = signed.get(key);
        if (!url) continue;
        for (const index of positions) resolved[index] = url;
      }
    })(),
    (async () => {
      if (!urlIndexes.length) return;
      const signed = await signDocumentUrls(urlIndexes.map((i) => paths[i]), options);
      urlIndexes.forEach((index, i) => {
        if (signed[i]) resolved[index] = signed[i];
      });
    })(),
  ]);

  return resolved;
}

/**
 * Sign the given URL-bearing fields across a list of records, in place.
 *
 * Archive rows carry the same stored URL under more than one key (`file_url`
 * and `storage_url`), and every one of them needs signing or the UI falls back
 * to whichever key is still dead. Signing runs as a single batch across all
 * fields of all records.
 */
export async function signDocumentUrlFields<T extends Record<string, any>>(
  records: T[],
  fields: (keyof T)[],
  options: SignOptions = {}
): Promise<T[]> {
  if (!records.length || !fields.length) return records;

  const targets: { record: T; field: keyof T }[] = [];
  for (const record of records) {
    if (!record) continue;
    for (const field of fields) {
      if (typeof record[field] === 'string' && record[field]) {
        targets.push({ record, field });
      }
    }
  }
  if (!targets.length) return records;

  const signed = await signDocumentUrls(
    targets.map(({ record, field }) => record[field] as string),
    options
  );

  targets.forEach(({ record, field }, index) => {
    const url = signed[index];
    if (url) (record as Record<string, any>)[field as string] = url;
  });

  return records;
}
