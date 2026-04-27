'use client';

/**
 * Lease PDF handoff — temporary client-side mechanism (Session 5).
 *
 * The address entry screen captures a lease PDF and immediately redirects to
 * the review screen. We can't pass a File through a URL and sessionStorage
 * can't hold binary cheaply, so we keep the File in a module-level Map keyed
 * by a tempId, and put the metadata (name/size/type) in sessionStorage so a
 * mid-navigation refresh at least shows what file was being uploaded.
 *
 * Module-level state survives Next.js client navigation but resets on hard
 * reload. That's acceptable — Session 7 replaces this with a real upload to
 * Supabase Storage at the moment the file is dropped.
 */

const pendingLeases = new Map<string, File>();

export type LeaseMeta = {
  name: string;
  size: number;
  type: string;
};

export function setPendingLease(file: File): string {
  const tempId = `lease-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  pendingLeases.set(tempId, file);
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(
        metaKey(tempId),
        JSON.stringify({ name: file.name, size: file.size, type: file.type }),
      );
    } catch {
      // sessionStorage unavailable (private mode etc) — the in-memory ref
      // still works for the immediate navigation, just won't survive reload.
    }
  }
  return tempId;
}

export function getPendingLease(tempId: string): File | null {
  return pendingLeases.get(tempId) ?? null;
}

export function getPendingLeaseMeta(tempId: string): LeaseMeta | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(metaKey(tempId));
    return raw ? (JSON.parse(raw) as LeaseMeta) : null;
  } catch {
    return null;
  }
}

export function clearPendingLease(tempId: string): void {
  pendingLeases.delete(tempId);
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem(metaKey(tempId));
    } catch {
      // ignored
    }
  }
}

function metaKey(tempId: string): string {
  return `oh.lease-handoff.${tempId}`;
}
