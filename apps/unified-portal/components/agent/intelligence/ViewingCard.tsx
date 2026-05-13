'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Calendar, Check, Pencil, X, ArrowRight, AlertTriangle, Loader2 } from 'lucide-react';
import { addEventToDeviceCalendar } from '@/lib/capacitor-calendar';

export interface ViewingDraftPayload {
  applicant_id: string;
  applicant_name: string;
  development_id: string;
  development_name: string;
  scheduled_at: string;
  duration_minutes: number;
  location: string | null;
  notes: string | null;
}

export interface CreatedViewing {
  id: string;
  scheduled_at: string;
  status: string;
  applicant_name: string;
  development_name: string;
  duration_minutes: number;
  location: string | null;
}

export type CalendarOutcome =
  | { kind: 'added' }
  | { kind: 'unavailable' }
  | { kind: 'denied' }
  | { kind: 'error'; message: string }
  | { kind: 'pending' };

interface DevelopmentOption {
  id: string;
  name: string;
}

interface ViewingCardProps {
  draft: ViewingDraftPayload;
  developments?: DevelopmentOption[];
  onConfirmed?: (viewing: CreatedViewing) => void;
  onCancelled?: () => void;
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
  textTransform: 'none',
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

function formatScheduled(iso: string): { date: string; time: string } {
  const dt = new Date(iso);
  const date = new Intl.DateTimeFormat('en-IE', {
    timeZone: 'Europe/Dublin',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(dt);
  const time = new Intl.DateTimeFormat('en-IE', {
    timeZone: 'Europe/Dublin',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(dt);
  return { date, time };
}

function isoToLocalInputValue(iso: string): string {
  const dt = new Date(iso);
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Dublin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(dt)) {
    if (p.type !== 'literal') parts[p.type] = p.value;
  }
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function localInputValueToIso(value: string): string {
  // Treat the input as Europe/Dublin local time.
  const [datePart, timePart] = value.split('T');
  if (!datePart || !timePart) return new Date(value).toISOString();
  const [y, m, d] = datePart.split('-').map((n) => parseInt(n, 10));
  const [hh, mm] = timePart.split(':').map((n) => parseInt(n, 10));
  // Build UTC by reverse-projecting from Europe/Dublin.
  const utcGuess = Date.UTC(y, m - 1, d, hh, mm);
  const probe = new Date(utcGuess);
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Dublin',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(probe)) {
    if (p.type !== 'literal') parts[p.type] = p.value;
  }
  const projected = Date.UTC(
    parseInt(parts.year, 10),
    parseInt(parts.month, 10) - 1,
    parseInt(parts.day, 10),
    parseInt(parts.hour, 10),
    parseInt(parts.minute, 10),
  );
  const offset = utcGuess - projected;
  return new Date(utcGuess + offset).toISOString();
}

export default function ViewingCard({
  draft: initialDraft,
  developments,
  onConfirmed,
  onCancelled,
}: ViewingCardProps) {
  type Phase = 'draft' | 'editing' | 'confirming' | 'receipt' | 'cancelled' | 'error';

  const [draft, setDraft] = useState<ViewingDraftPayload>(initialDraft);
  const [phase, setPhase] = useState<Phase>('draft');
  const [created, setCreated] = useState<CreatedViewing | null>(null);
  const [calendar, setCalendar] = useState<CalendarOutcome>({ kind: 'pending' });
  const [errorText, setErrorText] = useState<string | null>(null);
  const [retryingCalendar, setRetryingCalendar] = useState(false);

  const formatted = useMemo(() => formatScheduled(draft.scheduled_at), [draft.scheduled_at]);
  const editFormatted = useMemo(
    () => (created ? formatScheduled(created.scheduled_at) : formatted),
    [created, formatted],
  );

  async function writeToDeviceCalendar(viewing: CreatedViewing): Promise<CalendarOutcome> {
    const start = new Date(viewing.scheduled_at).getTime();
    const end = start + viewing.duration_minutes * 60 * 1000;
    const result = await addEventToDeviceCalendar({
      title: `Viewing: ${viewing.applicant_name} at ${viewing.development_name}`,
      startMs: start,
      endMs: end,
      location: viewing.location ?? viewing.development_name,
      notes: draft.notes ?? undefined,
    });

    if (result.status === 'created') {
      try {
        await fetch(`/api/agent-intelligence/viewings/${viewing.id}/calendar`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ device_calendar_event_id: result.eventId }),
        });
      } catch {
        // Non-blocking: the row exists, the device event exists; the
        // back-link is a nice-to-have.
      }
      return { kind: 'added' };
    }
    if (result.status === 'denied') return { kind: 'denied' };
    if (result.status === 'unavailable') return { kind: 'unavailable' };
    return { kind: 'error', message: result.message };
  }

  async function handleConfirm() {
    setPhase('confirming');
    setErrorText(null);
    try {
      const res = await fetch('/api/agent-intelligence/confirm-viewing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Could not create viewing');
      }
      const data = await res.json();
      const viewing = data.viewing as CreatedViewing;
      setCreated(viewing);
      setPhase('receipt');
      const outcome = await writeToDeviceCalendar(viewing);
      setCalendar(outcome);
      onConfirmed?.(viewing);
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'Could not create viewing');
      setPhase('error');
    }
  }

  async function handleRetryCalendar() {
    if (!created) return;
    setRetryingCalendar(true);
    const outcome = await writeToDeviceCalendar(created);
    setCalendar(outcome);
    setRetryingCalendar(false);
  }

  function handleCancel() {
    // TODO: remove after freeze diagnosis (cancel-freeze diagnostic PR).
    console.time('[FREEZE_DIAG] ViewingCard.handleCancel');
    console.log('[FREEZE_DIAG] cancel start', {
      card: 'ViewingCard',
      phase,
      timestamp: Date.now(),
    });
    setPhase('cancelled');
    onCancelled?.();
    queueMicrotask(() => {
      console.timeEnd('[FREEZE_DIAG] ViewingCard.handleCancel');
    });
  }

  if (phase === 'cancelled') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <div style={{ ...cardSurface, gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <X size={16} strokeWidth={2} style={{ color: '#9CA3AF' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#6B7280' }}>Viewing not created</span>
          </div>
          <span style={{ fontSize: 12.5, color: '#6B7280' }}>
            Cancelled before save. Ask Intelligence again when you want to schedule it.
          </span>
        </div>
      </div>
    );
  }

  if (phase === 'receipt' && created) {
    const calendarLine = (() => {
      if (calendar.kind === 'added') {
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#10703C' }}>
            <Check size={14} strokeWidth={2.25} />
            <span style={{ fontSize: 12.5, fontWeight: 500 }}>Added to your calendar</span>
          </div>
        );
      }
      if (calendar.kind === 'pending') {
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6B7280' }}>
            <Loader2 size={14} className="animate-spin" />
            <span style={{ fontSize: 12.5, fontWeight: 500 }}>Adding to your calendar</span>
          </div>
        );
      }
      if (calendar.kind === 'unavailable') {
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6B7280' }}>
            <Calendar size={14} strokeWidth={2} />
            <span style={{ fontSize: 12.5, fontWeight: 500 }}>Calendar sync only on the iOS / Android app</span>
          </div>
        );
      }
      return (
        <button
          type="button"
          onClick={handleRetryCalendar}
          className="agent-tappable"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            background: 'rgba(245, 184, 0, 0.10)',
            border: '0.5px solid rgba(245, 184, 0, 0.32)',
            borderRadius: 999,
            fontSize: 12.5,
            fontWeight: 600,
            color: '#8A6A00',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
          disabled={retryingCalendar}
        >
          {retryingCalendar ? <Loader2 size={13} className="animate-spin" /> : <AlertTriangle size={13} strokeWidth={2.25} />}
          <span>Not added to calendar, tap to retry</span>
        </button>
      );
    })();

    const r = formatScheduled(created.scheduled_at);
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <div style={cardSurface}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Check size={16} strokeWidth={2.25} style={{ color: '#10703C' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#0D0D12' }}>Viewing scheduled</span>
          </div>
          <ReceiptRow label="Applicant" value={created.applicant_name} />
          <ReceiptRow label="Property" value={created.development_name} />
          <ReceiptRow label="When" value={`${r.date} at ${r.time}`} />
          <ReceiptRow label="Length" value={`${created.duration_minutes} min`} />
          {calendarLine}
          <Link
            href={`/viewings/${created.id}`}
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
              alignSelf: 'flex-start',
            }}
          >
            <span>Open in Viewings</span>
            <ArrowRight size={13} strokeWidth={2.25} />
          </Link>
        </div>
      </div>
    );
  }

  if (phase === 'editing') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <div style={cardSurface}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Pencil size={16} strokeWidth={2} style={{ color: '#0D0D12' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#0D0D12' }}>Edit viewing</span>
          </div>
          <ReceiptRow label="Applicant" value={draft.applicant_name} />
          <EditField
            label="Property"
            type="select"
            value={draft.development_id}
            options={developments && developments.length > 0
              ? developments
              : [{ id: draft.development_id, name: draft.development_name }]}
            onChange={(v) => {
              const opt = (developments || [{ id: draft.development_id, name: draft.development_name }]).find((o) => o.id === v);
              setDraft((d) => ({
                ...d,
                development_id: v,
                development_name: opt?.name ?? d.development_name,
                location: opt?.name ?? d.location,
              }));
            }}
          />
          <EditField
            label="When"
            type="datetime-local"
            value={isoToLocalInputValue(draft.scheduled_at)}
            onChange={(v) => setDraft((d) => ({ ...d, scheduled_at: localInputValueToIso(v) }))}
          />
          <EditField
            label="Length (min)"
            type="number"
            value={String(draft.duration_minutes)}
            onChange={(v) => setDraft((d) => ({ ...d, duration_minutes: Math.max(5, Math.min(240, parseInt(v || '30', 10) || 30)) }))}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="button" style={primaryButton} onClick={() => setPhase('draft')} className="agent-tappable">
              <Check size={14} strokeWidth={2.25} />
              Done
            </button>
            <button type="button" style={tertiaryButton} onClick={() => { setDraft(initialDraft); setPhase('draft'); }} className="agent-tappable">
              Reset
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
      <div style={cardSurface}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calendar size={16} strokeWidth={2} style={{ color: '#0D0D12' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#0D0D12' }}>New viewing</span>
        </div>

        <ReceiptRow label="Applicant" value={draft.applicant_name} />
        <ReceiptRow label="Property" value={draft.development_name} />
        <ReceiptRow label="When" value={`${formatted.date} at ${formatted.time}`} />
        <ReceiptRow label="Length" value={`${draft.duration_minutes} min`} />
        {draft.notes && <ReceiptRow label="Notes" value={draft.notes} />}

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
            onClick={handleConfirm}
            disabled={phase === 'confirming'}
            className="agent-tappable"
          >
            {phase === 'confirming' ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Creating
              </>
            ) : (
              <>
                <Check size={14} strokeWidth={2.25} />
                {phase === 'error' ? 'Try again' : 'Create viewing'}
              </>
            )}
          </button>
          <button type="button" style={secondaryButton} onClick={() => setPhase('editing')} className="agent-tappable" disabled={phase === 'confirming'}>
            <Pencil size={14} strokeWidth={2.25} />
            Edit
          </button>
          <button type="button" style={tertiaryButton} onClick={handleCancel} className="agent-tappable" disabled={phase === 'confirming'}>
            Cancel
          </button>
        </div>
              </div>
    </div>
  );
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={labelText}>{label}</span>
      <span style={valueText}>{value}</span>
    </div>
  );
}

function EditField(props: {
  label: string;
  type: 'datetime-local' | 'number' | 'select';
  value: string;
  options?: DevelopmentOption[];
  onChange: (v: string) => void;
}) {
  const inputStyle: React.CSSProperties = {
    padding: '8px 10px',
    fontSize: 13,
    border: '0.5px solid rgba(0,0,0,0.16)',
    borderRadius: 8,
    background: '#FFFFFF',
    color: '#0D0D12',
    fontFamily: 'inherit',
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={labelText}>{props.label}</span>
      {props.type === 'select' ? (
        <select style={inputStyle} value={props.value} onChange={(e) => props.onChange(e.target.value)}>
          {(props.options ?? []).map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.name}</option>
          ))}
        </select>
      ) : (
        <input
          style={inputStyle}
          type={props.type}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
        />
      )}
    </div>
  );
}
