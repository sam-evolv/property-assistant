'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Zap,
  Check,
  X,
  ArrowRight,
  AlertTriangle,
  Loader2,
  Pencil,
  UserPlus,
  Calendar,
  Smartphone,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { addEventToDeviceCalendar } from '@/lib/capacitor-calendar';
import { isCapacitorNative } from '@/lib/capacitor-native';

export interface CompositeApplicantPayload {
  temp_index: number;
  full_name: string;
  email: string | null;
  phone: string | null;
  classification: 'new';
}

export type CompositeApplicantRef = { existing_id: string } | { new_index: number };

export interface CompositeViewingPayload {
  temp_index: number;
  applicant_ref: CompositeApplicantRef;
  applicant_name: string;
  development_id: string;
  development_name: string;
  scheduled_at: string;
  duration_minutes: number;
  location: string | null;
  notes: string | null;
}

export interface CompositeCalendarPayload {
  preferred_provider: 'device' | 'google' | 'outlook' | 'apple' | 'skip' | null;
  ask_user: boolean;
}

export interface CompositeScheduleEnvelope {
  status: 'draft';
  type: 'composite_schedule';
  applicants_to_create: CompositeApplicantPayload[];
  viewings_to_create: CompositeViewingPayload[];
  calendar: CompositeCalendarPayload;
  message: string;
}

export type CalendarChoice = 'device' | 'google' | 'outlook' | 'apple' | 'skip';

interface DevelopmentOption {
  id: string;
  name: string;
}

interface CompositeScheduleCardProps {
  envelope: CompositeScheduleEnvelope;
  developments?: DevelopmentOption[];
  /**
   * Called when the confirm path fails irrecoverably so the chat surface
   * can append a system note to the assistant message. Without this, the
   * next-turn LLM history would still claim "Scheduled..." even though
   * nothing was written. Same pattern as ApplicantCard's hook.
   */
  onConfirmFailed?: (note: string) => void;
}

type Phase = 'draft' | 'editing' | 'confirming' | 'receipt' | 'partial_error' | 'error' | 'cancelled';

