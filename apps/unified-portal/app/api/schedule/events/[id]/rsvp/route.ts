/**
 * POST /api/schedule/events/[id]/rsvp
 *
 * Assistant V2 Sprint 4. Lets an attendee update their own RSVP status
 * on a scheduled event. Any caller with an attendee row on the event
 * may update only their own row.
 *
 * Spec: docs/specs/assistant-v2-sprint-4.md section 5.6.
 *
 * Accepts { rsvp_status: 'confirmed' | 'declined' | 'tentative' }.
 * 'invited' is the initial state and not a valid target value (callers
 * cannot rewind their own RSVP back to invited).
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
const VALID_RSVP = new Set(['confirmed', 'declined', 'tentative']);

interface RouteParams {
  params: { id: string };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
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

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const rsvpStatus = typeof payload.rsvp_status === 'string' ? payload.rsvp_status : '';
  if (!VALID_RSVP.has(rsvpStatus)) {
    return NextResponse.json(
      { error: "rsvp_status must be one of 'confirmed', 'declined', 'tentative'" },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdmin();

  const { data: eventRow, error: eventErr } = await supabase
    .from('schedule_events')
    .select('id, tenant_id')
    .eq('id', eventId)
    .maybeSingle();
  if (eventErr) {
    console.error('[schedule-event-rsvp] event_lookup_failed reason=%s', eventErr.message);
    return NextResponse.json({ error: 'Could not load event' }, { status: 500 });
  }
  if (!eventRow) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }
  if (eventRow.tenant_id !== auth.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: attendeeRow, error: attErr } = await supabase
    .from('schedule_event_attendees')
    .select('id, event_id, user_id, rsvp_status')
    .eq('event_id', eventId)
    .eq('user_id', auth.userId)
    .maybeSingle();
  if (attErr) {
    console.error('[schedule-event-rsvp] attendee_lookup_failed reason=%s', attErr.message);
    return NextResponse.json({ error: 'Could not load attendee record' }, { status: 500 });
  }
  if (!attendeeRow) {
    return NextResponse.json(
      { error: 'You are not an attendee on this event' },
      { status: 403 },
    );
  }

  const { data: updated, error: updateErr } = await supabase
    .from('schedule_event_attendees')
    .update({ rsvp_status: rsvpStatus })
    .eq('id', attendeeRow.id)
    .select('id, event_id, user_id, rsvp_status')
    .single();
  if (updateErr || !updated) {
    console.error('[schedule-event-rsvp] update_failed reason=%s', updateErr?.message ?? 'unknown');
    return NextResponse.json({ error: 'Could not update RSVP' }, { status: 500 });
  }

  return NextResponse.json({
    id: updated.id,
    event_id: updated.event_id,
    user_id: updated.user_id,
    rsvp_status: updated.rsvp_status,
  });
}
