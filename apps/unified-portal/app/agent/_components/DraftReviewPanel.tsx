'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Info,
  Mail,
  MessageCircle,
  Phone,
  Send as SendIcon,
  Trash2,
  X,
} from 'lucide-react';
import {
  draftTypeLabel,
  type DraftRecord,
} from '@/lib/agent-intelligence/drafts';
import AutoSendOfferCard from './AutoSendOfferCard';

interface DraftReviewPanelProps {
  draft: DraftRecord;
  surface: 'mobile' | 'desktop';
  sending: boolean;
  sentState: SentState | null;
  autoSendOffer?: AutoSendOffer | null;
  onClose: () => void;
  onSave: (patch: { subject: string; body: string; sendMethod?: DraftRecord['sendMethod'] }) => Promise<DraftRecord | null>;
  onSend: (opts: { wasEdited: boolean }) => Promise<void>;
  onDiscard: () => Promise<void>;
  onEnableAutoSend?: (draftType: string) => Promise<void>;
  onDismissAutoSendOffer?: (draftType: string) => Promise<void>;
}

export interface SentState {
  recipient: string;
  status: 'sent' | 'sent_external';
  externalHref: string | null;
  externalHint: string | null;
  undoable: boolean;
}

export interface AutoSendOffer {
  draftType: string;
  totalSent: number;
  sentEdited: number;
}

const DISCARD_CONFIRM = 'Discard this draft? This cannot be undone.';

/**
 * Draft review. Mobile: full-screen overlay. Desktop: right-hand side panel
 * (450px) over a dimmed list. The surface prop only affects chrome — the
 * editor behaviour (dirty tracking, keyboard shortcuts, keyboard-aware
 * footer) is identical.
 */
