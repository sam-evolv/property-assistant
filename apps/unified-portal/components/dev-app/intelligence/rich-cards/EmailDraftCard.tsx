'use client';

import { useState } from 'react';
import { Mail, Check, Edit3 } from 'lucide-react';

interface EmailDraftData {
  to: string;
  subject: string;
  body: string;
  sent: boolean;
  sent_at?: string;
  related_units?: string[];
}

interface EmailDraftCardProps {
  data: EmailDraftData;
  onSend?: () => Promise<void> | void;
  onEdit?: (body: string) => void;
}

export default function EmailDraftCard({ data, onSend, onEdit }: EmailDraftCardProps) {
  const [sent, setSent] = useState(data.sent);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(false);

  const handleSend = async () => {
    if (sent || sending) return;
    setSending(true);
    setError(false);
    try {
      await onSend?.();
      setSent(true);
    } catch {
      setError(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-xl border border-[#f3f4f6] overflow-hidden bg-white">
      <div className="px-3.5 py-2.5 bg-[#f9fafb] border-b border-[#f3f4f6] flex items-center gap-2">
        <Mail size={14} className="text-[#D4AF37]" />
        <span className="text-[12px] font-bold text-[#111827]">
          {sent ? 'Email Sent' : 'Email Draft'}
        </span>
      </div>

      <div className="px-3.5 py-2.5 space-y-1.5">
        <div>
          <span className="text-[11px] text-[#9ca3af]">To: </span>
          <span className="text-[12px] text-[#111827]">{data.to}</span>
        </div>
        <div>
          <span className="text-[11px] text-[#9ca3af]">Subject: </span>
          <span className="text-[12px] font-medium text-[#111827]">
            {data.subject}
          </span>
        </div>
        <div className="pt-1 border-t border-[#f3f4f6]">
          <p className="text-[12px] text-[#374151] whitespace-pre-wrap leading-relaxed">
            {data.body}
          </p>
        </div>
      </div>

      {!sent ? (
        <div className="px-3.5 pb-3 space-y-2">
          {error && (
            <p className="text-[11px] text-red-500 text-center">Failed to send. Please try again.</p>
          )}
          <div className="flex gap-2">
          <button
            onClick={handleSend}
            disabled={sending}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-semibold text-white transition active:scale-[0.97] disabled:opacity-50"
            style={{ backgroundColor: '#D4AF37' }}
          >
            {sending ? 'Sending...' : error ? 'Retry' : 'Send'}
          </button>
          <button
            onClick={() => onEdit?.(data.body)}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium text-[#6b7280] bg-[#f3f4f6] transition active:scale-[0.97]"
          >
            <Edit3 size={12} />
            Edit
          </button>
          </div>
        </div>
      ) : (
        <div className="px-3.5 pb-3">
          <div className="flex items-center gap-1.5 py-2 justify-center text-[12px] font-semibold text-[#059669]">
            <Check size={14} />
            Sent successfully
          </div>
        </div>
      )}
    </div>
  );
}
