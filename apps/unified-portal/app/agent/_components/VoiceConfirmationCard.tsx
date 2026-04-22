'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { Check, HelpCircle, PauseCircle, Pencil, X } from 'lucide-react';
import AutoSendCountdown from './AutoSendCountdown';
import {
  LOW_CONFIDENCE_THRESHOLD,
  actionLabel,
  type ExecutedAction,
  type ExtractedAction,
} from '@/lib/agent-intelligence/voice-actions';

export interface AutoSendUiState {
  actionId: string;
  draftId: string;
  draftType: string;
  recipientName: string;
  countdownSeconds: number;
  active: boolean;
  status: 'counting' | 'sending' | 'sent' | 'cancelled' | 'failed';
  failMessage?: string;
}

interface VoiceConfirmationCardProps {
  actions: ExtractedAction[];
  status: 'review' | 'executing' | 'done';
  results?: ExecutedAction[];
  autoSendUi?: AutoSendUiState | null;
  globalPaused?: boolean;
  onChange: (actions: ExtractedAction[]) => void;
  onApprove: () => void;
  onDiscard: () => void;
  onAutoSendElapsed?: () => void;
  onAutoSendCancel?: () => void;
}

/**
 * Inline confirmation card rendered in the Intelligence conversation flow
 * above the assistant's text response. The card owns the proposed actions
 * while the user reviews them, and collapses into a "Done" state after approval.
 */
