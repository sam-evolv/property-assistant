'use client';

/**
 * Sprint 3.5a mark-for-warranty modal. A required documentation note
 * is captured as an issue_notes row and the issue moves to resolved
 * with resolution_type='warranty_referral'. Unlike the escalate modal
 * the note is required because warranty referrals need documentation.
 *
 * Calls POST /api/homeowners/issues/[issue_id]/warranty on submit.
 */

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { toast } from 'react-hot-toast';

const MAX_LEN = 2000;

interface WarrantyModalProps {
  open: boolean;
  onClose: () => void;
  issueId: string;
  onResolved: () => void;
}

export function WarrantyModal({ open, onClose, issueId, onResolved }: WarrantyModalProps) {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const trimmed = note.trim();
  const canSubmit = trimmed.length > 0 && trimmed.length <= MAX_LEN && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/homeowners/issues/${issueId}/warranty`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ note: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? 'Could not mark for warranty');
      }
      toast.success('Marked for warranty.');
      setNote('');
      onResolved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not mark for warranty');
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
                Mark for warranty
              </Dialog.Title>
              <Dialog.Description className="text-sm text-gray-500 mt-1">
                Record a note about how this should be handled by warranty. The issue will close on the dashboard but remain searchable.
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
            <label className="block text-sm font-medium text-gray-700">Warranty note</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              maxLength={MAX_LEN}
              placeholder="How should this be handled by warranty?"
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
              disabled={!canSubmit}
              className="px-4 py-2 text-sm font-medium text-white bg-gold-500 hover:bg-gold-600 rounded-lg transition disabled:bg-gold-300 disabled:cursor-not-allowed"
            >
              {submitting ? 'Marking...' : 'Mark for warranty'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
