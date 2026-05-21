'use client';

/**
 * Right-side detail drawer. Spec section 6.5.
 *
 * - 560px on desktop, full-screen on mobile.
 * - Backdrop dims the list behind it on desktop; mobile is opaque.
 * - Header has Close, Flag toggle, and a Menu (Copy link to issue).
 * - Body delegates to IssueDetailContent (the shared component used by
 *   /developer/issues/[id] as well).
 * - The drawer syncs to ?issue=<id> via the parent (IssuesDashboardClient
 *   manages the URL); this component just calls onClose to clear it.
 *
 * Fetches /api/issues/[id] when issueId changes. Re-fetches when the
 * user toggles the flag or after a note is added (so the timeline
 * picks up the new events).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy, Flag, MoreHorizontal, X } from 'lucide-react';
import { IssueDetailContent } from './IssueDetailContent';
import { IssueDetailResponse } from './types';

interface IssueDetailDrawerProps {
  issueId: string | null;
  onClose: () => void;
  onFlagChanged?: (issueId: string, flagged: boolean) => void;
  onNotesChanged?: (issueId: string) => void;
}

export function IssueDetailDrawer({
  issueId,
  onClose,
  onFlagChanged,
  onNotesChanged,
}: IssueDetailDrawerProps) {
  const [data, setData] = useState<IssueDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flagging, setFlagging] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!issueId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/issues/${issueId}`, { cache: 'no-store' });
      if (!res.ok) {
        setError(res.status === 404 ? 'Issue not found.' : "Couldn't load this issue.");
        return;
      }
      const json = (await res.json()) as IssueDetailResponse;
      setData(json);
    } catch {
      setError("Couldn't load this issue.");
    } finally {
      setLoading(false);
    }
  }, [issueId]);

  useEffect(() => {
    if (!issueId) {
      setData(null);
      setError(null);
      setMenuOpen(false);
      setCopied(false);
      return;
    }
    void load();
  }, [issueId, load]);

  useEffect(() => {
    if (!issueId) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = prev;
    };
  }, [issueId, onClose]);

  const flagged = data?.report.developer_flagged ?? false;

  const toggleFlag = async () => {
    if (!issueId || flagging) return;
    setFlagging(true);
    try {
      const res = await fetch(`/api/issues/${issueId}/flag`, { method: 'POST' });
      if (!res.ok) return;
      const json = await res.json();
      const nextFlagged = !!json.developer_flagged;
      onFlagChanged?.(issueId, nextFlagged);
      await load();
    } finally {
      setFlagging(false);
    }
  };

  const copyLink = async () => {
    if (!issueId) return;
    const url = new URL(`/developer/issues/${issueId}`, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt('Copy link to issue', url);
    }
    setMenuOpen(false);
  };

  if (!issueId) return null;

  return (
    <div
      className="fixed inset-0 z-modal flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Issue detail"
    >
      <button
        type="button"
        aria-label="Close issue detail"
        onClick={onClose}
        className="absolute inset-0 bg-neutral-900/40"
      />

      <div
        ref={containerRef}
        className="relative bg-white w-full sm:w-[560px] sm:max-w-[560px] h-full shadow-2xl flex flex-col overflow-hidden animate-fade-in"
      >
        <header className="flex items-center gap-1 px-4 py-3 border-b border-neutral-200 bg-white">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 -ml-2 flex items-center justify-center rounded-lg text-neutral-700 hover:bg-neutral-100"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => void toggleFlag()}
            disabled={flagging || !data}
            aria-pressed={flagged}
            title={flagged ? 'Remove flag' : 'Flag for attention'}
            className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors disabled:opacity-50 ${
              flagged
                ? 'bg-brand-50 text-brand-600 hover:bg-brand-100'
                : 'text-neutral-700 hover:bg-neutral-100'
            }`}
          >
            <Flag className={`w-5 h-5 ${flagged ? 'fill-current' : ''}`} />
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="More options"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="w-10 h-10 flex items-center justify-center rounded-lg text-neutral-700 hover:bg-neutral-100"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
            {menuOpen ? (
              <>
                <button
                  type="button"
                  aria-hidden
                  tabIndex={-1}
                  onClick={() => setMenuOpen(false)}
                  className="fixed inset-0 z-10 bg-transparent cursor-default"
                />
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-1 z-20 min-w-[12rem] rounded-lg border border-neutral-200 bg-white shadow-lg py-1"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void copyLink()}
                    className="w-full px-3 py-2 text-left text-body-sm text-neutral-800 hover:bg-neutral-50 flex items-center gap-2"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4 text-neutral-500" />
                    )}
                    {copied ? 'Copied' : 'Copy link to issue'}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loading && !data ? (
            <div className="text-body-sm text-neutral-500">Loading issue...</div>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-body-sm text-red-700">
              {error}
            </div>
          ) : data ? (
            <IssueDetailContent
              data={data}
              onNoteAdded={() => {
                onNotesChanged?.(issueId);
                void load();
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
