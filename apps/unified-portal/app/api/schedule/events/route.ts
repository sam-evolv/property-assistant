/**
 * /api/schedule/events
 *
 * Assistant V2 Sprint 4. Schedule and calendar list + create endpoints.
 *
 * Spec: docs/specs/assistant-v2-sprint-4.md sections 5.1 and 5.3.
 *
 * GET: list events for the caller's tenant in a window, with optional
 * filters. admin and site_team see all tenant events; snagger_external
 * is scoped to events on units in their accessible developments, plus
 * events where they appear as an attendee.
 *
 * POST: create an event. admin and site_team only. snagger_external is
 * rejected with 403. tenant_id and created_by are derived from the
 * verified site_team_members row; the client cannot supply them.
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
const MAX_WINDOW_DAYS = 90;
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

async function loadAttendeesForEvents(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  eventIds: string[],
): Promise<Map<string, AttendeeRow[]>> {
  const out = new Map<string, AttendeeRow[]>();
  if (eventIds.length === 0) return out;
  const { data, error } = await supabase
    .from('schedule_event_attendees')
    .select('id, event_id, user_id, external_email, external_name, role, rsvp_status, created_at')
    .in('event_id', eventIds);
  if (error) {
    console.error('[schedule-events] attendees_lookup_failed reason=%s', error.message);
    return out;
  }
  for (const row of (data ?? []) as AttendeeRow[]) {
    const arr = out.get(row.event_id) ?? [];
    arr.push(row);
    out.set(row.event_id, arr);
  }
  return out;
}

async function loadLabelsForEvents(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  events: EventRow[],
): Promise<{ units: Map<string, string>; developments: Map<string, string> }> {
  const unitIds = Array.from(
    new Set(events.map((e) => e.unit_id).filter((v): v is string => !!v)),
  );
  const devIds = Array.from(
    new Set(events.map((e) => e.development_id).filter((v): v is string => !!v)),
  );

  const units = new Map<string, string>();
  const developments = new Map<string, string>();

  const [unitsRes, devRes] = await Promise.all([
    unitIds.length > 0
      ? supabase
          .from('units')
          .select('id, unit_code, unit_number, address_line_1')
          .in('id', unitIds)
      : Promise.resolve({ data: [], error: null }),
    devIds.length > 0
      ? supabase.from('developments').select('id, name').in('id', devIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (unitsRes.error) {
    console.error('[schedule-events] units_lookup_failed reason=%s', unitsRes.error.message);
  } else {
    for (const u of (unitsRes.data ?? []) as Array<{
      id: string;
      unit_code: string | null;
      unit_number: string | null;
      address_line_1: string | null;
    }>) {
      units.set(u.id, deriveUnitLabel(u));
    }
  }
  if (devRes.error) {
    console.error(
      '[schedule-events] developments_lookup_failed reason=%s',
      devRes.error.message,
    );
  } else {
    for (const d of (devRes.data ?? []) as Array<{ id: string; name: string | null }>) {
      developments.set(d.id, d.name ?? 'Development');
    }
  }
  return { units, developments };
}

function shapeEventResponse(
  event: EventRow,
  attendees: AttendeeRow[] | undefined,
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
    attendees: (attendees ?? []).map((a) => ({
      id: a.id,
      user_id: a.user_id,
      external_email: a.external_email,
      external_name: a.external_name,
      role: a.role,
      rsvp_status: a.rsvp_status,
    })),
  };
}

export async function GET(request: NextRequest) {
  if (!isScheduleEnabled()) {
    return snagFeatureDisabledResponse();
  }

  let auth: SnagAuthContext;
  try {
    auth = await resolveSnagAuth(request);
  } catch (err) {
    if (err instanceof SnagAuthError) return snagAuthErrorToResponse(err);
    throw err;
  }

  const url = new URL(request.url);
  const fromParam = url.searchParams.get('from');
  const toParam = url.searchParams.get('to');

  if (!fromParam || !toParam) {
    return NextResponse.json(
      { error: 'from and to query params are required (ISO timestamps)' },
      { status: 400 },
    );
  }

  const fromDate = new Date(fromParam);
  const toDate = new Date(toParam);
  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return NextResponse.json(
      { error: 'from and to must be valid ISO timestamps' },
      { status: 400 },
    );
  }
  if (toDate.getTime() < fromDate.getTime()) {
    return NextResponse.json({ error: 'to must be on or after from' }, { status: 400 });
  }
  const spanDays = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24);
  if (spanDays > MAX_WINDOW_DAYS) {
    return NextResponse.json(
      { error: `window must be at most ${MAX_WINDOW_DAYS} days` },
      { status: 400 },
    );
  }

  const developmentIdParam = url.searchParams.get('development_id');
  const unitIdParam = url.searchParams.get('unit_id');
  const attendeeUserIdParam = url.searchParams.get('attendee_user_id');
  const eventTypeParams = url.searchParams.getAll('event_type');

  if (developmentIdParam && !UUID_RE.test(developmentIdParam)) {
    return NextResponse.json({ error: 'development_id must be a uuid' }, { status: 400 });
  }
  if (unitIdParam && !UUID_RE.test(unitIdParam)) {
    return NextResponse.json({ error: 'unit_id must be a uuid' }, { status: 400 });
  }
  if (attendeeUserIdParam && !UUID_RE.test(attendeeUserIdParam)) {
    return NextResponse.json({ error: 'attendee_user_id must be a uuid' }, { status: 400 });
  }
  for (const t of eventTypeParams) {
    if (!EVENT_TYPES.has(t)) {
      return NextResponse.json({ error: `event_type '${t}' is not valid` }, { status: 400 });
    }
  }

  const supabase = getSupabaseAdmin();

  let baseQuery = supabase
    .from('schedule_events')
    .select(
      'id, tenant_id, development_id, unit_id, event_type, title, description, starts_at, ends_at, all_day, location, status, created_by, created_at, updated_at',
    )
    .eq('tenant_id', auth.tenantId)
    .gte('starts_at', fromDate.toISOString())
    .lte('starts_at', toDate.toISOString());

  if (developmentIdParam) baseQuery = baseQuery.eq('development_id', developmentIdParam);
  if (unitIdParam) baseQuery = baseQuery.eq('unit_id', unitIdParam);
  if (eventTypeParams.length > 0) baseQuery = baseQuery.in('event_type', eventTypeParams);

  let events: EventRow[] = [];

  if (auth.role === 'snagger_external') {
    const allowed = Array.isArray(auth.developmentIds) ? auth.developmentIds : [];

    const { data: attendeeEventIdRows, error: attErr } = await supabase
      .from('schedule_event_attendees')
      .select('event_id')
      .eq('user_id', auth.userId);
    if (attErr) {
      console.error('[schedule-events] external_attendee_lookup_failed reason=%s', attErr.message);
      return NextResponse.json({ error: 'Could not load events' }, { status: 500 });
    }
    const attendeeEventIds = Array.from(
      new Set((attendeeEventIdRows ?? []).map((r) => r.event_id as string)),
    );

    if (allowed.length === 0 && attendeeEventIds.length === 0) {
      return NextResponse.json({ events: [] });
    }

    let scoped = baseQuery;
    const clauses: string[] = [];
    if (allowed.length > 0) {
      clauses.push(`development_id.in.(${allowed.join(',')})`);
    }
    if (attendeeEventIds.length > 0) {
      clauses.push(`id.in.(${attendeeEventIds.join(',')})`);
    }
    scoped = scoped.or(clauses.join(','));

    const { data, error } = await scoped.order('starts_at', { ascending: true });
    if (error) {
      console.error('[schedule-events] external_list_failed reason=%s', error.message);
      return NextResponse.json({ error: 'Could not load events' }, { status: 500 });
    }
    events = (data ?? []) as EventRow[];
  } else {
    let q = baseQuery;
    if (attendeeUserIdParam) {
      const { data: attRows, error: attErr } = await supabase
        .from('schedule_event_attendees')
        .select('event_id')
        .eq('user_id', attendeeUserIdParam);
      if (attErr) {
        console.error('[schedule-events] attendee_filter_failed reason=%s', attErr.message);
        return NextResponse.json({ error: 'Could not load events' }, { status: 500 });
      }
      const ids = Array.from(new Set((attRows ?? []).map((r) => r.event_id as string)));
      if (ids.length === 0) {
        return NextResponse.json({ events: [] });
      }
      q = q.in('id', ids);
    }

    const { data, error } = await q.order('starts_at', { ascending: true });
    if (error) {
      console.error('[schedule-events] list_failed reason=%s', error.message);
      return NextResponse.json({ error: 'Could not load events' }, { status: 500 });
    }
    events = (data ?? []) as EventRow[];
  }

  const eventIds = events.map((e) => e.id);
  const [attendeesByEvent, labels] = await Promise.all([
    loadAttendeesForEvents(supabase, eventIds),
    loadLabelsForEvents(supabase, events),
  ]);

  return NextResponse.json({
    events: events.map((e) =>
      shapeEventResponse(
        e,
        attendeesByEvent.get(e.id),
        e.unit_id ? labels.units.get(e.unit_id) ?? null : null,
        e.development_id ? labels.developments.get(e.development_id) ?? null : null,
      ),
    ),
  });
}

export async function POST(request: NextRequest) {
  if (!isScheduleEnabled()) {
    return snagFeatureDisabledResponse();
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

  const eventType = typeof payload.event_type === 'string' ? payload.event_type : '';
  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  const description = typeof payload.description === 'string' ? payload.description : null;
  const startsAt = typeof payload.starts_at === 'string' ? payload.starts_at : '';
  const endsAt = typeof payload.ends_at === 'string' ? payload.ends_at : null;
  const allDay = payload.all_day === true;
  const location = typeof payload.location === 'string' ? payload.location : null;
  const developmentId =
    typeof payload.development_id === 'string' ? payload.development_id : null;
  const unitId = typeof payload.unit_id === 'string' ? payload.unit_id : null;

  if (!EVENT_TYPES.has(eventType)) {
    return NextResponse.json({ error: 'event_type is required and must be valid' }, { status: 400 });
  }
  if (title.length === 0) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }
  if (title.length > MAX_TITLE) {
    return NextResponse.json(
      { error: `title must be at most ${MAX_TITLE} characters` },
      { status: 400 },
    );
  }
  if (description !== null && description.length > MAX_DESCRIPTION) {
    return NextResponse.json(
      { error: `description must be at most ${MAX_DESCRIPTION} characters` },
      { status: 400 },
    );
  }
  if (location !== null && location.length > MAX_LOCATION) {
    return NextResponse.json(
      { error: `location must be at most ${MAX_LOCATION} characters` },
      { status: 400 },
    );
  }
  const startsDate = new Date(startsAt);
  if (isNaN(startsDate.getTime())) {
    return NextResponse.json({ error: 'starts_at must be a valid ISO timestamp' }, { status: 400 });
  }
  let endsDate: Date | null = null;
  if (endsAt) {
    endsDate = new Date(endsAt);
    if (isNaN(endsDate.getTime())) {
      return NextResponse.json({ error: 'ends_at must be a valid ISO timestamp' }, { status: 400 });
    }
    if (endsDate.getTime() < startsDate.getTime()) {
      return NextResponse.json({ error: 'ends_at must be on or after starts_at' }, { status: 400 });
    }
  }

  if (developmentId && !UUID_RE.test(developmentId)) {
    return NextResponse.json({ error: 'development_id must be a uuid' }, { status: 400 });
  }
  if (unitId && !UUID_RE.test(unitId)) {
    return NextResponse.json({ error: 'unit_id must be a uuid' }, { status: 400 });
  }

  const attendeesParsed = parseAttendees(payload.attendees);
  if (attendeesParsed.error) {
    return NextResponse.json({ error: attendeesParsed.error }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  if (developmentId) {
    const { data: dev, error: devErr } = await supabase
      .from('developments')
      .select('id, tenant_id')
      .eq('id', developmentId)
      .maybeSingle();
    if (devErr) {
      console.error('[schedule-create] dev_lookup_failed reason=%s', devErr.message);
      return NextResponse.json({ error: 'Could not validate development' }, { status: 500 });
    }
    if (!dev || dev.tenant_id !== auth.tenantId) {
      return NextResponse.json(
        { error: 'development_id is not in your tenant' },
        { status: 403 },
      );
    }
  }
  if (unitId) {
    const { data: unit, error: unitErr } = await supabase
      .from('units')
      .select('id, tenant_id, development_id')
      .eq('id', unitId)
      .maybeSingle();
    if (unitErr) {
      console.error('[schedule-create] unit_lookup_failed reason=%s', unitErr.message);
      return NextResponse.json({ error: 'Could not validate unit' }, { status: 500 });
    }
    if (!unit || unit.tenant_id !== auth.tenantId) {
      return NextResponse.json({ error: 'unit_id is not in your tenant' }, { status: 403 });
    }
    if (developmentId && unit.development_id !== developmentId) {
      return NextResponse.json(
        { error: 'unit_id does not belong to the supplied development_id' },
        { status: 400 },
      );
    }
  }

  const insertPayload = {
    tenant_id: auth.tenantId,
    development_id: developmentId,
    unit_id: unitId,
    event_type: eventType,
    title,
    description,
    starts_at: startsDate.toISOString(),
    ends_at: endsDate ? endsDate.toISOString() : null,
    all_day: allDay,
    location,
    status: 'scheduled',
    created_by: auth.userId,
  };

  const { data: inserted, error: insertErr } = await supabase
    .from('schedule_events')
    .insert(insertPayload)
    .select(
      'id, tenant_id, development_id, unit_id, event_type, title, description, starts_at, ends_at, all_day, location, status, created_by, created_at, updated_at',
    )
    .single();

  if (insertErr || !inserted) {
    console.error('[schedule-create] insert_failed reason=%s', insertErr?.message ?? 'unknown');
    return NextResponse.json({ error: 'Could not create event' }, { status: 500 });
  }

  let attendees: AttendeeRow[] = [];
  if (attendeesParsed.value.length > 0) {
    const rows = attendeesParsed.value.map((a) => ({
      event_id: inserted.id,
      user_id: a.user_id,
      external_email: a.external_email,
      external_name: a.external_name,
      role: a.role,
    }));
    const { data: attRows, error: attErr } = await supabase
      .from('schedule_event_attendees')
      .insert(rows)
      .select('id, event_id, user_id, external_email, external_name, role, rsvp_status, created_at');
    if (attErr) {
      console.error('[schedule-create] attendees_insert_failed reason=%s', attErr.message);
      return NextResponse.json(
        { error: 'Event created but attendees failed; please retry' },
        { status: 500 },
      );
    }
    attendees = (attRows ?? []) as AttendeeRow[];
  }

  return NextResponse.json(
    shapeEventResponse(inserted as EventRow, attendees, null, null),
    { status: 201 },
  );
}
