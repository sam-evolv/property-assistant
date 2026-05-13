'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  UserPlus,
  UserCog,
  UserMinus,
  Check,
  X,
  ArrowRight,
  AlertTriangle,
  Loader2,
  Undo2,
  Mail,
  Phone,
} from 'lucide-react';

export interface ApplicantCandidatePayload {
  full_name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  source: string;
  classification: 'new' | 'duplicate_likely';
  existing_match?: { id: string; full_name: string; email: string | null };
}

export interface ApplicantUpdateDraftPayload {
  applicant_id: string;
  full_name: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  changed_fields: string[];
}

export interface ApplicantRemoveDraftPayload {
  applicant_id: string;
  full_name: string;
  has_dependencies: boolean;
  dependency_summary: string | null;
}

export type ApplicantDraftEnvelope =
  | {
      status: 'draft';
      action: 'add';
      mode: 'always_confirm' | 'propose_undoable';
      candidates: ApplicantCandidatePayload[];
      message: string;
    }
  | {
      status: 'draft';
      action: 'update';
      mode: 'always_confirm' | 'propose_undoable';
      draft: ApplicantUpdateDraftPayload;
      message: string;
    }
  | {
      status: 'draft';
      action: 'remove';
      mode: 'always_confirm' | 'propose_undoable';
      drafts: ApplicantRemoveDraftPayload[];
      message: string;
    };

interface ApplicantCardProps {
  envelope: ApplicantDraftEnvelope;
  /**
   * Called when the confirm path fails irrecoverably so the chat surface
   * can append a system-style note to the assistant message. Without this,
   * the next-turn LLM history would still claim "Added Mary..." even though
   * nothing was written. Bug 4 fix.
   */
  onConfirmFailed?: (note: string) => void;
}

type Phase = 'draft' | 'confirming' | 'receipt' | 'reverted' | 'cancelled' | 'error';

interface ReceiptInfo {
  action: 'add' | 'update' | 'remove';
  summary: string;
  audit_log_ids: string[];
  detail_link: string | null;
  detail_label: string;
}

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

const labelText: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: '#6B7280',
  letterSpacing: 0,
};

