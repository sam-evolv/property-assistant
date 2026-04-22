'use client';

/**
 * Session 5A — Approval drawer.
 *
 * Slides up on mobile, in from the right on desktop. Pager dots, per-draft
 * Approve / Discard / Edit, auto-advance, Approve all. Wired to
 * `pending_drafts` endpoints: /send-draft, DELETE /drafts/:id, PATCH /drafts/:id.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Send,
  Trash2,
  X,
  Loader2,
} from 'lucide-react';
import { useApprovalDrawer } from '@/lib/agent-intelligence/drawer-store';

export default function ApprovalDrawer() {
  const drawer = useApprovalDrawer();
  const [isDesktop, setIsDesktop] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftSubject, setDraftSubject] = useState('');
  const [draftBody, setDraftBody] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 900px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const current = drawer.drafts[drawer.cursor] ?? null;

  useEffect(() => {
    // Reset edit state whenever the current draft changes.
    setEditing(false);
    setDraftSubject(current?.subject ?? '');
    setDraftBody(current?.body ?? '');
  }, [current?.id]);

  useEffect(() => {
    // Auto-advance after a draft is sent or discarded so the pager keeps moving.
    if (!current) return;
    if (current.status === 'sent' || current.status === 'discarded') {
      const nextIdx = drawer.drafts.findIndex((d, i) => i > drawer.cursor && d.status === 'pending');
      if (nextIdx >= 0) {
        const t = window.setTimeout(() => drawer.setCursor(nextIdx), 400);
        return () => window.clearTimeout(t);
      }
    }
  }, [current?.status]);

  const pendingCount = useMemo(
    () => drawer.drafts.filter((d) => d.status === 'pending' || d.status === 'approved').length,
    [drawer.drafts],
  );
  const sentCount = useMemo(
    () => drawer.drafts.filter((d) => d.status === 'sent').length,
    [drawer.drafts],
  );

  if (!drawer.envelope || !drawer.drafts.length) return null;

  const showing = drawer.open;

  const panelStyle: React.CSSProperties = isDesktop
    ? {
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 'min(480px, 100vw)',
        background: '#FFFFFF',
        boxShadow: '-12px 0 40px rgba(0,0,0,0.12)',
        transform: showing ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 280ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
      }
    : {
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        top: '8vh',
        background: '#FFFFFF',
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        boxShadow: '0 -12px 40px rgba(0,0,0,0.18)',
        transform: showing ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 280ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
      };

  return (
    <>
      {/* Scrim */}
      <div
        onClick={drawer.close}
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 17, 24, 0.36)',
          opacity: showing ? 1 : 0,
          pointerEvents: showing ? 'auto' : 'none',
          transition: 'opacity 240ms ease',
          zIndex: 99,
        }}
      />

      <div role="dialog" aria-modal="true" aria-label="Approve drafts" style={panelStyle} data-testid="approval-drawer">
        {/* Header */}
        <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid rgba(15,17,24,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#B8960C', margin: 0 }}>
                Review drafts
              </p>
              <h2 style={{ margin: '4px 0 0', fontSize: 17, fontWeight: 700, color: '#0D0D12', letterSpacing: '-0.02em' }}>
                {drawer.envelope.summary}
              </h2>
            </div>
            <button
              onClick={drawer.close}
              aria-label="Close drawer"
              style={{
                border: 'none',
                background: '#F3F3EE',
                borderRadius: 999,
                width: 34,
                height: 34,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={16} color="#374151" />
            </button>
          </div>

          {/* Pager dots */}
          <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
            {drawer.drafts.map((d, i) => {
              const colour =
                d.status === 'sent'
                  ? '#059669'
                  : d.status === 'discarded'
                    ? '#9CA3AF'
                    : d.status === 'failed'
                      ? '#DC2626'
                      : i === drawer.cursor
                        ? '#C49B2A'
                        : '#D7D4CA';
              return (
                <button
                  key={d.id}
                  onClick={() => drawer.setCursor(i)}
                  aria-label={`Draft ${i + 1}`}
                  data-testid={`drawer-dot-${i}`}
                  style={{
                    width: i === drawer.cursor ? 18 : 8,
                    height: 8,
                    borderRadius: 999,
                    background: colour,
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 180ms ease',
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
          {current && <DraftCard
            draft={current}
            editing={editing}
            subject={draftSubject}
            body={draftBody}
            onSubjectChange={setDraftSubject}
            onBodyChange={setDraftBody}
          />}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 14px calc(12px + env(safe-area-inset-bottom))', borderTop: '1px solid rgba(15,17,24,0.06)', background: '#FAFAF8' }}>
          {drawer.bulkProgress ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 4px' }}>
              <Loader2 className="animate-spin" size={16} color="#C49B2A" />
              <span style={{ fontSize: 13, color: '#374151' }}>
                Sending {drawer.bulkProgress.done + 1} of {drawer.bulkProgress.total}…
              </span>
            </div>
          ) : (
            <>
              {current && (current.status === 'pending' || current.status === 'approved' || current.status === 'failed') && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  {!editing ? (
                    <>
                      <FooterButton
                        onClick={() => drawer.discardDraft(current.id)}
                        variant="ghost"
                        icon={<Trash2 size={14} />}
                        label="Discard"
                        testId="drawer-discard"
                      />
                      <FooterButton
                        onClick={() => setEditing(true)}
                        variant="ghost"
                        icon={<Pencil size={14} />}
                        label="Edit"
                        testId="drawer-edit"
                      />
                      <FooterButton
                        onClick={() => drawer.approveDraft(current.id)}
                        variant="primary"
                        icon={<Send size={14} />}
                        label="Approve"
                        testId="drawer-approve"
                      />
                    </>
                  ) : (
                    <>
                      <FooterButton
                        onClick={() => {
                          setEditing(false);
                          setDraftSubject(current.subject ?? '');
                          setDraftBody(current.body ?? '');
                        }}
                        variant="ghost"
                        icon={<X size={14} />}
                        label="Cancel"
                        testId="drawer-edit-cancel"
                      />
                      <FooterButton
                        onClick={async () => {
                          await drawer.editDraft(current.id, { subject: draftSubject, body: draftBody });
                          setEditing(false);
                        }}
                        variant="primary"
                        icon={<Check size={14} />}
                        label="Save edits"
                        testId="drawer-edit-save"
                      />
                    </>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <PagerNav direction="prev" disabled={drawer.cursor === 0} onClick={() => drawer.setCursor(drawer.cursor - 1)} />
                  <span style={{ fontSize: 11.5, color: '#6B7280', minWidth: 36, textAlign: 'center' }}>
                    {drawer.cursor + 1} / {drawer.drafts.length}
                  </span>
                  <PagerNav direction="next" disabled={drawer.cursor >= drawer.drafts.length - 1} onClick={() => drawer.setCursor(drawer.cursor + 1)} />
                </div>
                {pendingCount > 1 && (
                  <button
                    onClick={() => drawer.approveAll()}
                    data-testid="drawer-approve-all"
                    style={{
                      background: 'linear-gradient(135deg, #C49B2A, #E8C84A)',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: 10,
                      padding: '9px 14px',
                      fontWeight: 600,
                      fontSize: 12.5,
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(196,155,42,0.30)',
                    }}
                  >
                    Approve all ({pendingCount})
                  </button>
                )}
              </div>
              {(sentCount > 0 || pendingCount === 0) && (
                <p style={{ margin: '10px 2px 0', fontSize: 11.5, color: '#6B7280', lineHeight: 1.4 }}>
                  {sentCount > 0 && `${sentCount} sent. `}
                  {pendingCount > 0
                    ? `${pendingCount} will stay in Drafts if you close now.`
                    : 'All handled — safe to close.'}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

function DraftCard({
  draft,
  editing,
  subject,
  body,
  onSubjectChange,
  onBodyChange,
}: {
  draft: ReturnType<typeof useApprovalDrawer>['drafts'][number];
  editing: boolean;
  subject: string;
  body: string;
  onSubjectChange: (v: string) => void;
  onBodyChange: (v: string) => void;
}) {
  const statusChip =
    draft.status === 'sent'
      ? { label: 'Sent', bg: '#E4F7EE', fg: '#059669' }
      : draft.status === 'failed'
        ? { label: 'Failed', bg: '#FDECEC', fg: '#DC2626' }
        : draft.status === 'discarded'
          ? { label: 'Discarded', bg: '#F3F3EE', fg: '#6B7280' }
          : draft.status === 'sending'
            ? { label: 'Sending…', bg: '#FFF6D9', fg: '#B8960C' }
            : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#6B7280',
            background: '#F3F3EE',
            padding: '3px 8px',
            borderRadius: 999,
          }}
        >
          {draft.type === 'viewing_record' ? 'Viewing record' : draft.type}
        </span>
        {draft.recipient && (
          <span style={{ fontSize: 12, color: '#374151' }}>
            To: <b style={{ fontWeight: 600 }}>{draft.recipient.name}</b>
            {draft.recipient.email && draft.recipient.email !== 'self' ? (
              <span style={{ color: '#9CA3AF' }}> · {draft.recipient.email}</span>
            ) : null}
          </span>
        )}
        {statusChip && (
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: '0.08em',
              padding: '3px 8px',
              borderRadius: 999,
              background: statusChip.bg,
              color: statusChip.fg,
            }}
          >
            {statusChip.label}
          </span>
        )}
      </div>

      {editing ? (
        <>
          {draft.subject !== undefined && (
            <input
              value={subject}
              onChange={(e) => onSubjectChange(e.target.value)}
              placeholder="Subject"
              data-testid="drawer-subject-input"
              style={{
                border: '1px solid rgba(15,17,24,0.12)',
                borderRadius: 10,
                padding: '10px 12px',
                fontSize: 14,
                fontFamily: 'inherit',
                background: '#FFFFFF',
              }}
            />
          )}
          <textarea
            value={body}
            onChange={(e) => onBodyChange(e.target.value)}
            rows={12}
            data-testid="drawer-body-input"
            style={{
              border: '1px solid rgba(15,17,24,0.12)',
              borderRadius: 10,
              padding: '10px 12px',
              fontSize: 13.5,
              lineHeight: 1.55,
              fontFamily: 'inherit',
              background: '#FFFFFF',
              resize: 'vertical',
            }}
          />
        </>
      ) : (
        <>
          {draft.subject && (
            <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: '#0D0D12', letterSpacing: '-0.015em' }}>
              {draft.subject}
            </h3>
          )}
          <pre
            style={{
              margin: 0,
              fontSize: 13.5,
              lineHeight: 1.6,
              color: '#374151',
              background: '#FAFAF8',
              padding: '12px 14px',
              borderRadius: 12,
              whiteSpace: 'pre-wrap',
              fontFamily: 'inherit',
              border: '1px solid rgba(15,17,24,0.05)',
            }}
          >
            {draft.body}
          </pre>
          <div
            style={{
              fontSize: 12,
              lineHeight: 1.5,
              color: '#6B7280',
              background: '#FFF8E6',
              border: '1px solid rgba(196,155,42,0.22)',
              padding: '8px 10px',
              borderRadius: 10,
            }}
          >
            <b style={{ fontWeight: 700, color: '#8A6E1F' }}>Why:</b> {draft.reasoning}
          </div>
          {draft.errorMessage && (
            <div
              style={{
                fontSize: 12,
                color: '#B1201D',
                background: '#FDECEC',
                padding: '8px 10px',
                borderRadius: 10,
              }}
            >
              {draft.errorMessage}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FooterButton({
  onClick,
  icon,
  label,
  variant,
  testId,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  variant: 'primary' | 'ghost';
  testId?: string;
}) {
  const base: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '10px 12px',
    borderRadius: 10,
    fontSize: 12.5,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    border: 'none',
  };
  const style =
    variant === 'primary'
      ? {
          ...base,
          background: 'linear-gradient(135deg, #C49B2A, #E8C84A)',
          color: '#FFFFFF',
          boxShadow: '0 2px 8px rgba(196,155,42,0.30)',
        }
      : {
          ...base,
          background: '#FFFFFF',
          color: '#374151',
          border: '1px solid rgba(15,17,24,0.12)',
        };
  return (
    <button onClick={onClick} style={style} data-testid={testId}>
      {icon}
      {label}
    </button>
  );
}

function PagerNav({
  direction,
  disabled,
  onClick,
}: {
  direction: 'prev' | 'next';
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = direction === 'prev' ? ChevronLeft : ChevronRight;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === 'prev' ? 'Previous draft' : 'Next draft'}
      style={{
        width: 34,
        height: 34,
        borderRadius: 999,
        border: '1px solid rgba(15,17,24,0.12)',
        background: disabled ? '#F3F3EE' : '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <Icon size={16} color="#374151" />
    </button>
  );
}
