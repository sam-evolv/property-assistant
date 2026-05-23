export const EVENT_TYPES = [
  'handover',
  'snag_visit',
  'contractor_visit',
  'homeowner_appointment',
  'inspection',
  'custom',
] as const;

export type ScheduleEventType = (typeof EVENT_TYPES)[number];

export const EVENT_TYPE_COLOURS: Record<ScheduleEventType, string> = {
  handover: '#D4AF37',
  snag_visit: '#3b82f6',
  contractor_visit: '#f97316',
  homeowner_appointment: '#10b981',
  inspection: '#8b5cf6',
  custom: '#6b7280',
};

export const EVENT_TYPE_LABELS: Record<ScheduleEventType, string> = {
  handover: 'Handover',
  snag_visit: 'Snag visit',
  contractor_visit: 'Contractor visit',
  homeowner_appointment: 'Homeowner appointment',
  inspection: 'Inspection',
  custom: 'Other',
};

export const ATTENDEE_ROLES = [
  'organiser',
  'site_team',
  'snagger',
  'contractor',
  'homeowner',
  'other',
] as const;

export type AttendeeRole = (typeof ATTENDEE_ROLES)[number];

export const ATTENDEE_ROLE_LABELS: Record<AttendeeRole, string> = {
  organiser: 'Organiser',
  site_team: 'Site team',
  snagger: 'Snagger',
  contractor: 'Contractor',
  homeowner: 'Homeowner',
  other: 'Other',
};

export type RsvpStatus = 'invited' | 'confirmed' | 'declined' | 'tentative';

export interface ScheduleAttendee {
  id: string;
  user_id: string | null;
  external_email: string | null;
  external_name: string | null;
  role: string | null;
  rsvp_status: RsvpStatus;
}

export interface ScheduleEvent {
  id: string;
  tenant_id: string;
  development_id: string | null;
  unit_id: string | null;
  event_type: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  location: string | null;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  created_by: string;
  created_at: string;
  updated_at: string;
  unit_label: string | null;
  development_label: string | null;
  attendees: ScheduleAttendee[];
}

export function eventTypeColour(type: string): string {
  return (EVENT_TYPE_COLOURS as Record<string, string>)[type] ?? EVENT_TYPE_COLOURS.custom;
}

export function eventTypeLabel(type: string): string {
  return (EVENT_TYPE_LABELS as Record<string, string>)[type] ?? type;
}

export function formatDublinTime(iso: string): string {
  return new Intl.DateTimeFormat('en-IE', {
    timeZone: 'Europe/Dublin',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

export function formatDublinDate(iso: string): string {
  return new Intl.DateTimeFormat('en-IE', {
    timeZone: 'Europe/Dublin',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

export function dublinDateKey(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Dublin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const y = parts.find((p) => p.type === 'year')!.value;
  const m = parts.find((p) => p.type === 'month')!.value;
  const day = parts.find((p) => p.type === 'day')!.value;
  return `${y}-${m}-${day}`;
}

export function startOfDublinWeek(d: Date): Date {
  const key = dublinDateKey(d);
  const [y, m, day] = key.split('-').map((s) => parseInt(s, 10));
  const dt = new Date(Date.UTC(y, m - 1, day, 12, 0, 0));
  const dow = new Date(dt.toLocaleString('en-US', { timeZone: 'Europe/Dublin' })).getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  dt.setUTCDate(dt.getUTCDate() + mondayOffset);
  return dt;
}

export function addDays(d: Date, n: number): Date {
  const next = new Date(d.getTime());
  next.setUTCDate(next.getUTCDate() + n);
  return next;
}

export function formatRangeLabel(from: Date, to: Date): string {
  const fmt = new Intl.DateTimeFormat('en-IE', {
    timeZone: 'Europe/Dublin',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const yearFmt = new Intl.DateTimeFormat('en-IE', {
    timeZone: 'Europe/Dublin',
    year: 'numeric',
  });
  return `${fmt.format(from)} to ${fmt.format(to)} ${yearFmt.format(to)}`;
}

export function formatMonthLabel(d: Date): string {
  return new Intl.DateTimeFormat('en-IE', {
    timeZone: 'Europe/Dublin',
    month: 'long',
    year: 'numeric',
  }).format(d);
}
