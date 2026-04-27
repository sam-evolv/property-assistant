'use client';

/**
 * Lease PDF upload — Session 7 build.
 *
 * The Session-5 in-memory Map is gone. The PDF is uploaded to Supabase
 * Storage at the moment it's dropped on the entry screen, and the
 * resulting documentId travels through the URL into the review screen.
 * A page reload no longer loses the PDF — the document row + storage
 * object are both persisted before this resolves.
 *
 * Returns { documentId, fileUrl } on success; throws on any HTTP error
 * with a message safe to surface to the agent.
 */

export type LeaseUploadResult = {
  documentId: string;
  fileUrl: string;
};

export async function uploadLeasePdf(file: File): Promise<LeaseUploadResult> {
  const form = new FormData();
  form.append('file', file);

  const res = await fetch('/api/lettings/lease-upload', {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = body?.error || `Upload failed (${res.status})`;
    throw new Error(message);
  }

  const data = (await res.json()) as LeaseUploadResult;
  if (!data.documentId) {
    throw new Error('Upload response missing documentId');
  }
  return data;
}