const valueText: React.CSSProperties = {
  fontSize: 13.5,
  color: '#0D0D12',
  letterSpacing: '-0.005em',
  fontWeight: 500,
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

const undoButton: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 12px',
  background: '#0D0D12',
  border: 'none',
  borderRadius: 999,
  fontSize: 12.5,
  fontWeight: 600,
  color: '#FFFFFF',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const undoLink: React.CSSProperties = {
  fontSize: 12.5,
  fontWeight: 500,
  color: '#6B7280',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
  padding: 0,
};

function actionIcon(action: 'add' | 'update' | 'remove') {
  if (action === 'add') return UserPlus;
  if (action === 'update') return UserCog;
  return UserMinus;
}

function buildReceiptDetailLink(action: 'add' | 'update' | 'remove', ids: string[], applicantId?: string): { link: string | null; label: string } {
  if (action === 'add') {
    if (ids.length === 1 && applicantId) return { link: `/agent/applicants?focus=${encodeURIComponent(applicantId)}`, label: 'Open in Applicants' };
    if (ids.length > 1) return { link: '/agent/applicants?filter=recent', label: 'Open in Applicants' };
    return { link: null, label: '' };
  }
  if (action === 'update' && applicantId) {
    return { link: `/agent/applicants?focus=${encodeURIComponent(applicantId)}`, label: 'Open in Applicants' };
  }
  return { link: null, label: '' };
}

export default function ApplicantCard({ envelope, onConfirmFailed }: ApplicantCardProps) {
  const initialSelected = useMemo<Set<number>>(() => {
    if (envelope.action !== 'add') return new Set();
    const out = new Set<number>();
    envelope.candidates.forEach((_, idx) => out.add(idx));
    return out;
  }, [envelope]);

  const [selected, setSelected] = useState<Set<number>>(initialSelected);
  const [phase, setPhase] = useState<Phase>('draft');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptInfo | null>(null);
  const [undoVisible, setUndoVisible] = useState<'prominent' | 'subtle' | 'gone'>('gone');
  const autoConfirmedRef = useRef(false);

  const isUndoable =
    envelope.action === 'add' &&
    envelope.mode === 'propose_undoable' &&
    envelope.candidates.every((c) => c.classification === 'new');

  // Auto-confirm path for propose_undoable adds with no duplicates.
  useEffect(() => {
    if (autoConfirmedRef.current) return;
    if (!isUndoable) return;
    if (phase !== 'draft') return;
    autoConfirmedRef.current = true;
    void runConfirm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUndoable]);

  // Step the undo affordance from prominent → subtle → gone.
  useEffect(() => {
    if (phase !== 'receipt') return;
    if (!receipt || receipt.audit_log_ids.length === 0) return;
    setUndoVisible('prominent');
    const t1 = setTimeout(() => setUndoVisible('subtle'), 30_000);
    const t2 = setTimeout(() => setUndoVisible('gone'), 30 * 60 * 1000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [phase, receipt]);

  function toggleCandidate(idx: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  async function runConfirm() {
    setPhase('confirming');
    setErrorText(null);
    try {
      let body: any;
      if (envelope.action === 'add') {
        body = {
          action: 'add',
          candidates: envelope.candidates,
          selected_indices: Array.from(selected.values()).sort((a, b) => a - b),
        };
      } else if (envelope.action === 'update') {
        body = { action: 'update', draft: envelope.draft };
      } else {
        body = { action: 'remove', drafts: envelope.drafts };
      }
      const res = await fetch('/api/agent-intelligence/confirm-applicants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Could not save changes');
      }
      const data = await res.json();
      const action = data.action as 'add' | 'update' | 'remove';
      if (action === 'add') {
        const created: Array<{ id: string; full_name: string; audit_log_id: string }> = data.result?.created ?? [];
        const ids = created.map((c) => c.audit_log_id).filter(Boolean);
        const applicantId = created.length === 1 ? created[0].id : undefined;
        const { link, label } = buildReceiptDetailLink('add', ids, applicantId);
        setReceipt({
          action: 'add',
          summary:
            created.length === 1
              ? `Added ${created[0].full_name}.`
              : `Added ${created.length} applicants.`,
          audit_log_ids: ids,
          detail_link: link,
          detail_label: label,
        });
      } else if (action === 'update') {
        const r = data.result as { id: string; full_name: string; audit_log_id: string };
        const { link, label } = buildReceiptDetailLink('update', [r.audit_log_id], r.id);
        setReceipt({
          action: 'update',
          summary: `Updated ${r.full_name}.`,
          audit_log_ids: [r.audit_log_id].filter(Boolean),
          detail_link: link,
          detail_label: label,
        });
      } else {
        const removed: Array<{ id: string; full_name: string; audit_log_id: string }> = data.result?.removed ?? [];
        const ids = removed.map((r) => r.audit_log_id).filter(Boolean);
        setReceipt({
          action: 'remove',
          summary:
            removed.length === 1
              ? `Removed ${removed[0].full_name}.`
              : `Removed ${removed.length} applicants.`,
          audit_log_ids: ids,
          detail_link: null,
          detail_label: '',
        });
      }
      setPhase('receipt');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save changes';
      setErrorText(message);
      setPhase('error');
      // Bug 4: tell the chat surface so the assistant message picks up a
      // visible "no applicants were created" note. The next-turn history
      // then carries the truth instead of the model's confident lie.
      const noteByAction =
        envelope.action === 'add'
          ? 'Add operation failed, no applicants were created.'
          : envelope.action === 'update'
            ? 'Update operation failed, no changes saved.'
            : 'Remove operation failed, no applicants were removed.';
      onConfirmFailed?.(noteByAction);
    }
  }

  async function runUndo() {
    if (!receipt) return;
    setPhase('confirming');
    try {
      for (const id of receipt.audit_log_ids) {
        const res = await fetch('/api/agent-intelligence/undo-applicants', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audit_log_id: id }),
        });
        if (!res.ok) throw new Error('Undo failed');
      }
      setPhase('reverted');
      setUndoVisible('gone');
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'Undo failed');
      setPhase('receipt');
    }
  }

  function cancel() {
    // TODO: remove after freeze diagnosis (cancel-freeze diagnostic PR).
    console.time('[FREEZE_DIAG] ApplicantCard.cancel');
    console.log('[FREEZE_DIAG] cancel start', {
      card: 'ApplicantCard',
      action: envelope.action,
      phase,
      timestamp: Date.now(),
    });
    setPhase('cancelled');
    queueMicrotask(() => {
      console.timeEnd('[FREEZE_DIAG] ApplicantCard.cancel');
    });
  }

  const Icon = actionIcon(envelope.action);

  if (phase === 'cancelled') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <div style={{ ...cardSurface, gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <X size={16} strokeWidth={2} style={{ color: '#9CA3AF' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#6B7280' }}>Nothing changed</span>
          </div>
          <span style={{ fontSize: 12.5, color: '#6B7280' }}>Cancelled before save.</span>
        </div>
      </div>
    );
  }

  if (phase === 'reverted' && receipt) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <div style={cardSurface}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Undo2 size={16} strokeWidth={2.25} style={{ color: '#10703C' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#0D0D12' }}>Reverted</span>
          </div>
          <span style={{ fontSize: 12.5, color: '#6B7280', textDecoration: 'line-through' }}>
            {receipt.summary}
          </span>
        </div>
      </div>
    );
  }

  if (phase === 'receipt' && receipt) {
    const showUndo =
      receipt.audit_log_ids.length > 0 && undoVisible !== 'gone';
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <div style={cardSurface}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Check size={16} strokeWidth={2.25} style={{ color: '#10703C' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#0D0D12' }}>{receipt.summary}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {receipt.detail_link && (
              <Link
                href={receipt.detail_link}
                className="agent-tappable"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 12px',
                  background: '#F4F4F5',
                  border: '0.5px solid rgba(0,0,0,0.08)',
                  borderRadius: 999,
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: '#0D0D12',
                  textDecoration: 'none',
                }}
              >
                <span>{receipt.detail_label}</span>
                <ArrowRight size={13} strokeWidth={2.25} />
              </Link>
            )}
            {showUndo && (
              undoVisible === 'prominent' ? (
                <button type="button" style={undoButton} onClick={runUndo} className="agent-tappable">
                  <Undo2 size={13} strokeWidth={2.25} />
                  Undo
                </button>
              ) : (
                <button type="button" style={undoLink} onClick={runUndo} className="agent-tappable">
                  Undo
                </button>
              )
            )}
          </div>
          {errorText && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#B91C1C' }}>
              <AlertTriangle size={13} strokeWidth={2.25} />
              <span style={{ fontSize: 12.5 }}>{errorText}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Draft phase, with shape-specific body.
  const titleByAction =
    envelope.action === 'add'
      ? envelope.candidates.length === 1
        ? `Add ${envelope.candidates[0].full_name}`
        : `Add ${envelope.candidates.length} applicants`
      : envelope.action === 'update'
        ? `Update ${envelope.draft.full_name}`
        : envelope.drafts.length === 1
          ? `Remove ${envelope.drafts[0].full_name}`
          : `Remove ${envelope.drafts.length} applicants`;

  const isErrorPhase = phase === 'error';
  const errorTitleByAction =
    envelope.action === 'add'
      ? "Couldn't add applicants"
      : envelope.action === 'update'
        ? "Couldn't update applicant"
        : "Couldn't remove applicants";
  const cardSurfaceForPhase: React.CSSProperties = isErrorPhase
    ? {
        ...cardSurface,
        border: '1px solid rgba(220,38,38,0.45)',
        boxShadow:
          '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(220,38,38,0.10), 0 0 0 0.5px rgba(220,38,38,0.20)',
      }
    : cardSurface;

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
      <div style={cardSurfaceForPhase}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isErrorPhase ? (
            <AlertTriangle size={16} strokeWidth={2.25} style={{ color: '#B91C1C' }} />
          ) : (
            <Icon size={16} strokeWidth={2} style={{ color: '#0D0D12' }} />
          )}
          <span style={{ fontSize: 13, fontWeight: 600, color: isErrorPhase ? '#B91C1C' : '#0D0D12' }}>
            {isErrorPhase ? errorTitleByAction : titleByAction}
          </span>
        </div>

        {envelope.action === 'add' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {envelope.candidates.map((c, idx) => {
              const checked = selected.has(idx);
              return (
                <div
                  key={`${c.full_name}-${idx}`}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '10px 12px',
                    background: checked ? '#FFFFFF' : '#FAFAFA',
                    border: `0.5px solid ${checked ? 'rgba(0,0,0,0.10)' : 'rgba(0,0,0,0.06)'}`,
                    borderRadius: 12,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggleCandidate(idx)}
                    aria-pressed={checked}
                    aria-label={checked ? `Skip ${c.full_name}` : `Include ${c.full_name}`}
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
                      cursor: 'pointer',
                      flexShrink: 0,
                      marginTop: 2,
                      padding: 0,
                    }}
                  >
                    {checked && <Check size={14} strokeWidth={2.5} style={{ color: '#FFFFFF' }} />}
                  </button>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                    <span style={valueText}>{c.full_name}</span>
                    {(c.email || c.phone) && (
                      <span style={{ fontSize: 12, color: '#6B7280', display: 'inline-flex', gap: 12, flexWrap: 'wrap' }}>
                        {c.email && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Mail size={11} strokeWidth={2} />
                            {c.email}
                          </span>
                        )}
                        {c.phone && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Phone size={11} strokeWidth={2} />
                            {c.phone}
                          </span>
                        )}
                      </span>
                    )}
                    {c.classification === 'duplicate_likely' && c.existing_match && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '2px 8px',
                          background: 'rgba(245, 184, 0, 0.10)',
                          border: '0.5px solid rgba(245, 184, 0, 0.32)',
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 600,
                          color: '#8A6A00',
                          width: 'fit-content',
                          marginTop: 2,
                        }}
                      >
                        <AlertTriangle size={11} strokeWidth={2.25} />
                        Possible duplicate of {c.existing_match.full_name}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {envelope.action === 'update' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {envelope.draft.changed_fields.map((field) => (
              <div
                key={field}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  padding: '8px 12px',
                  background: '#FAFAFA',
                  borderRadius: 10,
                }}
              >
                <span style={labelText}>{field}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ ...valueText, color: '#9CA3AF', textDecoration: 'line-through' }}>
                    {String(envelope.draft.before[field] ?? '-')}
                  </span>
                  <ArrowRight size={12} strokeWidth={2.25} style={{ color: '#9CA3AF' }} />
                  <span style={valueText}>{String(envelope.draft.after[field] ?? '-')}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {envelope.action === 'remove' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {envelope.drafts.map((d) => (
              <div
                key={d.applicant_id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  padding: '8px 12px',
                  background: d.has_dependencies ? 'rgba(245, 184, 0, 0.06)' : '#FAFAFA',
                  borderRadius: 10,
                  border: d.has_dependencies ? '0.5px solid rgba(245, 184, 0, 0.32)' : '0.5px solid rgba(0,0,0,0.04)',
                }}
              >
                <span style={valueText}>{d.full_name}</span>
                {d.has_dependencies && d.dependency_summary && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: '#8A6A00' }}>
                    <AlertTriangle size={11} strokeWidth={2.25} />
                    Has {d.dependency_summary}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {phase === 'error' && errorText && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#B91C1C' }}>
            <AlertTriangle size={14} strokeWidth={2.25} />
            <span style={{ fontSize: 12.5, fontWeight: 500 }}>{errorText}</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
          <button
            type="button"
            style={primaryButton}
            onClick={runConfirm}
            disabled={phase === 'confirming' || (envelope.action === 'add' && selected.size === 0)}
            className="agent-tappable"
          >
            {phase === 'confirming' ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Saving
              </>
            ) : (
              <>
                <Check size={14} strokeWidth={2.25} />
                {envelope.action === 'remove' ? 'Confirm remove' : phase === 'error' ? 'Try again' : 'Confirm'}
              </>
            )}
          </button>
          <button type="button" style={tertiaryButton} onClick={cancel} className="agent-tappable" disabled={phase === 'confirming'}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
