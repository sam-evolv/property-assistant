'use client';

/**
 * Sprint 3.5a escalate-to-snag-list modal. Confirms the escalation
 * and accepts an optional note. The issue moves to source =
 * 'homeowner_escalated' and status = 'open', which makes it appear in
 * the regular /developer/issues dashboard and unit grouped view.
 *
 * Calls POST /api/homeowners/issues/[issue_id]/escalate on submit.
 */

import { useState } from 'react';
import Link from 'next/link';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowRight, CheckCircle2, X } from 'lucide-react';
import { toast } from 'react-hot-toast';

const MAX_LEN = 2000;

interface EscalateModalProps {
  open: boolean;
  onClose: () => void;
  issueId: string;
  onResolved: () => void;
}

export function EscalateModal({ open, onClose, issueId, onResolved }: EscalateModalProps) {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const trimmed = note.trim();
  const tooLong = trimmed.length > MAX_LEN;

  const handleSubmit = async () => {
    if (submitting || tooLong) return;
    setSubmitting(true);
    try {
      const payload: { note?: string } = {};
      if (trimmed) payload.note = trimmed;
      const res = await fetch(`/api/homeowners/issues/${issueId}/escalate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? 'Could not escalate issue');
      }
      toast.custom(
        (t) => (
          <div
            className={`bg-white rounded-xl border border-gray-200 shadow-lg p-4 flex items-start gap-3 min-w-[320px] max-w-[440px] ${
              t.visible ? 'animate-in slide-in-from-right-full fade-in' : 'animate-out fade-out'
            }`}
          >
            <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">
                Escalated to snag list. Now visible in Issues dashboard.
              </p>
              <Link
                href={`/developer/issues?issue=${issueId}`}
                onClick={() => toast.dismiss(t.id)}
                className="inline-flex items-center gap-1 text-xs font-medium text-gold-700 hover:text-gold-800 mt-2"
              >
                View in Issues dashboard
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <button
              type="button"
              onClick={() => toast.dismiss(t.id)}
              className="p-1 rounded-lg hover:bg-black/5 transition-colors flex-shrink-0"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        ),
        { duration: 8000 },
      );
      setNote('');
      onResolved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not escalate issue');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && !submitting) {
      setNote('');
      onClose();
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-in fade-in duration-150" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[95vw] max-w-lg bg-white rounded-xl shadow-xl focus:outline-none animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-start justify-between p-5 border-b border-gray-100">
            <div>
              <Dialog.Title className="text-lg font-semibold text-gray-900">
                Escalate to snag list?
              </Dialog.Title>
              <Dialog.Description className="text-sm text-gray-500 mt-1">
                This issue will move into the operational snag workflow. The homeowner will still be linked. A site team member can resolve it from there.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Close"
                disabled={submitting}
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </Dialog.Close>
          </div>

          <div className="p-5 space-y-3">
            <label className="block text-sm font-medium text-gray-700">Note (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              maxLength={MAX_LEN}
              placeholder="Add any context for the site team..."
              disabled={submitting}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500/40 focus:border-gold-400 text-sm resize-y disabled:bg-gray-50"
            />
            <div className="flex justify-end text-xs text-gray-400">
              {note.length} / {MAX_LEN}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-xl">
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || tooLong}
              className="px-4 py-2 text-sm font-medium text-white bg-gold-500 hover:bg-gold-600 rounded-lg transition disabled:bg-gold-300 disabled:cursor-not-allowed"
            >
              {submitting ? 'Escalating...' : 'Escalate'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
