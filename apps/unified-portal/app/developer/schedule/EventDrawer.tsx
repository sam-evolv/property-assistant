'use client';

import { useCallback, useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Calendar, MapPin, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  AttendeeRole,
  ATTENDEE_ROLE_LABELS,
  eventTypeColour,
  eventTypeLabel,
  formatDublinDate,
  formatDublinTime,
  RsvpStatus,
  ScheduleEvent,
} from './eventTypes';

interface EventDrawerProps {
  eventId: string | null;
  currentUserId: string;
  canWrite: boolean;
  onClose: () => void;
  onChanged: () => void;
  onEdit: (event: ScheduleEvent) => void;
}

const RSVP_BADGE_STYLES: Record<RsvpStatus, string> = {
  confirmed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  declined: 'bg-red-100 text-red-700 border-red-200',
  tentative: 'bg-amber-100 text-amber-700 border-amber-200',
  invited: 'bg-neutral-100 text-neutral-600 border-neutral-200',
};

const RSVP_BADGE_LABELS: Record<RsvpStatus, string> = {
  confirmed: 'Confirmed',
  declined: 'Declined',
  tentative: 'Tentative',
  invited: 'Invited',
};

const STATUS_BADGE_STYLES: Record<ScheduleEvent['status'], string> = {
  scheduled: 'bg-blue-50 text-blue-700 border-blue-200',
  in_progress: 'bg-amber-50 text-amber-700 border-amber-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-neutral-100 text-neutral-600 border-neutral-200',
};

