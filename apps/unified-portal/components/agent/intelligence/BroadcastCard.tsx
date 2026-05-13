'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Mail,
  Send,
  Check,
  CheckCircle,
  XCircle,
  X,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Undo2,
  Users,
} from 'lucide-react';

export type BroadcastTone = 'warm' | 'professional' | 'urgent';

export interface BroadcastFilter {
  interested_in_scheme_ids?: string[];
  has_active_enquiry?: boolean;
  viewed_property_ids?: string[];
  last_contact_before_days?: number;
  status?: string[];
}

export interface BroadcastRecipient {
  applicant_id: string | null;
  name: string;
  email: string;
  scheme_of_interest_id: string | null;
  scheme_of_interest_name: string | null;
  last_contact_date: string | null;
}

export interface BroadcastEmail {
  applicant_id: string | null;
  recipient_email: string;
  recipient_name: string;
  subject: string;
  body: string;
  selected: boolean;
}

export interface BroadcastEnvelope {
  status: 'draft';
  type: 'broadcast';
  intent: string;
  filter_used: BroadcastFilter;
  filter_natural: string;
  tone: BroadcastTone;
  recipients: BroadcastRecipient[];
  emails: BroadcastEmail[];
  shared_signoff: string;
  message: string;
}

type Phase = 'draft' | 'reviewing' | 'confirming' | 'receipt' | 'reverted' | 'cancelled' | 'error';

interface ReceiptPayload {
  broadcast_id: string;
  drafts_written: number;
  sent_at: number;
}

interface BroadcastCardProps {
  envelope: BroadcastEnvelope;
  onConfirmFailed?: (note: string) => void;
}

const UNDO_PROMINENT_MS = 30 * 1000;
const UNDO_WINDOW_MS = 30 * 60 * 1000;

const cardSurface: React.CSSProperties = {
  background: '#FFFFFF',
  borderRadius: 18,
  padding: 16,
  width: '100%',
  maxWidth: '90%',
  boxShadow:
    '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.04)',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

const sectionLabelText: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  color: '#9CA3AF',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
};

const valueText: React.CSSProperties = {
  fontSize: 13.5,
  color: '#0D0D12',
  letterSpacing: '-0.005em',
  fontWeight: 500,
};

const subduedText: React.CSSProperties = {
  fontSize: 12,
  color: '#6B7280',
};

const primaryButton: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  padding: '10px 14px',
  background: 'linear-gradient(180deg, #D4AF37 0%, #C49B2A 100%)',
  border: 'none',
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 600,
  color: '#FFFFFF',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const secondaryButton: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  padding: '10px 14px',
  background: '#F4F4F5',
  border: '0.5px solid rgba(0,0,0,0.08)',
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 600,
  color: '#374151',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const tertiaryButton: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  padding: '10px 14px',
  background: 'transparent',
  border: 'none',
  fontSize: 13,
  fontWeight: 500,
  color: '#6B7280',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const inlineInputStyle: React.CSSProperties = {
  padding: '8px 10px',
  fontSize: 13,
  border: '0.5px solid rgba(0,0,0,0.16)',
  borderRadius: 8,
  background: '#FFFFFF',
  color: '#0D0D12',
  fontFamily: 'inherit',
  width: '100%',
};

const textAreaStyle: React.CSSProperties = {
  ...inlineInputStyle,
  resize: 'vertical',
  minHeight: 160,
  lineHeight: 1.5,
  fontFamily: 'inherit',
};

function previewLine(body: string): string {
  const collapsed = body.replace(/\s+/g, ' ').trim();
  return collapsed.length > 60 ? `${collapsed.slice(0, 60)}...` : collapsed;
}

