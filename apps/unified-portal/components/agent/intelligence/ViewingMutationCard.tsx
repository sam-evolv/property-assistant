'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  CalendarClock,
  XCircle,
  Check,
  X,
  ArrowRight,
  AlertTriangle,
  Loader2,
  Undo2,
  CheckCircle2,
  UserX,
} from 'lucide-react';
import {
  addEventToDeviceCalendar,
  updateEventOnDeviceCalendar,
  deleteEventFromDeviceCalendar,
} from '@/lib/capacitor-calendar';

export type ViewingSource = 'viewings' | 'agent_viewings';

export interface ViewingFieldDelta {
  scheduled_at?: string;
  duration_minutes?: number;
  property?: { development_id: string | null; name: string | null };
  notes?: string | null;
}

export interface ViewingUpdateEnvelope {
  status: 'draft';
  type: 'viewing_update';
  viewing_id: string;
  source: ViewingSource;
  applicant_name: string;
  previous: ViewingFieldDelta;
  next: ViewingFieldDelta;
  calendar_will_update: boolean;
  message: string;
}

export interface ViewingCancelEnvelope {
  status: 'draft';
  type: 'viewing_cancel';
  viewing_id: string;
  source: ViewingSource;
  applicant_name: string;
  scheduled_at: string;
  location: string | null;
  reason: string | null;
  calendar_will_delete: boolean;
  message: string;
}

export interface ViewingMarkStatusEnvelope {
  status: 'draft';
  type: 'viewing_mark_status';
  viewing_id: string;
  source: ViewingSource;
  applicant_name: string;
  scheduled_at: string;
  location: string | null;
  new_status: 'no_show' | 'completed';
  message: string;
}

export type ViewingMutationEnvelope =
  | ViewingUpdateEnvelope
  | ViewingCancelEnvelope
  | ViewingMarkStatusEnvelope;

interface ViewingMutationCardProps {
  envelope: ViewingMutationEnvelope;
  onConfirmFailed?: (note: string) => void;
}

type Phase = 'draft' | 'confirming' | 'receipt' | 'reverted' | 'cancelled' | 'error';

