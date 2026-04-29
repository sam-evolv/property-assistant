'use client';

/**
 * Session 5A — approval drawer store.
 *
 * The drawer is a single mounted component at layout level. Intelligence chat
 * pages (mobile + desktop) parse `envelope` SSE frames and call
 * `openApprovalDrawer()` on the store. The drawer opens over the chat, user
 * flicks through each draft, approves / edits / discards, drawer closes.
 *
 * The store holds only the envelope + per-draft local state (approved /
 * discarded / sent / failed). The canonical store is `pending_drafts` — the
 * drawer is a view into it. Anything the user doesn't touch stays behind as
 * `pending_review` in the Drafts inbox.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AgenticSkillEnvelope, AgenticSkillDraft } from './envelope';

export type DrawerDraftStatus = 'pending' | 'approved' | 'discarded' | 'sending' | 'sent' | 'failed';

export interface DrawerDraft extends AgenticSkillDraft {
  status: DrawerDraftStatus;
  /** When status is 'failed', surface this to the user in the drawer. */
  errorMessage?: string;
}

export interface DrawerState {
  open: boolean;
  envelope: AgenticSkillEnvelope | null;
  drafts: DrawerDraft[];
  /** Index of the draft currently visible in the pager. */
  cursor: number;
  /** Approve-all progress — null when not active. */
  bulkProgress: { total: number; done: number; failed: number } | null;
}

interface DrawerContextValue extends DrawerState {
  openApprovalDrawer: (envelope: AgenticSkillEnvelope) => void;
  close: () => void;
  setCursor: (index: number) => void;
  approveDraft: (draftId: string, opts?: { wasEdited?: boolean }) => Promise<void>;
  discardDraft: (draftId: string) => Promise<void>;
  editDraft: (draftId: string, patch: { subject?: string; body?: string }) => Promise<void>;
  approveAll: () => Promise<void>;
}

const DrawerContext = createContext<DrawerContextValue | null>(null);

const INITIAL_STATE: DrawerState = {
  open: false,
  envelope: null,
  drafts: [],
  cursor: 0,
  bulkProgress: null,
};