function Checkbox({ checked, disabled, onClick }: { checked: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={checked}
      className="agent-tappable"
      style={{
        width: 20,
        height: 20,
        borderRadius: 6,
        border: `1.5px solid ${checked ? '#C49B2A' : 'rgba(0,0,0,0.20)'}`,
        background: checked ? 'linear-gradient(180deg, #D4AF37 0%, #C49B2A 100%)' : '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        flexShrink: 0,
        marginTop: 2,
        padding: 0,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {checked && <Check size={14} strokeWidth={2.5} style={{ color: '#FFFFFF' }} />}
    </button>
  );
}

export default function BroadcastCard({ envelope, onConfirmFailed }: BroadcastCardProps) {
  const [emails, setEmails] = useState<BroadcastEmail[]>(envelope.emails);
  const initialSelectionKeys = useMemo(
    () => new Set(envelope.emails.filter((e) => e.selected !== false).map(emailKey)),
    [envelope.emails],
  );
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(initialSelectionKeys);
  const [recipientsExpanded, setRecipientsExpanded] = useState<boolean>(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(
    envelope.emails.length > 0 ? emailKey(envelope.emails[0]) : null,
  );
  const [phase, setPhase] = useState<Phase>('draft');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptPayload | null>(null);
  const [undoElapsed, setUndoElapsed] = useState<number>(0);

  // Tick a second-resolution counter while a receipt is visible so the undo
  // button transitions from prominent to subtle after 30 seconds and
  // disappears entirely after 30 minutes. Cheap render churn (one re-render
  // per second) confined to a single card.
  useEffect(() => {
    if (phase !== 'receipt' || !receipt) return;
    const tick = () => setUndoElapsed(Date.now() - receipt.sent_at);
    tick();
    const handle = window.setInterval(tick, 1000);
    return () => window.clearInterval(handle);
  }, [phase, receipt]);

  const selectedEmails = useMemo(
    () => emails.filter((e) => selectedKeys.has(emailKey(e))),
    [emails, selectedKeys],
  );

  function toggleRecipient(key: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function updateEmail(key: string, patch: Partial<BroadcastEmail>) {
    setEmails((prev) => prev.map((e) => (emailKey(e) === key ? { ...e, ...patch } : e)));
  }

  function expandEmail(key: string) {
    setExpandedKey((prev) => (prev === key ? null : key));
  }

  function startReview() {
    if (selectedEmails.length === 0) {
      setErrorText('Pick at least one recipient.');
      return;
    }
    setErrorText(null);
    setPhase('reviewing');
  }

  const runConfirm = useCallback(async () => {
    setPhase('confirming');
    setErrorText(null);
    try {
      const body = {
        draft: { ...envelope, emails },
        selected_emails: selectedEmails.map((e) => ({
          applicant_id: e.applicant_id,
          recipient_email: e.recipient_email,
          recipient_name: e.recipient_name,
          subject: e.subject,
          body: e.body,
          selected: true,
        })),
      };
      const res = await fetch('/api/agent-intelligence/confirm-broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Couldn't queue the broadcast");
      }
      const data = await res.json();
      if (!data?.broadcast_id) throw new Error('Broadcast returned no audit id.');
      setReceipt({
        broadcast_id: data.broadcast_id,
        drafts_written: typeof data.drafts_written === 'number' ? data.drafts_written : selectedEmails.length,
        sent_at: Date.now(),
      });
      setPhase('receipt');
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't queue the broadcast";
      setErrorText(message);
      setPhase('error');
      onConfirmFailed?.(
        `Broadcast failed, no emails were queued. Reason: ${message}`,
      );
    }
  }, [envelope, emails, selectedEmails, onConfirmFailed]);

  async function runUndo() {
    if (!receipt) return;
    try {
      const res = await fetch('/api/agent-intelligence/cancel-broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audit_log_id: receipt.broadcast_id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Couldn't undo the broadcast");
      }
      setPhase('reverted');
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't undo the broadcast";
      setErrorText(message);
    }
  }

  function cancelDraft() {
    // TODO: remove after freeze diagnosis (cancel-freeze diagnostic PR).
    console.time('[FREEZE_DIAG] BroadcastCard.cancelDraft');
    console.log('[FREEZE_DIAG] cancel start', {
      card: 'BroadcastCard',
      phase,
      recipientCount: envelope.recipients.length,
      emailCount: emails.length,
      timestamp: Date.now(),
    });
    setPhase('cancelled');
    queueMicrotask(() => {
      console.timeEnd('[FREEZE_DIAG] BroadcastCard.cancelDraft');
    });
  }

  if (phase === 'cancelled') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <div style={{ ...cardSurface, gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <X size={16} strokeWidth={2} style={{ color: '#9CA3AF' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#6B7280' }}>Nothing sent</span>
          </div>
          <span style={{ fontSize: 12.5, color: '#6B7280' }}>Cancelled before queueing.</span>
        </div>
      </div>
    );
  }

  if (phase === 'reverted') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <div style={{ ...cardSurface, gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Undo2 size={16} strokeWidth={2} style={{ color: '#6B7280' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Reverted</span>
          </div>
          <span style={{ fontSize: 12.5, color: '#6B7280' }}>
            Pending drafts deleted. Nothing went out.
          </span>
        </div>
      </div>
    );
  }

  if (phase === 'receipt' && receipt) {
    const undoVisible = undoElapsed < UNDO_WINDOW_MS;
    const undoProminent = undoElapsed < UNDO_PROMINENT_MS;
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <div style={cardSurface}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle size={16} strokeWidth={2.25} style={{ color: '#C49B2A' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#0D0D12' }}>
              {receipt.drafts_written} email{receipt.drafts_written === 1 ? '' : 's'} queued for sending
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/agent/drafts" style={{ ...subduedText, fontWeight: 600, color: '#0D0D12', textDecoration: 'underline' }}>
              Open in Drafts
            </Link>
            {undoVisible && (
              undoProminent ? (
                <button type="button" onClick={runUndo} style={secondaryButton} className="agent-tappable">
                  <Undo2 size={13} strokeWidth={2.25} />
                  Undo
                </button>
              ) : (
                <button type="button" onClick={runUndo} style={tertiaryButton} className="agent-tappable">
                  Undo
                </button>
              )
            )}
          </div>
          {errorText && (
            <span style={{ ...subduedText, color: '#B91C1C' }}>{errorText}</span>
          )}
        </div>
      </div>
    );
  }

  const isError = phase === 'error';
  const isConfirming = phase === 'confirming';
  const isReviewing = phase === 'reviewing';
  const cardSurfaceForPhase: React.CSSProperties = isError
    ? {
        ...cardSurface,
        border: '1px solid rgba(220,38,38,0.45)',
        boxShadow:
          '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(220,38,38,0.10), 0 0 0 0.5px rgba(220,38,38,0.20)',
      }
    : cardSurface;

  const headerLabel = isError
    ? "Couldn't queue"
    : selectedEmails.length === 1
      ? 'Draft 1 email for review'
      : `Draft ${selectedEmails.length} emails for review`;

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
      <div style={cardSurfaceForPhase}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isError ? (
            <AlertTriangle size={16} strokeWidth={2.25} style={{ color: '#B91C1C' }} />
          ) : (
            <Mail size={16} strokeWidth={2} style={{ color: '#0D0D12' }} />
          )}
          <span style={{ fontSize: 13, fontWeight: 600, color: isError ? '#B91C1C' : '#0D0D12' }}>
            {headerLabel}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ ...subduedText }}>To: {envelope.filter_natural}</span>
          <span style={{ ...subduedText, color: '#9CA3AF', fontStyle: 'italic' }}>
            {envelope.intent.length > 140 ? `${envelope.intent.slice(0, 140)}...` : envelope.intent}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button
            type="button"
            onClick={() => setRecipientsExpanded((v) => !v)}
            className="agent-tappable"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 10px',
              background: '#FAFAFA',
              border: '0.5px solid rgba(0,0,0,0.06)',
              borderRadius: 10,
              fontSize: 12.5,
              fontWeight: 600,
              color: '#374151',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <Users size={13} strokeWidth={2} style={{ color: '#6B7280' }} />
            <span style={{ flex: 1, textAlign: 'left' }}>
              Recipients ({selectedEmails.length}/{emails.length})
            </span>
            {recipientsExpanded ? <ChevronUp size={14} strokeWidth={2} /> : <ChevronDown size={14} strokeWidth={2} />}
          </button>

          {recipientsExpanded && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {emails.map((e) => {
                const key = emailKey(e);
                const checked = selectedKeys.has(key);
                return (
                  <div
                    key={`r-${key}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 10px',
                      background: checked ? '#FFFFFF' : '#FAFAFA',
                      border: `0.5px solid ${checked ? 'rgba(0,0,0,0.10)' : 'rgba(0,0,0,0.06)'}`,
                      borderRadius: 10,
                    }}
                  >
                    <Checkbox
                      checked={checked}
                      disabled={isConfirming || isReviewing}
                      onClick={() => toggleRecipient(key)}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                      <span style={{ ...valueText, fontSize: 13 }}>{e.recipient_name}</span>
                      <span style={{ ...subduedText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.recipient_email}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={sectionLabelText}>Emails</span>
          {selectedEmails.length === 0 ? (
            <span style={{ ...subduedText }}>No recipients selected.</span>
          ) : (
            selectedEmails.map((e, idx) => {
              const key = emailKey(e);
              const expanded = expandedKey === key;
              if (!expanded) {
                return (
                  <button
                    key={`e-${key}`}
                    type="button"
                    onClick={() => expandEmail(key)}
                    className="agent-tappable"
                    disabled={isConfirming || isReviewing}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 12px',
                      background: '#FFFFFF',
                      border: '0.5px solid rgba(0,0,0,0.08)',
                      borderRadius: 12,
                      cursor: isConfirming || isReviewing ? 'default' : 'pointer',
                      fontFamily: 'inherit',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                      <span style={{ ...valueText, fontSize: 13 }}>{e.recipient_name}</span>
                      <span style={{ ...subduedText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {previewLine(e.body)}
                      </span>
                    </div>
                    <ChevronDown size={14} strokeWidth={2} style={{ color: '#6B7280' }} />
                  </button>
                );
              }
              return (
                <div
                  key={`e-${key}`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    padding: '12px 12px',
                    background: '#FFFFFF',
                    border: '0.5px solid rgba(0,0,0,0.12)',
                    borderRadius: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ ...subduedText, fontWeight: 600, color: '#374151' }}>
                      To: {e.recipient_name}
                    </span>
                    <span style={{ ...subduedText }}>{e.recipient_email}</span>
                    <span style={{ flex: 1 }} />
                    {idx < selectedEmails.length - 1 && (
                      <button
                        type="button"
                        onClick={() => expandEmail(key)}
                        className="agent-tappable"
                        style={{
                          ...tertiaryButton,
                          padding: '4px 8px',
                          fontSize: 12,
                        }}
                        disabled={isConfirming || isReviewing}
                      >
                        Collapse
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={sectionLabelText}>Subject</span>
                    <input
                      type="text"
                      value={e.subject}
                      onChange={(ev) => updateEmail(key, { subject: ev.target.value })}
                      disabled={isConfirming || isReviewing}
                      style={inlineInputStyle}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={sectionLabelText}>Body</span>
                    <textarea
                      value={e.body}
                      onChange={(ev) => updateEmail(key, { body: ev.target.value })}
                      disabled={isConfirming || isReviewing}
                      rows={10}
                      style={textAreaStyle}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {errorText && (
          <span style={{ ...subduedText, color: '#B91C1C' }}>{errorText}</span>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {isReviewing ? (
            <>
              <span style={{ ...subduedText, marginRight: 4 }}>
                Send {selectedEmails.length} email{selectedEmails.length === 1 ? '' : 's'} now?
              </span>
              <button type="button" style={primaryButton} onClick={runConfirm} className="agent-tappable">
                <Send size={14} strokeWidth={2.25} />
                Confirm
              </button>
              <button type="button" style={tertiaryButton} onClick={() => setPhase('draft')} className="agent-tappable">
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                style={primaryButton}
                onClick={isError ? runConfirm : startReview}
                disabled={isConfirming || selectedEmails.length === 0}
                className="agent-tappable"
              >
                {isConfirming ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Queueing emails
                  </>
                ) : (
                  <>
                    <Send size={14} strokeWidth={2.25} />
                    {isError ? 'Try again' : `Approve and send all (${selectedEmails.length})`}
                  </>
                )}
              </button>
              <button type="button" style={tertiaryButton} onClick={cancelDraft} className="agent-tappable" disabled={isConfirming}>
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function emailKey(e: BroadcastEmail): string {
  return e.applicant_id ?? `email:${e.recipient_email.toLowerCase()}`;
}