const STATUS_BADGE_LABELS: Record<ScheduleEvent['status'], string> = {
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

function formatTimeRange(event: ScheduleEvent): string {
  if (event.all_day) {
    return `${formatDublinDate(event.starts_at)}, all day`;
  }
  const dateLabel = formatDublinDate(event.starts_at);
  if (event.ends_at) {
    return `${dateLabel}, ${formatDublinTime(event.starts_at)} - ${formatDublinTime(event.ends_at)}`;
  }
  return `${dateLabel}, ${formatDublinTime(event.starts_at)}`;
}

export function EventDrawer({
  eventId,
  currentUserId,
  canWrite,
  onClose,
  onChanged,
  onEdit,
}: EventDrawerProps) {
  const [data, setData] = useState<ScheduleEvent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rsvpBusy, setRsvpBusy] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);

  const load = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/schedule/events/${eventId}`, { cache: 'no-store' });
      if (!res.ok) {
        setError(res.status === 404 ? 'Event not found.' : "Couldn't load this event.");
        setData(null);
        return;
      }
      const json = (await res.json()) as ScheduleEvent;
      setData(json);
    } catch {
      setError("Couldn't load this event.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (!eventId) {
      setData(null);
      setError(null);
      setConfirmCancelOpen(false);
      return;
    }
    void load();
  }, [eventId, load]);

  useEffect(() => {
    if (!eventId) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = prev;
    };
  }, [eventId, onClose]);

  const myAttendee = data?.attendees.find((a) => a.user_id === currentUserId);

  const sendRsvp = async (next: 'confirmed' | 'declined' | 'tentative') => {
    if (!eventId || rsvpBusy) return;
    setRsvpBusy(true);
    try {
      const res = await fetch(`/api/schedule/events/${eventId}/rsvp`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rsvp_status: next }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast.error(json?.error ?? "Couldn't update RSVP");
        return;
      }
      toast.success(`RSVP set to ${next}.`);
      await load();
      onChanged();
    } finally {
      setRsvpBusy(false);
    }
  };

  const confirmCancel = async () => {
    if (!eventId || cancelBusy) return;
    setCancelBusy(true);
    try {
      const res = await fetch(`/api/schedule/events/${eventId}/cancel`, { method: 'POST' });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast.error(json?.error ?? "Couldn't cancel event");
        return;
      }
      toast.success('Event cancelled.');
      setConfirmCancelOpen(false);
      await load();
      onChanged();
    } finally {
      setCancelBusy(false);
    }
  };

  if (!eventId) return null;

  return (
    <>
      <div className="fixed inset-0 z-modal flex justify-end" role="dialog" aria-modal="true" aria-label="Event detail">
        <button
          type="button"
          aria-label="Close event detail"
          onClick={onClose}
          className="absolute inset-0 bg-neutral-900/40"
        />
        <div className="relative bg-white w-full sm:w-[560px] sm:max-w-[560px] h-full shadow-2xl flex flex-col overflow-hidden">
          <header className="flex items-center gap-1 px-4 py-3 border-b border-neutral-200 bg-white">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-10 h-10 -ml-2 flex items-center justify-center rounded-lg text-neutral-700 hover:bg-neutral-100"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              {data ? (
                <div className="flex items-center gap-2 min-w-0">
                  <h2 className="text-sm font-semibold text-neutral-900 truncate">{data.title}</h2>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE_STYLES[data.status]}`}
                  >
                    {STATUS_BADGE_LABELS[data.status]}
                  </span>
                </div>
              ) : (
                <h2 className="text-sm font-semibold text-neutral-500">Event</h2>
              )}
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {loading && !data ? (
              <p className="text-sm text-neutral-500">Loading event...</p>
            ) : error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : data ? (
              <>
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium text-white"
                    style={{ backgroundColor: eventTypeColour(data.event_type) }}
                  >
                    {eventTypeLabel(data.event_type)}
                  </span>
                </div>
                <div className="flex items-start gap-2 text-sm text-neutral-700">
                  <Calendar className="w-4 h-4 text-neutral-400 mt-0.5 flex-shrink-0" />
                  <span>{formatTimeRange(data)}</span>
                </div>
                {data.location ? (
                  <div className="flex items-start gap-2 text-sm text-neutral-700">
                    <MapPin className="w-4 h-4 text-neutral-400 mt-0.5 flex-shrink-0" />
                    <span>{data.location}</span>
                  </div>
                ) : null}
                {data.unit_label || data.development_label ? (
                  <div className="text-sm text-neutral-700 space-y-1">
                    {data.unit_label ? (
                      <div>
                        Unit:{' '}
                        {data.unit_id ? (
                          <a
                            href={`/developer/homeowners`}
                            className="text-gold-700 hover:text-gold-800"
                          >
                            {data.unit_label}
                          </a>
                        ) : (
                          <span>{data.unit_label}</span>
                        )}
                      </div>
                    ) : null}
                    {data.development_label ? (
                      <div>
                        Development: <span>{data.development_label}</span>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {data.description ? (
                  <div className="text-sm text-neutral-800 whitespace-pre-wrap leading-relaxed">
                    {data.description}
                  </div>
                ) : null}

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">
                    Attendees ({data.attendees.length})
                  </h3>
                  {data.attendees.length === 0 ? (
                    <p className="text-sm text-neutral-500">No attendees on this event.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {data.attendees.map((a) => (
                        <li
                          key={a.id}
                          className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-neutral-200"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-neutral-900 truncate">
                              {a.external_name ?? a.external_email ?? 'Team member'}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-neutral-500 mt-0.5">
                              {a.role ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600">
                                  {ATTENDEE_ROLE_LABELS[a.role as AttendeeRole] ?? a.role}
                                </span>
                              ) : null}
                              {a.external_email && a.external_name ? (
                                <span className="truncate">{a.external_email}</span>
                              ) : null}
                            </div>
                          </div>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${RSVP_BADGE_STYLES[a.rsvp_status]}`}
                          >
                            {RSVP_BADGE_LABELS[a.rsvp_status]}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {myAttendee && data.status !== 'cancelled' ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-neutral-500">Your RSVP:</span>
                      <button
                        type="button"
                        disabled={rsvpBusy}
                        onClick={() => void sendRsvp('confirmed')}
                        className="px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-medium disabled:opacity-50"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        disabled={rsvpBusy}
                        onClick={() => void sendRsvp('tentative')}
                        className="px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-medium disabled:opacity-50"
                      >
                        Tentative
                      </button>
                      <button
                        type="button"
                        disabled={rsvpBusy}
                        onClick={() => void sendRsvp('declined')}
                        className="px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-medium disabled:opacity-50"
                      >
                        Decline
                      </button>
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>

          {canWrite && data && data.status !== 'cancelled' ? (
            <div className="px-4 py-3 border-t border-neutral-200 bg-neutral-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmCancelOpen(true)}
                className="px-3 py-2 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-100"
              >
                Cancel event
              </button>
              <button
                type="button"
                onClick={() => onEdit(data)}
                className="px-3 py-2 rounded-lg text-sm font-medium text-white bg-gold-500 hover:bg-gold-600"
              >
                Edit
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <Dialog.Root open={confirmCancelOpen} onOpenChange={(o) => !cancelBusy && setConfirmCancelOpen(o)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[95vw] max-w-sm bg-white rounded-xl shadow-xl focus:outline-none">
            <div className="p-5 border-b border-gray-100">
              <Dialog.Title className="text-lg font-semibold text-gray-900">Cancel this event?</Dialog.Title>
              <Dialog.Description className="text-sm text-gray-500 mt-1">
                Attendees will not be notified automatically.
              </Dialog.Description>
            </div>
            <div className="flex items-center justify-end gap-2 p-5 bg-gray-50 rounded-b-xl">
              <button
                type="button"
                onClick={() => setConfirmCancelOpen(false)}
                disabled={cancelBusy}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50"
              >
                Keep
              </button>
              <button
                type="button"
                onClick={() => void confirmCancel()}
                disabled={cancelBusy}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg disabled:bg-red-300"
              >
                {cancelBusy ? 'Cancelling...' : 'Cancel event'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
