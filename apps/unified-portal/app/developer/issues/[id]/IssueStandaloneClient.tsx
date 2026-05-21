'use client';

/**
 * Client wrapper for /developer/issues/[id]. Owns the local detail
 * state so the flag toggle and the new-note insert can refresh
 * without a full page reload, while keeping the shared
 * IssueDetailContent component identical to the drawer's body.
 *
 * Spec: docs/specs/assistant-v2-sprint-3.md section 6.6.
 */

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, Flag, MoreHorizontal } from 'lucide-react';
import { IssueDetailContent } from '@/components/issues/IssueDetailContent';
import { IssueDetailResponse } from '@/components/issues/types';

interface IssueStandaloneClientProps {
  initialDetail: IssueDetailResponse;
}

export function IssueStandaloneClient({ initialDetail }: IssueStandaloneClientProps) {
  const router = useRouter();
  const [detail, setDetail] = useState<IssueDetailResponse>(initialDetail);
  const [flagging, setFlagging] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/issues/${detail.report.id}`, { cache: 'no-store' });
      if (!res.ok) return;
      const json = (await res.json()) as IssueDetailResponse;
      setDetail(json);
    } catch {
      // best-effort
    }
  }, [detail.report.id]);

  const toggleFlag = async () => {
    if (flagging) return;
    setFlagging(true);
    try {
      const res = await fetch(`/api/issues/${detail.report.id}/flag`, { method: 'POST' });
      if (!res.ok) return;
      await refresh();
      router.refresh();
    } finally {
      setFlagging(false);
    }
  };

  const copyLink = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt('Copy link to issue', url);
    }
    setMenuOpen(false);
  };

  const flagged = detail.report.developer_flagged;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={() => void toggleFlag()}
          disabled={flagging}
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
      </div>

      <IssueDetailContent data={detail} onNoteAdded={() => void refresh()} />
    </div>
  );
}