export default function DraftReviewPanel({
  draft,
  surface,
  sending,
  sentState,
  autoSendOffer,
  onClose,
  onSave,
  onSend,
  onDiscard,
  onEnableAutoSend,
  onDismissAutoSendOffer,
}: DraftReviewPanelProps) {
  const [subject, setSubject] = useState(draft.subject);
  const [bodyText, setBodyText] = useState(draft.body);
  const [sendMethod, setSendMethod] = useState<DraftRecord['sendMethod']>(draft.sendMethod || 'email');
  const [saving, setSaving] = useState(false);
  const [popover, setPopover] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  const dirty = useMemo(
    () =>
      subject !== draft.subject ||
      bodyText !== draft.body ||
      sendMethod !== (draft.sendMethod || 'email'),
    [subject, bodyText, sendMethod, draft.subject, draft.body, draft.sendMethod],
  );

  // Auto-resize the body textarea to fit content so long drafts don't hide
  // behind a scroll well on mobile.
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 480)}px`;
  }, [bodyText]);

  // Keyboard shortcuts on desktop.
  useEffect(() => {
    if (surface !== 'desktop') return;
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'Enter') {
        e.preventDefault();
        handleSend();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
        return;
      }
      if (mod && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        handleDiscard();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surface, subject, bodyText, sendMethod, dirty, sending]);

  const persistIfDirty = async () => {
    if (!dirty) return draft;
    setSaving(true);
    try {
      const next = await onSave({ subject, body: bodyText, sendMethod: sendMethod || 'email' });
      return next || draft;
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    await persistIfDirty();
  };

  const handleSend = async () => {
    if (sending || sentState) return;
    const wasEdited = dirty;
    await persistIfDirty();
    await onSend({ wasEdited });
  };

  const handleDiscard = async () => {
    const confirmed = typeof window !== 'undefined' ? window.confirm(DISCARD_CONFIRM) : true;
    if (!confirmed) return;
    await onDiscard();
  };

  const handleClose = () => {
    if (dirty) {
      const confirmed = typeof window !== 'undefined'
        ? window.confirm('Discard changes? Your edits will be lost.')
        : true;
      if (!confirmed) return;
    }
    onClose();
  };

  const isDesktop = surface === 'desktop';

  return (
    <div
      data-testid="draft-review-panel"
      style={isDesktop ? desktopWrapperStyle : mobileWrapperStyle}
    >
      {isDesktop && (
        <div
          onClick={handleClose}
          aria-hidden
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(13,13,18,0.32)',
            zIndex: 60,
            animation: 'oh-draft-fade 0.18s ease forwards',
          }}
        />
      )}

      <aside
        style={isDesktop ? desktopPanelStyle : mobilePanelStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <header style={headerStyle}>
          <button
            onClick={handleClose}
            aria-label="Close"
            className="agent-tappable"
            style={iconButtonStyle}
          >
            {isDesktop ? <X size={18} /> : <ArrowLeft size={18} />}
          </button>
          <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#9CA3AF', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600 }}>
              {draftTypeLabel(draft.draftType)}
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#0D0D12', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {draft.recipient.name || 'Unknown recipient'}
            </div>
          </div>
          <div style={{ width: 34 }} />
        </header>

        <div style={scrollStyle}>
          {sentState ? (
            <>
              <SentConfirmation state={sentState} />
              {autoSendOffer && onEnableAutoSend && onDismissAutoSendOffer && (
                <AutoSendOfferCard
                  draftType={autoSendOffer.draftType}
                  totalSent={autoSendOffer.totalSent}
                  sentEdited={autoSendOffer.sentEdited}
                  onEnable={() => onEnableAutoSend(autoSendOffer.draftType)}
                  onDismiss={() => onDismissAutoSendOffer(autoSendOffer.draftType)}
                />
              )}
            </>
          ) : (
            <>
              <RecipientRow
                draft={draft}
                sendMethod={sendMethod}
                onChangeMethod={setSendMethod}
              />

              <section style={sectionStyle}>
                <label style={labelStyle}>Subject</label>
                <input
                  data-testid="draft-subject-input"
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  style={inputStyle}
                />
              </section>

              <section style={sectionStyle}>
                <label style={labelStyle}>Message</label>
                <textarea
                  data-testid="draft-body-input"
                  ref={bodyRef}
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  style={textareaStyle}
                  rows={6}
                />
              </section>

              {draft.contextChips.length > 0 && (
                <section style={{ ...sectionStyle, paddingTop: 6 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {draft.contextChips.map((chip) => (
                      <ContextChip
                        key={chip.id}
                        chip={chip}
                        active={popover === chip.id}
                        onToggle={() => setPopover(popover === chip.id ? null : chip.id)}
                      />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>

        {!sentState && (
          <footer style={footerStyle}>
            <button
              data-testid="draft-discard"
              onClick={handleDiscard}
              className="agent-tappable"
              style={ghostDestructiveStyle}
            >
              <Trash2 size={14} />
              Discard
            </button>
            {dirty && (
              <button
                data-testid="draft-save"
                onClick={handleSave}
                disabled={saving}
                className="agent-tappable"
                style={ghostStyle}
              >
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            )}
            <button
              data-testid="draft-send"
              onClick={handleSend}
              disabled={sending}
              className="agent-tappable"
              style={{ ...primaryStyle, position: 'relative' }}
            >
              <SendIcon size={14} />
              {sending ? 'Sending...' : 'Send'}
              {dirty && !sending && <UnsavedDot />}
            </button>
          </footer>
        )}
      </aside>

      <style>{`
        @keyframes oh-draft-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes oh-draft-slide {
          from { transform: translateX(32px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function SentConfirmation({ state }: { state: SentState }) {
  const copy =
    state.status === 'sent'
      ? `Sent to ${state.recipient}. You can undo for 60 seconds.`
      : `Ready to finish on ${state.recipient}.`;

  return (
    <div
      data-testid="draft-sent-confirmation"
      style={{
        margin: 18,
        padding: 20,
        borderRadius: 16,
        background: 'rgba(5,150,105,0.06)',
        border: '0.5px solid rgba(5,150,105,0.25)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          background: 'rgba(5,150,105,0.15)',
          color: '#059669',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Check size={18} />
      </div>
      <p style={{ fontSize: 14, color: '#0D0D12', margin: 0, lineHeight: 1.5 }}>{copy}</p>
      {state.externalHref && (
        <a
          href={state.externalHref}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#0D0D12',
            textDecoration: 'underline',
          }}
        >
          Open {state.status === 'sent_external' ? 'app' : 'provider'}
        </a>
      )}
      {state.externalHint && (
        <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>{state.externalHint}</p>
      )}
    </div>
  );
}

function RecipientRow({
  draft,
  sendMethod,
  onChangeMethod,
}: {
  draft: DraftRecord;
  sendMethod: DraftRecord['sendMethod'];
  onChangeMethod: (m: DraftRecord['sendMethod']) => void;
}) {
  const emailContact = draft.recipient.email;
  const phoneContact = draft.recipient.phone;

  return (
    <section style={sectionStyle}>
      <label style={labelStyle}>Recipient</label>
      <div
        style={{
          background: '#FAFAF8',
          borderRadius: 12,
          border: '0.5px solid rgba(0,0,0,0.06)',
          padding: '10px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, color: '#0D0D12' }}>
          {draft.recipient.name || 'Unknown recipient'}
        </div>
        <div style={{ fontSize: 12, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 6 }}>
          {sendMethod === 'email' ? (
            <><Mail size={12} /> {emailContact || 'No email on file'}</>
          ) : sendMethod === 'sms' ? (
            <><Phone size={12} /> {phoneContact || 'No phone on file'}</>
          ) : (
            <><MessageCircle size={12} /> {phoneContact || 'No phone on file'}</>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          {(['email', 'whatsapp', 'sms'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onChangeMethod(m)}
              className="agent-tappable"
              style={{
                padding: '4px 10px',
                borderRadius: 999,
                border: sendMethod === m ? '0.5px solid #C49B2A' : '0.5px solid rgba(0,0,0,0.08)',
                background: sendMethod === m ? 'rgba(196,155,42,0.12)' : '#FFFFFF',
                color: sendMethod === m ? '#8A6E1F' : '#6B7280',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {m === 'whatsapp' ? 'WhatsApp' : m === 'sms' ? 'SMS' : 'Email'}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function ContextChip({
  chip,
  active,
  onToggle,
}: {
  chip: { id: string; label: string; detail: string | null };
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <span style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={onToggle}
        className="agent-tappable"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 10px',
          borderRadius: 999,
          background: '#F1F1EE',
          color: '#6B7280',
          fontSize: 11.5,
          fontWeight: 500,
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <Info size={11} />
        {chip.label}
      </button>
      {active && chip.detail && (
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: 0,
            background: '#0D0D12',
            color: '#fff',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 11.5,
            fontWeight: 500,
            lineHeight: 1.4,
            maxWidth: 280,
            whiteSpace: 'normal',
            boxShadow: '0 8px 24px rgba(0,0,0,0.24)',
            zIndex: 2,
          }}
        >
          {chip.detail}
        </div>
      )}
    </span>
  );
}

function UnsavedDot() {
  return (
    <span
      aria-hidden
      style={{
        position: 'absolute',
        top: 6,
        right: 6,
        width: 6,
        height: 6,
        borderRadius: 3,
        background: '#fff',
        boxShadow: '0 0 0 1.5px rgba(255,255,255,0.6)',
      }}
    />
  );
}

// ─── Styles ───

const desktopWrapperStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 60,
  pointerEvents: 'auto',
};

const mobileWrapperStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 60,
  background: '#FAFAF8',
  display: 'flex',
  flexDirection: 'column',
};

const desktopPanelStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  right: 0,
  bottom: 0,
  width: 450,
  background: '#FAFAF8',
  zIndex: 61,
  boxShadow: '-12px 0 32px rgba(0,0,0,0.08)',
  display: 'flex',
  flexDirection: 'column',
  animation: 'oh-draft-slide 0.2s cubic-bezier(0.22,0.8,0.2,1)',
};

const mobilePanelStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  background: '#FAFAF8',
  paddingTop: 'env(safe-area-inset-top)',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '12px 16px',
  borderBottom: '0.5px solid rgba(0,0,0,0.08)',
  background: 'rgba(250,250,248,0.98)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  flexShrink: 0,
};

const iconButtonStyle: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 17,
  border: 'none',
  background: 'transparent',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  color: '#0D0D12',
};

const scrollStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  WebkitOverflowScrolling: 'touch',
  paddingBottom: 8,
};

const sectionStyle: React.CSSProperties = {
  padding: '14px 18px 6px',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: '#9CA3AF',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
};

const inputStyle: React.CSSProperties = {
  border: '0.5px solid rgba(0,0,0,0.08)',
  background: '#FFFFFF',
  borderRadius: 10,
  padding: '10px 12px',
  fontSize: 14,
  color: '#0D0D12',
  fontFamily: 'inherit',
  outline: 'none',
};

const textareaStyle: React.CSSProperties = {
  border: '0.5px solid rgba(0,0,0,0.08)',
  background: '#FFFFFF',
  borderRadius: 12,
  padding: '12px 14px',
  fontSize: 14,
  lineHeight: 1.55,
  color: '#0D0D12',
  fontFamily: 'inherit',
  outline: 'none',
  resize: 'none',
  minHeight: 140,
};

const footerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 8,
  padding: '12px 16px calc(16px + env(safe-area-inset-bottom, 0px))',
  borderTop: '0.5px solid rgba(0,0,0,0.08)',
  background: 'rgba(250,250,248,0.98)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  flexShrink: 0,
  // Keep the footer above the soft keyboard on mobile. env(keyboard-inset-height)
  // is supported on iOS 16.4+, Android Chrome 119+.
  marginBottom: 'env(keyboard-inset-height, 0px)',
};

const primaryStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '10px 18px',
  background: 'linear-gradient(135deg, #C49B2A, #E8C84A)',
  color: '#fff',
  border: 'none',
  borderRadius: 12,
  fontSize: 13.5,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
  boxShadow: '0 2px 6px rgba(196,155,42,0.25)',
};

const ghostStyle: React.CSSProperties = {
  padding: '10px 14px',
  background: 'transparent',
  border: '0.5px solid rgba(0,0,0,0.12)',
  borderRadius: 12,
  fontSize: 13,
  fontWeight: 500,
  color: '#6B7280',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const ghostDestructiveStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '10px 14px',
  background: 'transparent',
  border: 'none',
  borderRadius: 12,
  fontSize: 13,
  fontWeight: 500,
  color: '#DC2626',
  cursor: 'pointer',
  fontFamily: 'inherit',
  marginRight: 'auto',
};