export default function VoiceConfirmationCard({
  actions,
  status,
  results,
  autoSendUi,
  globalPaused,
  onChange,
  onApprove,
  onDiscard,
  onAutoSendElapsed,
  onAutoSendCancel,
}: VoiceConfirmationCardProps) {
  const resultById = useMemo(() => {
    const map: Record<string, ExecutedAction> = {};
    for (const r of results || []) map[r.id] = r;
    return map;
  }, [results]);

  const removeAction = (id: string) => {
    onChange(actions.filter((a) => a.id !== id));
  };

  const updateField = (id: string, field: string, value: any) => {
    onChange(
      actions.map((a) =>
        a.id === id
          ? {
              ...a,
              fields: { ...a.fields, [field]: value },
              // Editing a field lifts confidence to 1 — the user has vouched for it.
              confidence: { ...a.confidence, [field]: 1 },
            }
          : a,
      ),
    );
  };

  if (actions.length === 0 && status !== 'done') return null;

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
      <div
        data-testid="voice-confirmation-card"
        style={{
          background: '#FFFFFF',
          borderRadius: 18,
          padding: 16,
          width: '100%',
          maxWidth: '92%',
          boxShadow:
            '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.04)',
          border: status === 'done' ? '0.5px solid rgba(5,150,105,0.35)' : undefined,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 12,
          }}
        >
          <Image
            src="/oh-logo.png"
            alt=""
            width={22}
            height={22}
            style={{ objectFit: 'contain', mixBlendMode: 'multiply', flexShrink: 0 }}
          />
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#0D0D12',
              letterSpacing: '-0.01em',
            }}
          >
            {status === 'done'
              ? 'Done'
              : status === 'executing'
                ? 'Working on it'
                : "Here's what I'll do. Approve to send"}
          </span>
        </div>

        {globalPaused && status === 'review' && (
          <div
            data-testid="voice-global-pause-banner"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              marginBottom: 12,
              background: 'rgba(0,0,0,0.04)',
              border: '0.5px dashed rgba(0,0,0,0.12)',
              borderRadius: 10,
              color: '#6B7280',
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            <PauseCircle size={14} />
            Auto-send paused. Everything will go to drafts for review.
          </div>
        )}

        {autoSendUi?.active && autoSendUi.status === 'counting' && onAutoSendElapsed && onAutoSendCancel && (
          <AutoSendCountdown
            label={`Sending vendor update to ${autoSendUi.recipientName}`}
            countdownSeconds={autoSendUi.countdownSeconds}
            active={autoSendUi.status === 'counting'}
            onElapsed={onAutoSendElapsed}
            onCancel={onAutoSendCancel}
          />
        )}

        {autoSendUi?.status === 'sending' && (
          <div
            data-testid="auto-send-sending-banner"
            style={{
              padding: '10px 14px',
              marginBottom: 12,
              background: 'rgba(196,155,42,0.08)',
              border: '0.5px solid rgba(196,155,42,0.3)',
              borderRadius: 12,
              fontSize: 13,
              color: '#0D0D12',
              fontWeight: 500,
            }}
          >
            Sending vendor update to {autoSendUi.recipientName}...
          </div>
        )}

        {autoSendUi?.status === 'sent' && (
          <div
            data-testid="auto-send-success-banner"
            style={{
              padding: '10px 14px',
              marginBottom: 12,
              background: 'rgba(5,150,105,0.08)',
              border: '0.5px solid rgba(5,150,105,0.25)',
              borderRadius: 12,
              fontSize: 13,
              color: '#047857',
              fontWeight: 500,
            }}
          >
            Sent to {autoSendUi.recipientName}. Undo available for 60 seconds.
          </div>
        )}

        {autoSendUi?.status === 'cancelled' && (
          <div
            data-testid="auto-send-cancelled-banner"
            style={{
              padding: '10px 14px',
              marginBottom: 12,
              background: 'rgba(0,0,0,0.03)',
              border: '0.5px solid rgba(0,0,0,0.1)',
              borderRadius: 12,
              fontSize: 13,
              color: '#6B7280',
              fontWeight: 500,
            }}
          >
            Held for review. Find it in Drafts.
          </div>
        )}

        {autoSendUi?.status === 'failed' && (
          <div
            data-testid="auto-send-failed-banner"
            style={{
              padding: '10px 14px',
              marginBottom: 12,
              background: 'rgba(220,38,38,0.06)',
              border: '0.5px solid rgba(220,38,38,0.25)',
              borderRadius: 12,
              fontSize: 13,
              color: '#B91C1C',
              fontWeight: 500,
            }}
          >
            {autoSendUi.failMessage || "Couldn't auto-send — the draft is in review."}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {actions.map((action) => (
            <ActionSection
              key={action.id}
              action={action}
              status={status}
              result={resultById[action.id]}
              onRemove={() => removeAction(action.id)}
              onFieldChange={(field, value) => updateField(action.id, field, value)}
            />
          ))}
        </div>

        {status === 'review' && actions.length > 0 && (
          <div
            style={{
              display: 'flex',
              gap: 10,
              marginTop: 16,
              paddingTop: 14,
              borderTop: '1px solid rgba(0,0,0,0.05)',
            }}
          >
            <button
              data-testid="voice-approve-all"
              onClick={onApprove}
              className="agent-tappable"
              style={{
                flex: 1,
                padding: '12px 14px',
                background: 'linear-gradient(135deg, #C49B2A, #E8C84A)',
                border: 'none',
                borderRadius: 12,
                fontSize: 13.5,
                fontWeight: 600,
                color: '#fff',
                cursor: 'pointer',
                fontFamily: 'inherit',
                boxShadow: '0 2px 6px rgba(196,155,42,0.28)',
              }}
            >
              Approve all
            </button>
            <button
              onClick={onDiscard}
              className="agent-tappable"
              style={{
                padding: '12px 18px',
                background: 'transparent',
                border: '0.5px solid rgba(0,0,0,0.12)',
                borderRadius: 12,
                fontSize: 13.5,
                fontWeight: 500,
                color: '#6B7280',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Discard
            </button>
          </div>
        )}

        {status === 'executing' && (
          <div
            style={{
              marginTop: 14,
              fontSize: 12,
              color: '#9CA3AF',
              letterSpacing: '0.01em',
            }}
          >
            Logging your actions...
          </div>
        )}
      </div>
    </div>
  );
}

function ActionSection({
  action,
  status,
  result,
  onRemove,
  onFieldChange,
}: {
  action: ExtractedAction;
  status: VoiceConfirmationCardProps['status'];
  result?: ExecutedAction;
  onRemove: () => void;
  onFieldChange: (field: string, value: any) => void;
}) {
  return (
    <div
      style={{
        background: '#FAFAF8',
        borderRadius: 14,
        padding: '12px 14px',
        border: '0.5px solid rgba(0,0,0,0.06)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#9CA3AF',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          {actionLabel(action)}
        </span>
        {status === 'review' && (
          <button
            onClick={onRemove}
            aria-label="Remove action"
            className="agent-tappable"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#9CA3AF',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              fontWeight: 500,
              fontFamily: 'inherit',
            }}
          >
            <X size={13} />
            Remove
          </button>
        )}
        {status === 'done' && result && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: result.success ? '#059669' : '#DC2626',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {result.success ? <Check size={13} /> : <X size={13} />}
            {result.success ? 'Done' : 'Failed'}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {Object.entries(action.fields).map(([field, value]) => (
          <FieldRow
            key={field}
            field={field}
            value={value}
            confidence={action.confidence[field] ?? 1}
            readOnly={status !== 'review'}
            onChange={(v) => onFieldChange(field, v)}
          />
        ))}
      </div>

      {status === 'done' && result && result.message && (
        <div
          style={{
            marginTop: 10,
            fontSize: 12,
            color: result.success ? '#059669' : '#DC2626',
          }}
        >
          {result.message}
        </div>
      )}
      {status === 'done' && result?.autoSendHold && (
        <div
          data-testid="auto-send-hold-message"
          style={{
            marginTop: 6,
            fontSize: 11.5,
            color: '#92400E',
            fontStyle: 'italic',
          }}
        >
          {result.autoSendHold}
        </div>
      )}
    </div>
  );
}

function FieldRow({
  field,
  value,
  confidence,
  readOnly,
  onChange,
}: {
  field: string;
  value: any;
  confidence: number;
  readOnly: boolean;
  onChange: (v: any) => void;
}) {
  const [editing, setEditing] = useState(false);
  const lowConfidence = confidence < LOW_CONFIDENCE_THRESHOLD;
  const label = humanLabel(field);
  const displayValue = renderValue(value);

  const commit = (next: string) => {
    setEditing(false);
    if (next === displayValue) return;
    if (Array.isArray(value)) {
      // For attendee lists we keep it simple — names separated by commas.
      onChange(
        next
          .split(',')
          .map((n) => ({ name: n.trim() }))
          .filter((n) => n.name.length > 0),
      );
      return;
    }
    onChange(next);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        fontSize: 13,
        lineHeight: 1.4,
      }}
    >
      <span
        style={{
          color: '#9CA3AF',
          flexShrink: 0,
          minWidth: 90,
          fontSize: 11.5,
          fontWeight: 500,
          paddingTop: 2,
        }}
      >
        {label}
      </span>
      {editing ? (
        <input
          autoFocus
          defaultValue={displayValue}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit((e.target as HTMLInputElement).value);
            if (e.key === 'Escape') setEditing(false);
          }}
          style={{
            flex: 1,
            border: 'none',
            borderBottom: '1px solid #C49B2A',
            background: 'transparent',
            outline: 'none',
            fontSize: 13,
            fontFamily: 'inherit',
            color: '#0D0D12',
            padding: '2px 0',
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => { if (!readOnly) setEditing(true); }}
          className={readOnly ? '' : 'agent-tappable'}
          style={{
            flex: 1,
            textAlign: 'left',
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: readOnly ? 'default' : 'text',
            color: '#0D0D12',
            fontSize: 13,
            fontFamily: 'inherit',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            borderBottom: lowConfidence && !readOnly
              ? '1px dashed rgba(251,191,36,0.6)'
              : '1px solid transparent',
          }}
        >
          <span style={{ whiteSpace: 'pre-wrap' }}>{displayValue || <em style={{ color: '#C0C8D4' }}>empty</em>}</span>
          {lowConfidence && !readOnly && (
            <HelpCircle size={12} color="#D4A017" aria-label="Double-check this" />
          )}
          {!readOnly && !lowConfidence && (
            <Pencil size={11} color="rgba(156,163,175,0.6)" />
          )}
        </button>
      )}
    </div>
  );
}

function humanLabel(field: string): string {
  return field
    .replace(/^_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function renderValue(value: any): string {
  if (value == null) return '';
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        typeof item === 'object' && item !== null
          ? [item.name, item.contact_if_known].filter(Boolean).join(' · ')
          : String(item),
      )
      .join(', ');
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