interface ReceiptInfo {
  audit_log_id: string;
  viewing_id: string;
  source: ViewingSource;
  summary: string;
  device_calendar_event_id: string | null;
  calendar_outcome: 'updated' | 'deleted' | 'unavailable' | 'denied' | 'error' | 'skipped' | 'pending';
  calendar_message?: string;
  // For undo of cancellations: the captured pre-cancel snapshot used to
  // re-add the device calendar event when the user undoes.
  prev_for_calendar?: { title: string; startMs: number; endMs: number; location?: string };
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

const dangerButton: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  padding: '10px 14px',
  background: 'linear-gradient(180deg, #EF4444 0%, #DC2626 100%)',
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

const undoProminent: React.CSSProperties = {
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

const undoSubtle: React.CSSProperties = {
  fontSize: 12.5,
  fontWeight: 500,
  color: '#6B7280',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
  padding: 0,
};

function formatScheduled(iso: string): string {
  const dt = new Date(iso);
  return new Intl.DateTimeFormat('en-IE', {
    timeZone: 'Europe/Dublin',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(dt);
}

export default function ViewingMutationCard({ envelope, onConfirmFailed }: ViewingMutationCardProps) {
  const [phase, setPhase] = useState<Phase>('draft');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptInfo | null>(null);
  const [undoVisible, setUndoVisible] = useState<'prominent' | 'subtle' | 'gone'>('gone');
  const [reasonInput, setReasonInput] = useState<string>(
    envelope.type === 'viewing_cancel' ? envelope.reason ?? '' : '',
  );
  const undoStartedRef = useRef(false);

  // Step the undo affordance from prominent → subtle → gone.
  useEffect(() => {
    if (phase !== 'receipt') return;
    if (!receipt) return;
    if (undoStartedRef.current) return;
    undoStartedRef.current = true;
    setUndoVisible('prominent');
    const t1 = setTimeout(() => setUndoVisible('subtle'), 30_000);
    const t2 = setTimeout(() => setUndoVisible('gone'), 30 * 60 * 1000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [phase, receipt]);

  async function applyCalendarSideEffect(
    deviceCalendarEventId: string | null,
  ): Promise<{ outcome: ReceiptInfo['calendar_outcome']; message?: string }> {
    if (envelope.type === 'viewing_mark_status') return { outcome: 'skipped' };
    if (!deviceCalendarEventId) return { outcome: 'skipped' };

    if (envelope.type === 'viewing_update') {
      const payload: Record<string, unknown> = {};
      if (envelope.next.scheduled_at) {
        const start = new Date(envelope.next.scheduled_at).getTime();
        payload.startMs = start;
        const dur = envelope.next.duration_minutes ?? envelope.previous.duration_minutes ?? 30;
        payload.endMs = start + dur * 60 * 1000;
      } else if (envelope.next.duration_minutes && envelope.previous.scheduled_at) {
        const start = new Date(envelope.previous.scheduled_at).getTime();
        payload.startMs = start;
        payload.endMs = start + envelope.next.duration_minutes * 60 * 1000;
      }
      if (envelope.next.property?.name) {
        payload.location = envelope.next.property.name;
        payload.title = `Viewing: ${envelope.applicant_name} at ${envelope.next.property.name}`;
      }
      const res = await updateEventOnDeviceCalendar(deviceCalendarEventId, payload as any);
      if (res.status === 'updated') return { outcome: 'updated' };
      if (res.status === 'denied') return { outcome: 'denied' };
      if (res.status === 'unavailable') return { outcome: 'unavailable' };
      return { outcome: 'error', message: res.message };
    }

    if (envelope.type === 'viewing_cancel') {
      const res = await deleteEventFromDeviceCalendar(deviceCalendarEventId);
      if (res.status === 'deleted') {
        try {
          await fetch(`/api/agent-intelligence/viewings/${envelope.viewing_id}/calendar`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ device_calendar_event_id: null }),
          });
        } catch {
          // Non-blocking. The DB row reflects the cancel; the calendar
          // back-link is a nice-to-have.
        }
        return { outcome: 'deleted' };
      }
      if (res.status === 'denied') return { outcome: 'denied' };
      if (res.status === 'unavailable') return { outcome: 'unavailable' };
      return { outcome: 'error', message: res.message };
    }
    return { outcome: 'skipped' };
  }

  async function runConfirm() {
    setPhase('confirming');
    setErrorText(null);
    try {
      const url =
        envelope.type === 'viewing_update'
          ? '/api/agent-intelligence/confirm-update-viewing'
          : envelope.type === 'viewing_cancel'
            ? '/api/agent-intelligence/confirm-cancel-viewing'
            : '/api/agent-intelligence/confirm-mark-status';

      const body: Record<string, unknown> = {
        viewing_id: envelope.viewing_id,
        source: envelope.source,
      };
      if (envelope.type === 'viewing_update') {
        body.next = envelope.next;
      } else if (envelope.type === 'viewing_cancel') {
        body.reason = reasonInput.trim() || null;
      } else {
        body.status = envelope.new_status;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Could not save changes');
      }
      const data = await res.json();
      const auditId: string = data.audit_log_id;
      const deviceCalendarEventId: string | null = data.device_calendar_event_id ?? null;

      const calendar = await applyCalendarSideEffect(deviceCalendarEventId);

      const previousForCalendar = (() => {
        if (envelope.type !== 'viewing_cancel') return undefined;
        const start = new Date(envelope.scheduled_at).getTime();
        return {
          title: `Viewing: ${envelope.applicant_name}${envelope.location ? ` at ${envelope.location}` : ''}`,
          startMs: start,
          endMs: start + 30 * 60 * 1000,
          location: envelope.location ?? undefined,
        };
      })();

      const summary =
        envelope.type === 'viewing_update'
          ? `Updated ${envelope.applicant_name}'s viewing.`
          : envelope.type === 'viewing_cancel'
            ? `Cancelled ${envelope.applicant_name}'s viewing.`
            : envelope.new_status === 'completed'
              ? `Marked ${envelope.applicant_name}'s viewing as completed.`
              : `Marked ${envelope.applicant_name}'s viewing as no-show.`;

      setReceipt({
        audit_log_id: auditId,
        viewing_id: envelope.viewing_id,
        source: envelope.source,
        summary,
        device_calendar_event_id: deviceCalendarEventId,
        calendar_outcome: calendar.outcome,
        calendar_message: calendar.message,
        prev_for_calendar: previousForCalendar,
      });
      setPhase('receipt');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save changes';
      setErrorText(message);
      setPhase('error');
      const note =
        envelope.type === 'viewing_update'
          ? 'Update failed, the viewing was not changed.'
          : envelope.type === 'viewing_cancel'
            ? 'Cancellation failed, the viewing is still on the books.'
            : 'Status update failed, the viewing status was not changed.';
      onConfirmFailed?.(note);
    }
  }

  async function runUndo() {
    if (!receipt) return;
    setPhase('confirming');
    try {
      const res = await fetch('/api/agent-intelligence/undo-viewing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audit_log_id: receipt.audit_log_id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Undo failed');
      }
      const data = await res.json();
      // Best-effort calendar restore for cancellations.
      if (data.recalendar_hint === 'restore' && receipt.prev_for_calendar) {
        try {
          const result = await addEventToDeviceCalendar(receipt.prev_for_calendar);
          if (result.status === 'created') {
            await fetch(`/api/agent-intelligence/viewings/${receipt.viewing_id}/calendar`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ device_calendar_event_id: result.eventId }),
            }).catch(() => undefined);
          }
        } catch {
          // Silent: undo on the DB side already succeeded.
        }
      }
      setPhase('reverted');
      setUndoVisible('gone');
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'Undo failed');
      setPhase('receipt');
    }
  }

  function cancel() {
    // Pure setState. No async, no event listeners to detach. The expensive
    // unmount path in the chat surface (re-rendering every other card) is
    // avoided by keeping the cancelled-state node in place.
    setPhase('cancelled');
  }

  // ---------- Render branches ----------

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
    const showUndo = undoVisible !== 'gone';
    const calendarLine = (() => {
      if (receipt.calendar_outcome === 'updated') {
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#10703C', fontSize: 12.5, fontWeight: 500 }}>
            <Check size={13} strokeWidth={2.25} />
            Calendar event updated
          </span>
        );
      }
      if (receipt.calendar_outcome === 'deleted') {
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#10703C', fontSize: 12.5, fontWeight: 500 }}>
            <Check size={13} strokeWidth={2.25} />
            Calendar event removed
          </span>
        );
      }
      if (receipt.calendar_outcome === 'denied' || receipt.calendar_outcome === 'error') {
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#8A6A00', fontSize: 12.5, fontWeight: 500 }}>
            <AlertTriangle size={13} strokeWidth={2.25} />
            Couldn&apos;t update your calendar, open Calendar app to fix manually
          </span>
        );
      }
      return null;
    })();

    return (
      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <div style={cardSurface}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Check size={16} strokeWidth={2.25} style={{ color: '#10703C' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#0D0D12' }}>{receipt.summary}</span>
          </div>
          {calendarLine}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Link
              href={`/agent/viewings?focus=${encodeURIComponent(receipt.viewing_id)}`}
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
              <span>Open in Viewings</span>
              <ArrowRight size={13} strokeWidth={2.25} />
            </Link>
            {showUndo && (
              undoVisible === 'prominent' ? (
                <button type="button" style={undoProminent} onClick={runUndo} className="agent-tappable">
                  <Undo2 size={13} strokeWidth={2.25} />
                  Undo
                </button>
              ) : (
                <button type="button" style={undoSubtle} onClick={runUndo} className="agent-tappable">
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

  // ---------- Draft / confirming / error ----------

  const isError = phase === 'error';
  const isCancel = envelope.type === 'viewing_cancel';
  const isMarkStatus = envelope.type === 'viewing_mark_status';

  let HeaderIcon = CalendarClock;
  let header = `Reschedule ${envelope.applicant_name}`;
  if (envelope.type === 'viewing_cancel') {
    HeaderIcon = XCircle;
    header = `Cancel ${envelope.applicant_name}'s viewing`;
  } else if (envelope.type === 'viewing_mark_status') {
    HeaderIcon = envelope.new_status === 'completed' ? CheckCircle2 : UserX;
    header = envelope.new_status === 'completed'
      ? `Mark ${envelope.applicant_name}'s viewing as completed`
      : `Mark ${envelope.applicant_name}'s viewing as no-show`;
  }

  const cardForPhase: React.CSSProperties = isError
    ? {
        ...cardSurface,
        border: '1px solid rgba(220,38,38,0.45)',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(220,38,38,0.10), 0 0 0 0.5px rgba(220,38,38,0.20)',
      }
    : cardSurface;

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
      <div style={cardForPhase}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isError ? (
            <AlertTriangle size={16} strokeWidth={2.25} style={{ color: '#B91C1C' }} />
          ) : (
            <HeaderIcon size={16} strokeWidth={2} style={{ color: isCancel ? '#B91C1C' : '#0D0D12' }} />
          )}
          <span style={{ fontSize: 13, fontWeight: 600, color: isError ? '#B91C1C' : '#0D0D12' }}>
            {isError ? "Couldn't save changes" : header}
          </span>
        </div>

        {envelope.type === 'viewing_update' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {envelope.next.scheduled_at && (
              <DiffRow
                label="When"
                before={envelope.previous.scheduled_at ? formatScheduled(envelope.previous.scheduled_at) : '-'}
                after={formatScheduled(envelope.next.scheduled_at)}
              />
            )}
            {envelope.next.duration_minutes && (
              <DiffRow
                label="Length"
                before={`${envelope.previous.duration_minutes ?? '-'} min`}
                after={`${envelope.next.duration_minutes} min`}
              />
            )}
            {envelope.next.property && (
              <DiffRow
                label="Property"
                before={envelope.previous.property?.name || '-'}
                after={envelope.next.property.name || '-'}
              />
            )}
            {envelope.next.notes !== undefined && (
              <DiffRow
                label="Notes"
                before={(envelope.previous.notes as string) || '-'}
                after={(envelope.next.notes as string) || '-'}
              />
            )}
            <CalendarHintLine
              willChange={envelope.calendar_will_update}
              changedCopy="Your iPhone calendar event will be updated"
              skippedCopy="Calendar not connected for this viewing"
            />
          </div>
        )}

        {envelope.type === 'viewing_cancel' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <ReceiptRow label="Applicant" value={envelope.applicant_name} />
            <ReceiptRow label="When" value={formatScheduled(envelope.scheduled_at)} />
            {envelope.location && <ReceiptRow label="Property" value={envelope.location} />}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={labelText}>Reason (optional)</span>
              <textarea
                value={reasonInput}
                onChange={(e) => setReasonInput(e.target.value)}
                placeholder="e.g. buyer wants to push back"
                rows={2}
                style={{
                  padding: '8px 10px',
                  fontSize: 13,
                  border: '0.5px solid rgba(0,0,0,0.16)',
                  borderRadius: 8,
                  background: '#FFFFFF',
                  color: '#0D0D12',
                  fontFamily: 'inherit',
                  resize: 'none',
                }}
              />
            </div>
            <CalendarHintLine
              willChange={envelope.calendar_will_delete}
              changedCopy="Your iPhone calendar event will be removed"
              skippedCopy="Calendar not connected for this viewing"
            />
          </div>
        )}

        {envelope.type === 'viewing_mark_status' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <ReceiptRow label="Applicant" value={envelope.applicant_name} />
            <ReceiptRow label="When" value={formatScheduled(envelope.scheduled_at)} />
            {envelope.location && <ReceiptRow label="Property" value={envelope.location} />}
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
            style={isCancel ? dangerButton : primaryButton}
            onClick={runConfirm}
            disabled={phase === 'confirming'}
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
                {isCancel
                  ? 'Confirm cancellation'
                  : isMarkStatus
                    ? 'Confirm'
                    : phase === 'error'
                      ? 'Try again'
                      : 'Confirm'}
              </>
            )}
          </button>
          <button type="button" style={tertiaryButton} onClick={cancel} className="agent-tappable" disabled={phase === 'confirming'}>
            {isCancel ? 'Keep viewing' : 'Cancel'}
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

function DiffRow({ label, before, after }: { label: string; before: string; after: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '8px 12px',
        background: '#FAFAFA',
        borderRadius: 10,
      }}
    >
      <span style={labelText}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ ...valueText, color: '#9CA3AF', textDecoration: 'line-through' }}>{before}</span>
        <ArrowRight size={12} strokeWidth={2.25} style={{ color: '#9CA3AF' }} />
        <span style={valueText}>{after}</span>
      </div>
    </div>
  );
}

function CalendarHintLine({
  willChange,
  changedCopy,
  skippedCopy,
}: {
  willChange: boolean;
  changedCopy: string;
  skippedCopy: string;
}) {
  return (
    <span style={{ fontSize: 12, color: '#6B7280' }}>
      {willChange ? changedCopy : skippedCopy}
    </span>
  );
}
