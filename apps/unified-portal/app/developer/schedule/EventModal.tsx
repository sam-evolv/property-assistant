'use client';

import { useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Plus, Search, Trash2, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  AttendeeRole,
  ATTENDEE_ROLES,
  ATTENDEE_ROLE_LABELS,
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
  ScheduleEvent,
  ScheduleEventType,
} from './eventTypes';

interface EventModalProps {
  editingEvent: ScheduleEvent | null;
  tenantId: string;
  onClose: () => void;
  onSaved: () => void;
}

interface DevelopmentOption {
  id: string;
  name: string;
}

interface MemberOption {
  user_id: string;
  email: string | null;
  role: string | null;
}

interface UnitOption {
  id: string;
  label: string;
}

interface AttendeeDraft {
  key: string;
  user_id: string | null;
  external_email: string | null;
  external_name: string | null;
  display_name: string;
  role: AttendeeRole;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isoDateLocal(iso: string): string {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
function isoTimeLocal(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}
function combineLocalToIso(date: string, time: string): string {
  return new Date(`${date}T${time || '00:00'}`).toISOString();
}

export function EventModal({ editingEvent, tenantId, onClose, onSaved }: EventModalProps) {
  const isEdit = !!editingEvent;

  const [lookupLoading, setLookupLoading] = useState(true);
  const [developments, setDevelopments] = useState<DevelopmentOption[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);

  const [title, setTitle] = useState(editingEvent?.title ?? '');
  const [eventType, setEventType] = useState<ScheduleEventType>(
    (editingEvent?.event_type as ScheduleEventType) ?? 'custom',
  );
  const [startDate, setStartDate] = useState(
    editingEvent ? isoDateLocal(editingEvent.starts_at) : '',
  );
  const [startTime, setStartTime] = useState(
    editingEvent && !editingEvent.all_day ? isoTimeLocal(editingEvent.starts_at) : '09:00',
  );
  const [endDate, setEndDate] = useState(
    editingEvent?.ends_at ? isoDateLocal(editingEvent.ends_at) : '',
  );
  const [endTime, setEndTime] = useState(
    editingEvent?.ends_at && !editingEvent.all_day ? isoTimeLocal(editingEvent.ends_at) : '10:00',
  );
  const [allDay, setAllDay] = useState(editingEvent?.all_day ?? false);
  const [location, setLocation] = useState(editingEvent?.location ?? '');
  const [developmentId, setDevelopmentId] = useState<string>(editingEvent?.development_id ?? '');
  const [unitId, setUnitId] = useState<string>(editingEvent?.unit_id ?? '');
  const [description, setDescription] = useState(editingEvent?.description ?? '');
  const [attendees, setAttendees] = useState<AttendeeDraft[]>(() =>
    (editingEvent?.attendees ?? []).map((a, idx) => ({
      key: `existing-${idx}-${a.id}`,
      user_id: a.user_id,
      external_email: a.external_email,
      external_name: a.external_name,
      display_name: a.external_name ?? a.external_email ?? 'Team member',
      role: ((a.role as AttendeeRole) && ATTENDEE_ROLES.includes(a.role as AttendeeRole)
        ? (a.role as AttendeeRole)
        : 'other') as AttendeeRole,
    })),
  );
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [memberPickerOpen, setMemberPickerOpen] = useState(false);
  const [memberQuery, setMemberQuery] = useState('');
  const [externalDraft, setExternalDraft] = useState<{ name: string; email: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      setLookupLoading(true);
      try {
        const res = await fetch('/api/schedule/lookups', { cache: 'no-store', signal: ac.signal });
        if (!res.ok) return;
        const json = (await res.json()) as { developments: DevelopmentOption[]; members: MemberOption[] };
        setDevelopments(json.developments ?? []);
        setMembers(json.members ?? []);
      } catch {
        // swallow; user can still type fields without lookups
      } finally {
        setLookupLoading(false);
      }
    })();
    return () => ac.abort();
  }, []);

  useEffect(() => {
    if (!developmentId) {
      setUnits([]);
      return;
    }
    const ac = new AbortController();
    (async () => {
      setUnitsLoading(true);
      try {
        const res = await fetch(`/api/schedule/lookups/units?development_id=${developmentId}`, {
          cache: 'no-store',
          signal: ac.signal,
        });
        if (!res.ok) {
          setUnits([]);
          return;
        }
        const json = (await res.json()) as { units: UnitOption[] };
        setUnits(json.units ?? []);
      } catch {
        setUnits([]);
      } finally {
        setUnitsLoading(false);
      }
    })();
    return () => ac.abort();
  }, [developmentId]);

  const filteredMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    const picked = new Set(attendees.filter((a) => a.user_id).map((a) => a.user_id as string));
    return members.filter((m) => {
      if (picked.has(m.user_id)) return false;
      if (!q) return true;
      return (m.email ?? '').toLowerCase().includes(q);
    });
  }, [members, memberQuery, attendees]);

  const addMemberAttendee = (member: MemberOption) => {
    setAttendees((prev) => [
      ...prev,
      {
        key: `member-${member.user_id}-${Date.now()}`,
        user_id: member.user_id,
        external_email: null,
        external_name: null,
        display_name: member.email ?? 'Team member',
        role: 'site_team',
      },
    ]);
    setMemberPickerOpen(false);
    setMemberQuery('');
  };

  const addExternalAttendee = () => {
    if (!externalDraft) return;
    const name = externalDraft.name.trim();
    const email = externalDraft.email.trim();
    if (!name) {
      toast.error('External attendee needs a name.');
      return;
    }
    if (!EMAIL_RE.test(email)) {
      toast.error('External attendee needs a valid email.');
      return;
    }
    setAttendees((prev) => [
      ...prev,
      {
        key: `external-${email}-${Date.now()}`,
        user_id: null,
        external_email: email,
        external_name: name,
        display_name: name,
        role: 'contractor',
      },
    ]);
    setExternalDraft(null);
  };

  const removeAttendee = (key: string) => {
    setAttendees((prev) => prev.filter((a) => a.key !== key));
  };

  const setAttendeeRole = (key: string, role: AttendeeRole) => {
    setAttendees((prev) => prev.map((a) => (a.key === key ? { ...a, role } : a)));
  };

  const handleSubmit = async () => {
    if (submitting) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error('Title is required.');
      return;
    }
    if (!startDate) {
      toast.error('Start date is required.');
      return;
    }
    const startsIso = combineLocalToIso(startDate, allDay ? '00:00' : startTime);
    const endsIso =
      endDate && !allDay
        ? combineLocalToIso(endDate, endTime)
        : endDate && allDay
        ? combineLocalToIso(endDate, '23:59')
        : null;
    if (endsIso && new Date(endsIso).getTime() < new Date(startsIso).getTime()) {
      toast.error('End must be on or after start.');
      return;
    }

    const payload: Record<string, unknown> = {
      title: trimmedTitle,
      event_type: eventType,
      starts_at: startsIso,
      ends_at: endsIso,
      all_day: allDay,
      location: location.trim() || null,
      description: description.trim() || null,
      development_id: developmentId || null,
      unit_id: unitId || null,
      attendees: attendees.map((a) => ({
        user_id: a.user_id,
        external_email: a.external_email,
        external_name: a.external_name,
        role: a.role,
      })),
    };

    setSubmitting(true);
    try {
      const res = await fetch(
        isEdit && editingEvent ? `/api/schedule/events/${editingEvent.id}` : '/api/schedule/events',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast.error(json?.error ?? "Couldn't save event");
        return;
      }
      onSaved();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog.Root open onOpenChange={(o) => !submitting && !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[95vw] max-w-2xl bg-white rounded-xl shadow-xl focus:outline-none max-h-[92vh] flex flex-col">
          <div className="flex items-start justify-between p-5 border-b border-gray-100">
            <div>
              <Dialog.Title className="text-lg font-semibold text-gray-900">
                {isEdit ? 'Edit event' : 'Add event'}
              </Dialog.Title>
              <Dialog.Description className="text-sm text-gray-500 mt-1">
                {isEdit ? 'Update the event details.' : 'Schedule a new event for your tenant.'}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                className="p-2 rounded-lg hover:bg-gray-100"
                aria-label="Close"
                disabled={submitting}
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500/40 focus:border-gold-400 text-sm"
                placeholder="What's the event?"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Event type</label>
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value as ScheduleEventType)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/40 focus:border-gold-400"
                >
                  {EVENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {EVENT_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end pb-2">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={allDay}
                    onChange={(e) => setAllDay(e.target.checked)}
                    className="rounded text-gold-500 focus:ring-gold-400"
                  />
                  All day
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/40 focus:border-gold-400"
                />
              </div>
              {!allDay ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start time</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/40 focus:border-gold-400"
                  />
                </div>
              ) : (
                <div />
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End date (optional)</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/40 focus:border-gold-400"
                />
              </div>
              {!allDay ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End time</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    disabled={!endDate}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/40 focus:border-gold-400 disabled:bg-gray-50"
                  />
                </div>
              ) : (
                <div />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location (optional)</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={200}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500/40 focus:border-gold-400 text-sm"
                placeholder="Site office, Block A meeting room, etc."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Development (optional)</label>
                <select
                  value={developmentId}
                  onChange={(e) => {
                    setDevelopmentId(e.target.value);
                    setUnitId('');
                  }}
                  disabled={lookupLoading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/40 focus:border-gold-400 disabled:bg-gray-50"
                >
                  <option value="">No development</option>
                  {developments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit (optional)</label>
                <select
                  value={unitId}
                  onChange={(e) => setUnitId(e.target.value)}
                  disabled={!developmentId || unitsLoading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/40 focus:border-gold-400 disabled:bg-gray-50"
                >
                  <option value="">{developmentId ? 'No unit' : 'Pick a development first'}</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={2000}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500/40 focus:border-gold-400 text-sm resize-y"
                placeholder="Add any context..."
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Attendees</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMemberPickerOpen(true)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-gold-700 hover:text-gold-800"
                  >
                    <Plus className="w-3 h-3" />
                    Add team member
                  </button>
                  <button
                    type="button"
                    onClick={() => setExternalDraft({ name: '', email: '' })}
                    className="inline-flex items-center gap-1 text-xs font-medium text-gold-700 hover:text-gold-800"
                  >
                    <Plus className="w-3 h-3" />
                    Add external
                  </button>
                </div>
              </div>
              {attendees.length === 0 ? (
                <p className="text-xs text-gray-500">No attendees added yet.</p>
              ) : (
                <ul className="space-y-2">
                  {attendees.map((a) => (
                    <li
                      key={a.key}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{a.display_name}</div>
                        {a.external_email ? (
                          <div className="text-xs text-gray-500 truncate">{a.external_email}</div>
                        ) : null}
                      </div>
                      <select
                        value={a.role}
                        onChange={(e) => setAttendeeRole(a.key, e.target.value as AttendeeRole)}
                        className="text-xs px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-gold-500/40"
                      >
                        {ATTENDEE_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ATTENDEE_ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => removeAttendee(a.key)}
                        className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                        aria-label="Remove attendee"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {memberPickerOpen ? (
                <div className="mt-2 rounded-lg border border-gray-200 bg-white p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search by email..."
                      value={memberQuery}
                      onChange={(e) => setMemberQuery(e.target.value)}
                      className="flex-1 text-sm bg-transparent focus:outline-none"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setMemberPickerOpen(false)}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="max-h-40 overflow-y-auto divide-y divide-gray-100">
                    {filteredMembers.length === 0 ? (
                      <p className="text-xs text-gray-400 py-2">No members match.</p>
                    ) : (
                      filteredMembers.map((m) => (
                        <button
                          key={m.user_id}
                          type="button"
                          onClick={() => addMemberAttendee(m)}
                          className="w-full text-left px-2 py-1.5 text-sm text-gray-800 hover:bg-gray-50 rounded"
                        >
                          {m.email ?? 'Team member'}
                          {m.role ? (
                            <span className="ml-2 text-xs text-gray-400">({m.role})</span>
                          ) : null}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
              {externalDraft ? (
                <div className="mt-2 rounded-lg border border-gray-200 bg-white p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Name"
                      value={externalDraft.name}
                      onChange={(e) => setExternalDraft((d) => (d ? { ...d, name: e.target.value } : null))}
                      className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/40"
                    />
                    <input
                      type="email"
                      placeholder="email@example.com"
                      value={externalDraft.email}
                      onChange={(e) => setExternalDraft((d) => (d ? { ...d, email: e.target.value } : null))}
                      className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/40"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setExternalDraft(null)}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={addExternalAttendee}
                      className="text-xs font-medium px-3 py-1.5 rounded bg-gold-500 hover:bg-gold-600 text-white"
                    >
                      Add
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-xl">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-gold-500 hover:bg-gold-600 rounded-lg disabled:bg-gold-300"
            >
              {submitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