export function ApprovalDrawerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DrawerState>(INITIAL_STATE);
  // Guard against React 18 render batching — opening the drawer needs one
  // frame without `.open` so the CSS transition can play. We render closed
  // first, then flip to open on the next animation frame.
  const pendingOpenRef = useRef<AgenticSkillEnvelope | null>(null);
  // Session 14b — keep a ref of the latest drafts so approveDraft can read
  // recipient info synchronously without closing over stale state.
  const draftsRef = useRef<DrawerDraft[]>([]);
  useEffect(() => { draftsRef.current = state.drafts; }, [state.drafts]);

  const openApprovalDrawer = useCallback((envelope: AgenticSkillEnvelope) => {
    if (!envelope?.drafts?.length) return;
    pendingOpenRef.current = envelope;
    const drafts: DrawerDraft[] = envelope.drafts.map((d) => ({ ...d, status: 'pending' }));
    // First frame: drawer mounted but not yet marked open. Next rAF flips it.
    setState({
      open: false,
      envelope,
      drafts,
      cursor: 0,
      bulkProgress: null,
    });
  }, []);

  useEffect(() => {
    if (!state.envelope || state.open) return;
    if (pendingOpenRef.current !== state.envelope) return;
    const id = requestAnimationFrame(() => {
      setState((s) => (s.envelope === pendingOpenRef.current ? { ...s, open: true } : s));
    });
    return () => cancelAnimationFrame(id);
  }, [state.envelope, state.open]);

  const close = useCallback(() => {
    setState((s) => ({ ...s, open: false }));
    // Clear after the transition finishes so the content doesn't flash away.
    window.setTimeout(() => setState(INITIAL_STATE), 280);
  }, []);

  const setCursor = useCallback((index: number) => {
    setState((s) => ({
      ...s,
      cursor: Math.max(0, Math.min(index, Math.max(0, s.drafts.length - 1))),
    }));
  }, []);

  const mutateDraft = useCallback((draftId: string, patch: Partial<DrawerDraft>) => {
    setState((s) => ({
      ...s,
      drafts: s.drafts.map((d) => (d.id === draftId ? { ...d, ...patch } : d)),
    }));
  }, []);

  const approveDraft = useCallback(
    async (draftId: string, opts?: { wasEdited?: boolean }) => {
      mutateDraft(draftId, { status: 'sending', errorMessage: undefined });
      try {
        const res = await fetch('/api/agent/intelligence/send-draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ draftId, wasEdited: !!opts?.wasEdited, mode: 'reviewed' }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          mutateDraft(draftId, { status: 'failed', errorMessage: err.error || 'Send failed.' });
          return;
        }
        const data = await res.json().catch(() => ({}));
        // External handoff (whatsapp/sms): open the deep link so the user can
        // finish the send in their chosen app.
        if (data?.externalPayload?.href) {
          try { window.open(data.externalPayload.href, '_blank'); } catch { /* noop */ }
        }
        mutateDraft(draftId, { status: 'sent' });
        try { window.dispatchEvent(new CustomEvent('oh:drafts:changed')); } catch { /* noop */ }
        // Session 14b — fire a sent-confirmation event the chat surface
        // listens for. Only dispatched after a 2xx send response, never on
        // failure or discard. Recipient name is read from the latest
        // drafts ref, falling back to the persisted draft fields.
        try {
          const sentDraft = draftsRef.current.find((d) => d.id === draftId);
          window.dispatchEvent(new CustomEvent('oh-draft-sent', {
            detail: {
              recipientName: sentDraft?.recipient?.name ?? 'recipient',
              draftId,
              sentAt: new Date().toISOString(),
            },
          }));
        } catch { /* noop */ }
      } catch (err) {
        mutateDraft(draftId, {
          status: 'failed',
          errorMessage: err instanceof Error ? err.message : 'Send failed.',
        });
      }
    },
    [mutateDraft],
  );

  const discardDraft = useCallback(
    async (draftId: string) => {
      mutateDraft(draftId, { status: 'discarded' });
      try {
        await fetch(`/api/agent/intelligence/drafts/${draftId}`, { method: 'DELETE' });
        try { window.dispatchEvent(new CustomEvent('oh:drafts:changed')); } catch { /* noop */ }
      } catch {
        // Best effort — the drawer already shows discarded. If the delete
        // failed the draft remains in pending_review in the inbox.
      }
    },
    [mutateDraft],
  );

  const editDraft = useCallback(
    async (draftId: string, patch: { subject?: string; body?: string }) => {
      try {
        const res = await fetch(`/api/agent/intelligence/drafts/${draftId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
        if (!res.ok) return;
        mutateDraft(draftId, {
          subject: patch.subject ?? undefined,
          body: patch.body ?? '',
        });
      } catch {
        /* non-fatal — edit can be retried */
      }
    },
    [mutateDraft],
  );

  const approveAll = useCallback(async () => {
    // Snapshot which drafts are sendable now. Failures + discards + sent are
    // skipped. Use current state via setState callback so we don't close over
    // stale drafts.
    let queue: string[] = [];
    setState((s) => {
      queue = s.drafts.filter((d) => d.status === 'pending' || d.status === 'approved').map((d) => d.id);
      return { ...s, bulkProgress: { total: queue.length, done: 0, failed: 0 } };
    });

    for (const id of queue) {
      await approveDraft(id);
      setState((s) => {
        if (!s.bulkProgress) return s;
        const draft = s.drafts.find((d) => d.id === id);
        const done = s.bulkProgress.done + 1;
        const failed = s.bulkProgress.failed + (draft?.status === 'failed' ? 1 : 0);
        return { ...s, bulkProgress: { ...s.bulkProgress, done, failed } };
      });
    }

    setState((s) => ({ ...s, bulkProgress: null }));
  }, [approveDraft]);

  const value = useMemo<DrawerContextValue>(
    () => ({
      ...state,
      openApprovalDrawer,
      close,
      setCursor,
      approveDraft,
      discardDraft,
      editDraft,
      approveAll,
    }),
    [state, openApprovalDrawer, close, setCursor, approveDraft, discardDraft, editDraft, approveAll],
  );

  return <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>;
}

export function useApprovalDrawer(): DrawerContextValue {
  const ctx = useContext(DrawerContext);
  if (!ctx) {
    throw new Error('useApprovalDrawer must be used within ApprovalDrawerProvider');
  }
  return ctx;
}
