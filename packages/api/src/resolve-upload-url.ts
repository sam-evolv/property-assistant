const BASE = process.env.PUBLIC_UPLOAD_BASE_URL ?? '';

if (!BASE) {
  console.warn(
    "[resolve-upload-url] PUBLIC_UPLOAD_BASE_URL is not set. " +
      "Relative /uploads/... URLs will fail."
  );
}

export function resolveUploadUrl(path: string): string {
  if (!path) {
    throw new Error('No path provided to resolveUploadUrl');
  }

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  if (!BASE) {
    throw new Error(
      `resolveUploadUrl: PUBLIC_UPLOAD_BASE_URL is not configured; got relative path "${path}"`
    );
  }

  const base = BASE.replace(/\/$/, '');

  let normalised = path.startsWith('/') ? path : `/${path}`;

  if (!normalised.startsWith('/uploads/')) {
    normalised = `/uploads${normalised}`;
  }

  return `${base}${normalised}`;
}