interface ReceiptPayload {
  created_applicants: Array<{ temp_index: number; id: string; full_name: string; audit_log_id: string }>;
  created_viewings: Array<{ temp_index: number; id: string; applicant_id: string; scheduled_at: string; duration_minutes: number }>;
  calendar_choice: CalendarChoice;
  calendar_outcomes: Array<{ viewing_temp_index: number; status: 'added' | 'unavailable' | 'denied' | 'error' | 'skipped'; message?: string }>;
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
    weekday: 'short',
    day: 'numeric',
    month: 'short',
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
  const [datePart, timePart] = value.split('T');
  if (!datePart || !timePart) return new Date(value).toISOString();
  const [y, m, d] = datePart.split('-').map((n) => parseInt(n, 10));
  const [hh, mm] = timePart.split(':').map((n) => parseInt(n, 10));
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

function defaultCalendarChoice(envelope: CompositeScheduleEnvelope, isNative: boolean): CalendarChoice {
  if (envelope.calendar.preferred_provider) {
    return envelope.calendar.preferred_provider;
  }
  return isNative ? 'device' : 'skip';
}

export default function CompositeScheduleCard({ envelope, developments, onConfirmFailed }: CompositeScheduleCardProps) {
  const initialApplicantSelection = useMemo<Set<number>>(() => {
    return new Set(envelope.applicants_to_create.map((a) => a.temp_index));
  }, [envelope]);
  const initialViewingSelection = useMemo<Set<number>>(() => {
    return new Set(envelope.viewings_to_create.map((v) => v.temp_index));
  }, [envelope]);

  const [applicants, setApplicants] = useState<CompositeApplicantPayload[]>(envelope.applicants_to_create);
  const [viewings, setViewings] = useState<CompositeViewingPayload[]>(envelope.viewings_to_create);
  const [selectedApplicants, setSelectedApplicants] = useState<Set<number>>(initialApplicantSelection);
  const [selectedViewings, setSelectedViewings] = useState<Set<number>>(initialViewingSelection);
  const [expandedApplicants, setExpandedApplicants] = useState<Set<number>>(new Set());
  const [phase, setPhase] = useState<Phase>('draft');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptPayload | null>(null);
  const [showCalendarSection, setShowCalendarSection] = useState<boolean>(envelope.calendar.ask_user);
  const [isNative, setIsNative] = useState<boolean>(false);
  const [calendarChoice, setCalendarChoice] = useState<CalendarChoice>(
    defaultCalendarChoice(envelope, false),
  );

  // Detect Capacitor native context once so the iPhone / Apple options can
  // surface only where they're useful.
  useEffect(() => {
    let cancelled = false;
    isCapacitorNative()
      .then((native) => {
        if (cancelled) return;
        setIsNative(native);
        if (envelope.calendar.preferred_provider === null && native) {
          setCalendarChoice('device');
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [envelope]);

  // Whenever an applicant gets unchecked, force-disable any viewing that
  // points to them via new_index.
  useEffect(() => {
    setSelectedViewings((prev) => {
      const next = new Set(prev);
      for (const v of viewings) {
        if ('new_index' in v.applicant_ref && !selectedApplicants.has(v.applicant_ref.new_index)) {
          next.delete(v.temp_index);
        }
      }
      return next;
    });
  }, [selectedApplicants, viewings]);

  function toggleApplicant(idx: number) {
    setSelectedApplicants((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function toggleApplicantExpand(idx: number) {
    setExpandedApplicants((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function toggleViewing(idx: number) {
    setSelectedViewings((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function updateApplicant(temp_index: number, patch: Partial<CompositeApplicantPayload>) {
    setApplicants((prev) => prev.map((a) => (a.temp_index === temp_index ? { ...a, ...patch } : a)));
  }

  function updateViewing(temp_index: number, patch: Partial<CompositeViewingPayload>) {
    setViewings((prev) => prev.map((v) => (v.temp_index === temp_index ? { ...v, ...patch } : v)));
  }

  function viewingDisabled(v: CompositeViewingPayload): boolean {
    if ('new_index' in v.applicant_ref) {
      return !selectedApplicants.has(v.applicant_ref.new_index);
    }
    return false;
  }

  async function writeDeviceCalendarEvents(payload: ReceiptPayload, sourceViewings: CompositeViewingPayload[]): Promise<ReceiptPayload> {
    if (payload.calendar_choice !== 'device') return payload;
    const outcomes: ReceiptPayload['calendar_outcomes'] = [];
    for (const created of payload.created_viewings) {
      const source = sourceViewings.find((v) => v.temp_index === created.temp_index);
      if (!source) continue;
      const start = new Date(created.scheduled_at).getTime();
      const end = start + created.duration_minutes * 60 * 1000;
      const result = await addEventToDeviceCalendar({
        title: `Viewing: ${source.applicant_name} at ${source.development_name}`,
        startMs: start,
        endMs: end,
        location: source.location ?? source.development_name,
        notes: source.notes ?? undefined,
      });
      let status: 'added' | 'unavailable' | 'denied' | 'error' = 'added';
      let message: string | undefined;
      if (result.status === 'created') {
        status = 'added';
        try {
          await fetch(`/api/agent-intelligence/viewings/${created.id}/calendar`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ device_calendar_event_id: result.eventId }),
          });
        } catch {
          // Non-blocking. The DB row exists, the device event exists.
        }
      } else if (result.status === 'denied') {
        status = 'denied';
      } else if (result.status === 'unavailable') {
        status = 'unavailable';
      } else {
        status = 'error';
        message = result.message;
      }
      outcomes.push({ viewing_temp_index: created.temp_index, status, message });
    }
    return { ...payload, calendar_outcomes: outcomes };
  }

  async function runConfirm() {
    setPhase('confirming');
    setErrorText(null);
    try {
      const body = {
        applicants_to_create: applicants.map((a) => ({
          full_name: a.full_name,
          email: a.email,
          phone: a.phone,
        })),
        viewings_to_create: viewings.map((v) => ({
          applicant_ref: v.applicant_ref,
          development_id: v.development_id,
          scheduled_at: v.scheduled_at,
          duration_minutes: v.duration_minutes,
          location: v.location,
          notes: v.notes,
        })),
        selected_indices: {
          applicants: Array.from(selectedApplicants.values()).sort((a, b) => a - b),
          viewings: Array.from(selectedViewings.values()).sort((a, b) => a - b),
        },
        calendar_choice: calendarChoice,
      };
      const res = await fetch('/api/agent-intelligence/confirm-composite-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Couldn't schedule");
      }
      const data = await res.json();

      const calendarOutcomes: ReceiptPayload['calendar_outcomes'] =
        calendarChoice === 'skip'
          ? data.created_viewings.map((cv: any) => ({ viewing_temp_index: cv.temp_index, status: 'skipped' }))
          : calendarChoice === 'google' || calendarChoice === 'outlook' || calendarChoice === 'apple'
            ? data.created_viewings.map((cv: any) => ({
                viewing_temp_index: cv.temp_index,
                status: 'unavailable',
                message: 'Connect your calendar in Settings to enable sync.',
              }))
            : [];

      let receiptPayload: ReceiptPayload = {
        created_applicants: data.created_applicants ?? [],
        created_viewings: data.created_viewings ?? [],
        calendar_choice: calendarChoice,
        calendar_outcomes: calendarOutcomes,
      };

      if (calendarChoice === 'device') {
        receiptPayload = await writeDeviceCalendarEvents(receiptPayload, viewings);
      }

      setReceipt(receiptPayload);
      setPhase('receipt');
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't schedule";
      setErrorText(message);
      setPhase('error');
      onConfirmFailed?.(`Composite schedule failed, no applicants or viewings were created. Reason: ${message}`);
    }
  }

  function cancel() {
    // TODO: remove after freeze diagnosis (cancel-freeze diagnostic PR).
    console.time('[FREEZE_DIAG] CompositeScheduleCard.cancel');
    console.log('[FREEZE_DIAG] cancel start', {
      card: 'CompositeScheduleCard',
      phase,
      envelopeViewingCount: envelope.viewings_to_create.length,
      envelopeApplicantCount: envelope.applicants_to_create.length,
      timestamp: Date.now(),
    });
    setPhase('cancelled');
    queueMicrotask(() => {
      console.timeEnd('[FREEZE_DIAG] CompositeScheduleCard.cancel');
    });
  }

  if (phase === 'cancelled') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <div style={{ ...cardSurface, gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <X size={16} strokeWidth={2} style={{ color: '#9CA3AF' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#6B7280' }}>Nothing scheduled</span>
          </div>
          <span style={{ fontSize: 12.5, color: '#6B7280' }}>Cancelled before save.</span>
        </div>
      </div>
    );
  }

  if (phase === 'receipt' && receipt) {
    return <ReceiptView receipt={receipt} sourceApplicants={applicants} sourceViewings={viewings} />;
  }

  // Header content varies by phase
  const isError = phase === 'error';
  const headerLabel = isError
    ? "Couldn't schedule"
    : envelope.viewings_to_create.length === 1
      ? 'Schedule viewing'
      : `Schedule ${envelope.viewings_to_create.length} viewings`;
  const newApplicantCount = envelope.applicants_to_create.length;

  const cardSurfaceForPhase: React.CSSProperties = isError
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
          {isError ? (
            <AlertTriangle size={16} strokeWidth={2.25} style={{ color: '#B91C1C' }} />
          ) : (
            <Zap size={16} strokeWidth={2} style={{ color: '#0D0D12' }} />
          )}
          <span style={{ fontSize: 13, fontWeight: 600, color: isError ? '#B91C1C' : '#0D0D12' }}>{headerLabel}</span>
          {!isError && newApplicantCount > 0 && (
            <span style={{ fontSize: 11.5, color: '#9CA3AF', fontWeight: 500 }}>
              {newApplicantCount} new applicant{newApplicantCount === 1 ? '' : 's'}
            </span>
          )}
        </div>

        {applicants.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={sectionLabelText}>New applicants</span>
            {applicants.map((a) => {
              const checked = selectedApplicants.has(a.temp_index);
              const expanded = expandedApplicants.has(a.temp_index);
              return (
                <div
                  key={`a-${a.temp_index}`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    padding: '10px 12px',
                    background: checked ? '#FFFFFF' : '#FAFAFA',
                    border: `0.5px solid ${checked ? 'rgba(0,0,0,0.10)' : 'rgba(0,0,0,0.06)'}`,
                    borderRadius: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Checkbox checked={checked} onClick={() => toggleApplicant(a.temp_index)} disabled={phase === 'editing'} />
                    <UserPlus size={13} strokeWidth={2} style={{ color: '#6B7280', flexShrink: 0 }} />
                    {phase === 'editing' ? (
                      <input
                        type="text"
                        value={a.full_name}
                        onChange={(e) => updateApplicant(a.temp_index, { full_name: e.target.value })}
                        style={inlineInputStyle}
                      />
                    ) : (
                      <span style={{ ...valueText, flex: 1 }}>{a.full_name}</span>
                    )}
                    {phase !== 'editing' && (
                      <button
                        type="button"
                        onClick={() => toggleApplicantExpand(a.temp_index)}
                        aria-label={expanded ? 'Collapse details' : 'Add contact details'}
                        className="agent-tappable"
                        style={chevronButtonStyle}
                      >
                        {expanded ? <ChevronUp size={14} strokeWidth={2} /> : <ChevronDown size={14} strokeWidth={2} />}
                      </button>
                    )}
                  </div>
                  {(expanded || phase === 'editing') && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 30 }}>
                      <ContactInputRow
                        label="Email"
                        value={a.email ?? ''}
                        placeholder="optional"
                        onChange={(v) => updateApplicant(a.temp_index, { email: v.trim() || null })}
                      />
                      <ContactInputRow
                        label="Phone"
                        value={a.phone ?? ''}
                        placeholder="optional"
                        onChange={(v) => updateApplicant(a.temp_index, { phone: v.trim() || null })}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={sectionLabelText}>Viewings</span>
          {viewings.map((v) => {
            const checked = selectedViewings.has(v.temp_index);
            const disabled = viewingDisabled(v);
            const sched = formatScheduled(v.scheduled_at);
            return (
              <div
                key={`v-${v.temp_index}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  padding: '10px 12px',
                  background: checked && !disabled ? '#FFFFFF' : '#FAFAFA',
                  border: `0.5px solid ${checked && !disabled ? 'rgba(0,0,0,0.10)' : 'rgba(0,0,0,0.06)'}`,
                  borderRadius: 12,
                  opacity: disabled ? 0.6 : 1,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <Checkbox
                    checked={checked && !disabled}
                    disabled={disabled || phase === 'editing'}
                    onClick={() => toggleViewing(v.temp_index)}
                  />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={valueText}>{v.applicant_name}</span>
                    {phase === 'editing' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <input
                          type="datetime-local"
                          value={isoToLocalInputValue(v.scheduled_at)}
                          onChange={(e) => updateViewing(v.temp_index, { scheduled_at: localInputValueToIso(e.target.value) })}
                          style={inlineInputStyle}
                        />
                        <select
                          value={v.development_id}
                          onChange={(e) => {
                            const opt = (developments && developments.length > 0
                              ? developments
                              : [{ id: v.development_id, name: v.development_name }]).find((o) => o.id === e.target.value);
                            updateViewing(v.temp_index, {
                              development_id: e.target.value,
                              development_name: opt?.name ?? v.development_name,
                              location: opt?.name ?? v.location,
                            });
                          }}
                          style={inlineInputStyle}
                        >
                          {(developments && developments.length > 0
                            ? developments
                            : [{ id: v.development_id, name: v.development_name }]).map((opt) => (
                            <option key={opt.id} value={opt.id}>{opt.name}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <>
                        <span style={{ fontSize: 12, color: '#6B7280' }}>
                          {sched.date} at {sched.time}
                        </span>
                        <span style={{ fontSize: 12, color: '#6B7280' }}>
                          {v.development_name}
                        </span>
                      </>
                    )}
                    {disabled && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#8A6A00' }}>
                        <AlertTriangle size={11} strokeWidth={2.25} />
                        Needs the applicant above
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {(showCalendarSection || phase === 'editing') ? (
          <CalendarSection
            choice={calendarChoice}
            onChange={setCalendarChoice}
            isNative={isNative}
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Calendar size={13} strokeWidth={2} style={{ color: '#6B7280' }} />
            <span style={{ fontSize: 12, color: '#6B7280' }}>
              {calendarChoice === 'skip' ? 'Skipping calendar' : `Calendar: ${calendarLabel(calendarChoice, isNative)}`}
            </span>
            <button
              type="button"
              onClick={() => setShowCalendarSection(true)}
              className="agent-tappable"
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: 12,
                fontWeight: 600,
                color: '#8A6E1F',
                cursor: 'pointer',
                fontFamily: 'inherit',
                padding: 0,
              }}
            >
              Change
            </button>
          </div>
        )}

        {isError && errorText && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#B91C1C' }}>
            <AlertTriangle size={14} strokeWidth={2.25} />
            <span style={{ fontSize: 12.5, fontWeight: 500 }}>{errorText}</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
          {phase === 'editing' ? (
            <button type="button" style={primaryButton} onClick={() => setPhase('draft')} className="agent-tappable">
              <Check size={14} strokeWidth={2.25} />
              Done editing
            </button>
          ) : (
            <>
              <button
                type="button"
                style={primaryButton}
                onClick={runConfirm}
                disabled={phase === 'confirming' || selectedViewings.size === 0}
                className="agent-tappable"
              >
                {phase === 'confirming' ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Scheduling
                  </>
                ) : (
                  <>
                    <Check size={14} strokeWidth={2.25} />
                    {phase === 'error' ? 'Try again' : 'Confirm all'}
                  </>
                )}
              </button>
              <button type="button" style={secondaryButton} onClick={() => setPhase('editing')} className="agent-tappable" disabled={phase === 'confirming'}>
                <Pencil size={14} strokeWidth={2.25} />
                Edit
              </button>
              <button type="button" style={tertiaryButton} onClick={cancel} className="agent-tappable" disabled={phase === 'confirming'}>
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const inlineInputStyle: React.CSSProperties = {
  padding: '6px 10px',
  fontSize: 13,
  border: '0.5px solid rgba(0,0,0,0.16)',
  borderRadius: 8,
  background: '#FFFFFF',
  color: '#0D0D12',
  fontFamily: 'inherit',
  width: '100%',
};

const chevronButtonStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 12,
  background: 'transparent',
  border: 'none',
  color: '#6B7280',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  flexShrink: 0,
};

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

function ContactInputRow({ label, value, placeholder, onChange }: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ ...labelText, width: 50 }}>{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...inlineInputStyle, flex: 1 }}
      />
    </div>
  );
}

function calendarLabel(choice: CalendarChoice, isNative: boolean): string {
  switch (choice) {
    case 'device':
      return isNative ? 'iPhone calendar' : 'Device calendar';
    case 'google':
      return 'Google Calendar';
    case 'outlook':
      return 'Outlook';
    case 'apple':
      return 'Apple Calendar';
    case 'skip':
      return 'Skipped';
  }
}

function CalendarSection({
  choice,
  onChange,
  isNative,
}: {
  choice: CalendarChoice;
  onChange: (next: CalendarChoice) => void;
  isNative: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={sectionLabelText}>Calendar</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {isNative && (
          <CalendarOption
            selected={choice === 'device'}
            onSelect={() => onChange('device')}
            icon={<Smartphone size={13} strokeWidth={2} />}
            label="Add to your iPhone calendar"
          />
        )}
        <CalendarOption
          selected={choice === 'google'}
          onSelect={() => onChange('google')}
          icon={<Calendar size={13} strokeWidth={2} />}
          label="Add to Google Calendar"
          rightSlot={<ConnectLink href="/agent/settings/autonomy" />}
        />
        <CalendarOption
          selected={choice === 'outlook'}
          onSelect={() => onChange('outlook')}
          icon={<Calendar size={13} strokeWidth={2} />}
          label="Add to Outlook"
          rightSlot={<ConnectLink href="/agent/settings/autonomy" />}
        />
        {!isNative && (
          <CalendarOption
            selected={choice === 'apple'}
            onSelect={() => onChange('apple')}
            icon={<Calendar size={13} strokeWidth={2} />}
            label="Add to Apple Calendar"
            rightSlot={<ConnectLink href="/agent/settings/autonomy" />}
          />
        )}
        <CalendarOption
          selected={choice === 'skip'}
          onSelect={() => onChange('skip')}
          icon={<X size={13} strokeWidth={2} />}
          label="Skip calendar"
        />
      </div>
    </div>
  );
}

function CalendarOption({
  selected,
  onSelect,
  icon,
  label,
  rightSlot,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  label: string;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button
        type="button"
        onClick={onSelect}
        className="agent-tappable"
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 10px',
          background: selected ? 'rgba(196,155,42,0.08)' : '#FFFFFF',
          border: `0.5px solid ${selected ? 'rgba(196,155,42,0.45)' : 'rgba(0,0,0,0.08)'}`,
          borderRadius: 10,
          fontSize: 12.5,
          fontWeight: selected ? 600 : 500,
          color: '#0D0D12',
          cursor: 'pointer',
          fontFamily: 'inherit',
          textAlign: 'left',
        }}
      >
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: 7,
            border: `1.5px solid ${selected ? '#C49B2A' : 'rgba(0,0,0,0.25)'}`,
            background: selected ? '#C49B2A' : '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {selected && <span style={{ width: 5, height: 5, borderRadius: 3, background: '#FFFFFF' }} />}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#374151' }}>
          {icon}
        </span>
        <span style={{ flex: 1 }}>{label}</span>
      </button>
      {rightSlot}
    </div>
  );
}

function ConnectLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="agent-tappable"
      style={{
        fontSize: 11.5,
        fontWeight: 600,
        color: '#8A6E1F',
        textDecoration: 'none',
        background: 'rgba(196,155,42,0.10)',
        padding: '4px 8px',
        borderRadius: 999,
        flexShrink: 0,
      }}
    >
      Connect
    </Link>
  );
}

function ReceiptView({
  receipt,
  sourceApplicants,
  sourceViewings,
}: {
  receipt: ReceiptPayload;
  sourceApplicants: CompositeApplicantPayload[];
  sourceViewings: CompositeViewingPayload[];
}) {
  const calendarLine = (() => {
    if (receipt.calendar_choice === 'skip') {
      return 'Skipped calendar.';
    }
    if (receipt.calendar_choice === 'device') {
      const added = receipt.calendar_outcomes.filter((o) => o.status === 'added').length;
      const total = receipt.calendar_outcomes.length;
      if (added === total && total > 0) return 'Added to your iPhone calendar.';
      if (added === 0) return "Couldn't add to your iPhone calendar. Tap a viewing to retry.";
      return `Added ${added} of ${total} to your iPhone calendar.`;
    }
    if (receipt.calendar_choice === 'google') return 'Google Calendar will sync once connected.';
    if (receipt.calendar_choice === 'outlook') return 'Outlook will sync once connected.';
    return 'Apple Calendar will sync once connected.';
  })();

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
      <div style={cardSurface}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Check size={16} strokeWidth={2.25} style={{ color: '#10703C' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#0D0D12' }}>Done</span>
        </div>

        {receipt.created_applicants.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={sectionLabelText}>Applicants created</span>
            {receipt.created_applicants.map((a) => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserPlus size={13} strokeWidth={2} style={{ color: '#10703C' }} />
                <span style={{ ...valueText, flex: 1 }}>Created {a.full_name}</span>
                <Link
                  href={`/agent/applicants/${a.id}`}
                  className="agent-tappable"
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: '#0D0D12',
                    background: '#F4F4F5',
                    border: '0.5px solid rgba(0,0,0,0.08)',
                    padding: '4px 10px',
                    borderRadius: 999,
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  View
                  <ArrowRight size={11} strokeWidth={2.25} />
                </Link>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={sectionLabelText}>Viewings scheduled</span>
          {receipt.created_viewings.map((cv) => {
            const source = sourceViewings.find((v) => v.temp_index === cv.temp_index);
            const sched = formatScheduled(cv.scheduled_at);
            const name = source?.applicant_name ?? '';
            return (
              <div key={cv.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Calendar size={13} strokeWidth={2} style={{ color: '#10703C' }} />
                <span style={{ ...valueText, flex: 1 }}>
                  {name ? `Scheduled with ${name}, ` : 'Scheduled '}{sched.date} {sched.time}
                </span>
                <Link
                  href={`/viewings/${cv.id}`}
                  className="agent-tappable"
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: '#0D0D12',
                    background: '#F4F4F5',
                    border: '0.5px solid rgba(0,0,0,0.08)',
                    padding: '4px 10px',
                    borderRadius: 999,
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  Open
                  <ArrowRight size={11} strokeWidth={2.25} />
                </Link>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#10703C' }}>
          <Calendar size={13} strokeWidth={2.25} />
          <span style={{ fontSize: 12.5, fontWeight: 500 }}>{calendarLine}</span>
        </div>
        {/* sourceApplicants is intentionally accepted but not rendered in the
            receipt; it's reserved for the partial_error branch which can
            inspect what was attempted vs what landed. Keeping the parameter
            stable lets future error UI reach for it without a breaking
            signature change. */}
        {sourceApplicants.length === 0 && null}
      </div>
    </div>
  );
}
