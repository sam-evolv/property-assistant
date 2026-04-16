'use client';

import { useEffect, useState } from 'react';
import {
  Award,
  ChevronDown,
  ClipboardList,
  FileText,
  Shield,
  Sparkles,
  X,
} from 'lucide-react';
import { Submission, SYSTEM_LABELS } from './mock-data';

const FILE_ICON = {
  'file-text': FileText,
  award: Award,
  shield: Shield,
  'clipboard-list': ClipboardList,
} as const;

interface ApproveConfirmModalProps {
  open: boolean;
  submission: Submission | null;
  onClose: () => void;
  onConfirm: (addReminder: boolean) => void;
}

export function ApproveConfirmModal({
  open,
  submission,
  onClose,
  onConfirm,
}: ApproveConfirmModalProps) {
  const [addReminder, setAddReminder] = useState(true);

  useEffect(() => {
    if (open) setAddReminder(true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open || !submission) return null;

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center px-4 py-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white rounded-xl shadow-xl w-full max-w-[560px] max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-4 border-b border-[#EAEAE4] flex items-start justify-between">
          <div>
            <h3 className="text-[17px] font-semibold text-[#111111] tracking-[-0.01em]">
              Approve and File Submission
            </h3>
            <p className="mt-1 text-[13px] text-[#8A8A82]">
              Review the AI&apos;s filing plan before confirming
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-md text-[#8A8A82] hover:text-[#111111] hover:bg-[#F3F3EF] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
            aria-label="Close"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="flex flex-col gap-2">
            {submission.files.map((file) => {
              const Icon = FILE_ICON[file.icon];
              return (
                <div
                  key={file.id}
                  className="flex items-start gap-3 p-3 bg-[#F7F7F4] border border-[#EAEAE4] rounded-lg"
                >
                  <div className="w-8 h-8 rounded-md bg-[#FDF9EB] text-[#D4AF37] flex items-center justify-center flex-shrink-0">
                    <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-[#111111] truncate">
                      {file.name}
                    </div>
                    <div className="text-[11.5px] text-[#8A8A82] mt-0.5">
                      will file to:{' '}
                      <span className="text-[#4B4B46] font-medium">
                        {SYSTEM_LABELS[file.autoClassifiedAs.system]} &gt;{' '}
                        {file.autoClassifiedAs.clientFolder} &gt;{' '}
                        {file.autoClassifiedAs.jobRef}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] text-[#D4AF37] font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] rounded"
                    >
                      Change destination
                      <ChevronDown className="w-3 h-3" strokeWidth={1.75} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <label className="mt-4 flex items-center gap-3 p-3 bg-[#FDF9EB] border border-[#F0E2B0] rounded-lg cursor-pointer">
            <button
              type="button"
              role="switch"
              aria-checked={addReminder}
              onClick={() => setAddReminder((v) => !v)}
              className={`relative w-9 h-5 rounded-full transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] ${
                addReminder ? 'bg-[#D4AF37]' : 'bg-[#D9D9D1]'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-150 ${
                  addReminder ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
            <div className="flex items-center gap-2 text-[13px] text-[#111111] font-medium">
              <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" strokeWidth={2} />
              Add 30-day follow-up reminder to calendar
            </div>
          </label>
        </div>

        <div className="px-6 py-4 border-t border-[#EAEAE4] flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 bg-transparent text-[#4B4B46] border border-[#EAEAE4] rounded-lg text-[13px] font-medium hover:bg-[#F3F3EF] hover:text-[#111111] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(addReminder)}
            className="px-4 py-2 bg-[#D4AF37] text-[#0B0C0F] rounded-lg text-[13px] font-semibold hover:bg-[#E8C964] hover:shadow-[0_4px_14px_rgba(212,175,55,0.25)] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
          >
            Confirm &amp; File all
          </button>
        </div>
      </div>
    </div>
  );
}
