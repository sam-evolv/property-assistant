const PUBLIC_UPLOAD_BASE_URL =
  process.env.PUBLIC_UPLOAD_BASE_URL ||
  process.env.NEXT_PUBLIC_UPLOAD_BASE_URL ||
  "";

if (!PUBLIC_UPLOAD_BASE_URL) {
  console.warn(
    "[resolve-upload-url] PUBLIC_UPLOAD_BASE_URL is not set. " +
      "Relative /uploads/... URLs will fail."
  );
}

function normaliseBase(base: string) {
  return base.replace(/\/+$/, "");
}

function normalisePath(path: string) {
  let normalised = path.replace(/^\/+/, "");
  if (normalised.startsWith("uploads/")) {
    normalised = normalised.substring("uploads/".length);
  }
  return normalised;
}

export function resolveUploadUrl(rawPath: string): string {
  if (!rawPath) {
    throw new Error("resolveUploadUrl: rawPath is empty");
  }

  if (/^https?:\/\//i.test(rawPath)) {
    return rawPath;
  }

  if (!PUBLIC_UPLOAD_BASE_URL) {
    throw new Error(
      `resolveUploadUrl: PUBLIC_UPLOAD_BASE_URL is not configured; got relative path "${rawPath}"`
    );
  }

  const base = normaliseBase(PUBLIC_UPLOAD_BASE_URL);
  const path = normalisePath(rawPath);

  return `${base}/${path}`;
}
