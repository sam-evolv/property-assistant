/**
 * /api/schedule/events/[id]
 *
 * Assistant V2 Sprint 4. Single-event detail and update endpoints.
 *
 * Spec: docs/specs/assistant-v2-sprint-4.md sections 5.2 and 5.4.
 *
 * GET: return the event with its full attendee list and joined
 * unit/development labels. admin and site_team can see any event in
 * their tenant; snagger_external is 403 unless they are an attendee or
 * the event is on a unit/development they can access.
 *
 * PATCH: update an event. admin and site_team only. tenant_id and
 * created_by are immutable. If attendees is provided, the existing
 * attendee list is replaced (delete + re-insert; service-role bypasses
 * RLS so the two-step is safe as long as we tolerate a brief window
 * between calls).
 *
 * Gated on FEATURE_SCHEDULE.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { isScheduleEnabled } from '@/lib/feature-flags';
import {
  resolveSnagAuth,
  snagAuthErrorToResponse,
  snagFeatureDisabledResponse,
  SnagAuthError,
  type SnagAuthContext,
} from '@/lib/assistant/snag-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TITLE = 200;
const MAX_DESCRIPTION = 2000;
const MAX_LOCATION = 200;

const EVENT_TYPES = new Set([
  'handover',
  'snag_visit',
  'contractor_visit',
  'homeowner_appointment',
  'inspection',
  'custom',
]);

const ATTENDEE_ROLES = new Set([
  'organiser',
  'site_team',
  'snagger',
  'contractor',
  'homeowner',
  'other',
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface RouteParams {
  params: { id: string };
}

interface AttendeeInput {
  user_id?: string | null;
  external_email?: string | null;
  external_name?: string | null;
  role?: string | null;
}

interface AttendeeRow {
  id: string;
  event_id: string;
  user_id: string | null;
  external_email: string | null;
  external_name: string | null;
  role: string | null;
  rsvp_status: string;
  created_at: string;
}

interface EventRow {
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
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

function parseAttendees(input: unknown): { value: AttendeeInput[]; error?: string } {
  if (input === undefined || input === null) return { value: [] };
  if (!Array.isArray(input)) return { value: [], error: 'attendees must be an array' };
  const out: AttendeeInput[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') {
      return { value: [], error: 'each attendee must be an object' };
    }
    const a = raw as Record<string, unknown>;
    const userId = typeof a.user_id === 'string' ? a.user_id : null;
    const externalEmail = typeof a.external_email === 'string' ? a.external_email : null;
    const externalName = typeof a.external_name === 'string' ? a.external_name : null;
    const role = typeof a.role === 'string' ? a.role : null;

    const hasUser = !!userId;
    const hasEmail = !!externalEmail;
    if (hasUser === hasEmail) {
      return {
        value: [],
        error: 'each attendee must have exactly one of user_id or external_email',
      };
    }
    if (userId && !UUID_RE.test(userId)) {
      return { value: [], error: 'attendee user_id must be a uuid' };
    }
    if (externalEmail && !EMAIL_RE.test(externalEmail)) {
      return { value: [], error: 'attendee external_email must be a valid email' };
    }
    if (role && !ATTENDEE_ROLES.has(role)) {
      return { value: [], error: 'attendee role is not one of the allowed values' };
    }
    out.push({
      user_id: userId,
      external_email: externalEmail,
      external_name: externalName,
      role,
    });
  }
  return { value: out };
}

function deriveUnitLabel(u: {
  unit_code: string | null;
  unit_number: string | null;
  address_line_1: string | null;
}): string {
  return u.unit_code ?? u.unit_number ?? u.address_line_1 ?? 'Unit';
}

async function loadEventBundle(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  event: EventRow,
): Promise<{
  attendees: AttendeeRow[];
  unitLabel: string | null;
  developmentLabel: string | null;
}> {
  const [attRes, unitRes, devRes] = await Promise.all([
    supabase
      .from('schedule_event_attendees')
      .select('id, event_id, user_id, external_email, external_name, role, rsvp_status, created_at')
      .eq('event_id', event.id),
    event.unit_id
      ? supabase
          .from('units')
          .select('id, unit_code, unit_number, address_line_1')
          .eq('id', event.unit_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    event.development_id
      ? supabase
          .from('developments')
          .select('id, name')
          .eq('id', event.development_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (attRes.error) {
    console.error('[schedule-event-detail] attendees_failed reason=%s', attRes.error.message);
  }
  if (unitRes.error) {
    console.error('[schedule-event-detail] unit_failed reason=%s', unitRes.error.message);
  }
  if (devRes.error) {
    console.error('[schedule-event-detail] dev_failed reason=%s', devRes.error.message);
  }

  const unitData = unitRes.data as
    | { unit_code: string | null; unit_number: string | null; address_line_1: string | null }
    | null;
  const devData = devRes.data as { name: string | null } | null;

  return {
    attendees: (attRes.data ?? []) as AttendeeRow[],
    unitLabel: unitData ? deriveUnitLabel(unitData) : null,
    developmentLabel: devData ? devData.name ?? 'Development' : null,
  };
}

function shapeEventResponse(
  event: EventRow,
  attendees: AttendeeRow[],
  unitLabel: string | null,
  developmentLabel: string | null,
) {
  return {
    id: event.id,
    tenant_id: event.tenant_id,
    development_id: event.development_id,
    unit_id: event.unit_id,
    event_type: event.event_type,
    title: event.title,
    description: event.description,
    starts_at: event.starts_at,
    ends_at: event.ends_at,
    all_day: event.all_day,
    location: event.location,
    status: event.status,
    created_by: event.created_by,
    created_at: event.created_at,
    updated_at: event.updated_at,
    unit_label: unitLabel,
    development_label: developmentLabel,
    attendees: attendees.map((a) => ({
      id: a.id,
      user_id: a.user_id,
      external_email: a.external_email,
      external_name: a.external_name,
      role: a.role,
      rsvp_status: a.rsvp_status,
    })),
  };
}

async function loadEventForCaller(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  auth: SnagAuthContext,
  eventId: string,
): Promise<
  | { kind: 'ok'; event: EventRow; attendees: AttendeeRow[] }
  | { kind: 'not_found' }
  | { kind: 'forbidden' }
  | { kind: 'error'; message: string }
> {
  const { data: eventData, error: eventErr } = await supabase
    .from('schedule_events')
    .select(
      'id, tenant_id, development_id, unit_id, event_type, title, description, starts_at, ends_at, all_day, location, status, created_by, created_at, updated_at',
    )
    .eq('id', eventId)
    .maybeSingle();
  if (eventErr) {
    return { kind: 'error', message: eventErr.message };
  }
  if (!eventData) {
    return { kind: 'not_found' };
  }
  const event = eventData as EventRow;
  if (event.tenant_id !== auth.tenantId) {
    return { kind: 'forbidden' };
  }

  const { data: attData, error: attErr } = await supabase
    .from('schedule_event_attendees')
    .select('id, event_id, user_id, external_email, external_name, role, rsvp_status, created_at')
    .eq('event_id', eventId);
  if (attErr) {
    return { kind: 'error', message: attErr.message };
  }
  const attendees = (attData ?? []) as AttendeeRow[];

  if (auth.role === 'snagger_external') {
    const allowedDevs = Array.isArray(auth.developmentIds) ? auth.developmentIds : [];
    const isAttendee = attendees.some((a) => a.user_id === auth.userId);
    const devOk = event.development_id ? allowedDevs.includes(event.development_id) : false;
    if (!isAttendee && !devOk) {
      return { kind: 'forbidden' };
    }
  }

  return { kind: 'ok', event, attendees };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  if (!isScheduleEnabled()) {
    return snagFeatureDisabledResponse();
  }

  const eventId = params.id;
  if (!UUID_RE.test(eventId)) {
    return NextResponse.json({ error: 'id must be a uuid' }, { status: 400 });
  }

  let auth: SnagAuthContext;
  try {
    auth = await resolveSnagAuth(request);
  } catch (err) {
    if (err instanceof SnagAuthError) return snagAuthErrorToResponse(err);
    throw err;
  }

  const supabase = getSupabaseAdmin();
  const result = await loadEventForCaller(supabase, auth, eventId);
  if (result.kind === 'error') {
    console.error('[schedule-event-detail] lookup_failed reason=%s', result.message);
    return NextResponse.json({ error: 'Could not load event' }, { status: 500 });
  }
  if (result.kind === 'not_found') {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }
  if (result.kind === 'forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const bundle = await loadEventBundle(supabase, result.event);
  return NextResponse.json(
    shapeEventResponse(result.event, bundle.attendees, bundle.unitLabel, bundle.developmentLabel),
  );
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  if (!isScheduleEnabled()) {
    return snagFeatureDisabledResponse();
  }

  const eventId = params.id;
  if (!UUID_RE.test(eventId)) {
    return NextResponse.json({ error: 'id must be a uuid' }, { status: 400 });
  }

  let auth: SnagAuthContext;
  try {
    auth = await resolveSnagAuth(request);
  } catch (err) {
    if (err instanceof SnagAuthError) return snagAuthErrorToResponse(err);
    throw err;
  }

  if (auth.role !== 'admin' && auth.role !== 'site_team') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: existingData, error: existingErr } = await supabase
    .from('schedule_events')
    .select('id, tenant_id, starts_at, ends_at, development_id, unit_id')
    .eq('id', eventId)
    .maybeSingle();
  if (existingErr) {
    console.error('[schedule-event-update] lookup_failed reason=%s', existingErr.message);
    return NextResponse.json({ error: 'Could not load event' }, { status: 500 });
  }
  if (!existingData) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }
  if (existingData.tenant_id !== auth.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const update: Record<string, unknown> = {};

  if (payload.event_type !== undefined) {
    if (typeof payload.event_type !== 'string' || !EVENT_TYPES.has(payload.event_type)) {
      return NextResponse.json({ error: 'event_type must be one of the allowed values' }, { status: 400 });
    }
    update.event_type = payload.event_type;
  }
  if (payload.title !== undefined) {
    const t = typeof payload.title === 'string' ? payload.title.trim() : '';
    if (t.length === 0) {
      return NextResponse.json({ error: 'title cannot be empty' }, { status: 400 });
    }
    if (t.length > MAX_TITLE) {
      return NextResponse.json({ error: `title must be at most ${MAX_TITLE} characters` }, { status: 400 });
    }
    update.title = t;
  }
  if (payload.description !== undefined) {
    if (payload.description !== null && typeof payload.description !== 'string') {
      return NextResponse.json({ error: 'description must be a string or null' }, { status: 400 });
    }
    if (typeof payload.description === 'string' && payload.description.length > MAX_DESCRIPTION) {
      return NextResponse.json(
        { error: `description must be at most ${MAX_DESCRIPTION} characters` },
        { status: 400 },
      );
    }
    update.description = payload.description;
  }
  if (payload.location !== undefined) {
    if (payload.location !== null && typeof payload.location !== 'string') {
      return NextResponse.json({ error: 'location must be a string or null' }, { status: 400 });
    }
    if (typeof payload.location === 'string' && payload.location.length > MAX_LOCATION) {
      return NextResponse.json(
        { error: `location must be at most ${MAX_LOCATION} characters` },
        { status: 400 },
      );
    }
    update.location = payload.location;
  }
  if (payload.all_day !== undefined) {
    if (typeof payload.all_day !== 'boolean') {
      return NextResponse.json({ error: 'all_day must be a boolean' }, { status: 400 });
    }
    update.all_day = payload.all_day;
  }

  let nextStartsIso: string | null = null;
  let nextEndsIso: string | null = null;
  let endsCleared = false;
  if (payload.starts_at !== undefined) {
    if (typeof payload.starts_at !== 'string') {
      return NextResponse.json({ error: 'starts_at must be an ISO timestamp' }, { status: 400 });
    }
    const d = new Date(payload.starts_at);
    if (isNaN(d.getTime())) {
      return NextResponse.json({ error: 'starts_at must be a valid ISO timestamp' }, { status: 400 });
    }
    nextStartsIso = d.toISOString();
    update.starts_at = nextStartsIso;
  }
  if (payload.ends_at !== undefined) {
    if (payload.ends_at === null) {
      update.ends_at = null;
      endsCleared = true;
    } else if (typeof payload.ends_at !== 'string') {
      return NextResponse.json({ error: 'ends_at must be an ISO timestamp or null' }, { status: 400 });
    } else {
      const d = new Date(payload.ends_at);
      if (isNaN(d.getTime())) {
        return NextResponse.json({ error: 'ends_at must be a valid ISO timestamp' }, { status: 400 });
      }
      nextEndsIso = d.toISOString();
      update.ends_at = nextEndsIso;
    }
  }
  if (!endsCleared) {
    const effectiveStartsIso = nextStartsIso ?? (existingData.starts_at as string);
    const effectiveEndsIso = nextEndsIso ?? (existingData.ends_at as string | null);
    if (effectiveEndsIso && new Date(effectiveEndsIso).getTime() < new Date(effectiveStartsIso).getTime()) {
      return NextResponse.json({ error: 'ends_at must be on or after starts_at' }, { status: 400 });
    }
  }

  let nextDevelopmentId: string | null | undefined;
  let nextUnitId: string | null | undefined;
  if (payload.development_id !== undefined) {
    if (payload.development_id === null) {
      nextDevelopmentId = null;
    } else if (typeof payload.development_id !== 'string' || !UUID_RE.test(payload.development_id)) {
      return NextResponse.json({ error: 'development_id must be a uuid or null' }, { status: 400 });
    } else {
      nextDevelopmentId = payload.development_id;
    }
    update.development_id = nextDevelopmentId;
  }
  if (payload.unit_id !== undefined) {
    if (payload.unit_id === null) {
      nextUnitId = null;
    } else if (typeof payload.unit_id !== 'string' || !UUID_RE.test(payload.unit_id)) {
      return NextResponse.json({ error: 'unit_id must be a uuid or null' }, { status: 400 });
    } else {
      nextUnitId = payload.unit_id;
    }
    update.unit_id = nextUnitId;
  }

  if (nextDevelopmentId) {
    const { data: dev, error: devErr } = await supabase
      .from('developments')
      .select('id, tenant_id')
      .eq('id', nextDevelopmentId)
      .maybeSingle();
    if (devErr) {
      console.error('[schedule-event-update] dev_lookup_failed reason=%s', devErr.message);
      return NextResponse.json({ error: 'Could not validate development' }, { status: 500 });
    }
    if (!dev || dev.tenant_id !== auth.tenantId) {
      return NextResponse.json(
        { error: 'development_id is not in your tenant' },
        { status: 403 },
      );
    }
  }
  if (nextUnitId) {
    const { data: unit, error: unitErr } = await supabase
      .from('units')
      .select('id, tenant_id, development_id')
      .eq('id', nextUnitId)
      .maybeSingle();
    if (unitErr) {
      console.error('[schedule-event-update] unit_lookup_failed reason=%s', unitErr.message);
      return NextResponse.json({ error: 'Could not validate unit' }, { status: 500 });
    }
    if (!unit || unit.tenant_id !== auth.tenantId) {
      return NextResponse.json({ error: 'unit_id is not in your tenant' }, { status: 403 });
    }
    if (nextDevelopmentId && unit.development_id !== nextDevelopmentId) {
      return NextResponse.json(
        { error: 'unit_id does not belong to the supplied development_id' },
        { status: 400 },
      );
    }
  }

  const attendeesProvided = payload.attendees !== undefined;
  const attendeesParsed = attendeesProvided
    ? parseAttendees(payload.attendees)
    : { value: [] as AttendeeInput[], error: undefined as string | undefined };
  if (attendeesParsed.error) {
    return NextResponse.json({ error: attendeesParsed.error }, { status: 400 });
  }

  update.updated_at = new Date().toISOString();

  const { data: updatedRow, error: updateErr } = await supabase
    .from('schedule_events')
    .update(update)
    .eq('id', eventId)
    .select(
      'id, tenant_id, development_id, unit_id, event_type, title, description, starts_at, ends_at, all_day, location, status, created_by, created_at, updated_at',
    )
    .single();
  if (updateErr || !updatedRow) {
    console.error('[schedule-event-update] update_failed reason=%s', updateErr?.message ?? 'unknown');
    return NextResponse.json({ error: 'Could not update event' }, { status: 500 });
  }

  if (attendeesProvided) {
    const { error: delErr } = await supabase
      .from('schedule_event_attendees')
      .delete()
      .eq('event_id', eventId);
    if (delErr) {
      console.error('[schedule-event-update] attendees_clear_failed reason=%s', delErr.message);
      return NextResponse.json(
        { error: 'Event updated but attendee replacement failed; please retry' },
        { status: 500 },
      );
    }
    if (attendeesParsed.value.length > 0) {
      const rows = attendeesParsed.value.map((a) => ({
        event_id: eventId,
        user_id: a.user_id,
        external_email: a.external_email,
        external_name: a.external_name,
        role: a.role,
      }));
      const { error: insErr } = await supabase.from('schedule_event_attendees').insert(rows);
      if (insErr) {
        console.error('[schedule-event-update] attendees_insert_failed reason=%s', insErr.message);
        return NextResponse.json(
          { error: 'Event updated but new attendees failed; please retry' },
          { status: 500 },
        );
      }
    }
  }

  const bundle = await loadEventBundle(supabase, updatedRow as EventRow);
  return NextResponse.json(
    shapeEventResponse(
      updatedRow as EventRow,
      bundle.attendees,
      bundle.unitLabel,
      bundle.developmentLabel,
    ),
  );
}
