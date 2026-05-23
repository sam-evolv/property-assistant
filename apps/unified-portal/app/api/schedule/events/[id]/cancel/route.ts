/**
 * POST /api/schedule/events/[id]/cancel
 *
 * Assistant V2 Sprint 4. Cancels a scheduled event by setting its
 * status to 'cancelled'. The row is preserved (no delete) so the audit
 * trail of historical schedule changes stays intact and the daily
 * digest can exclude cancelled events without losing them.
 *
 * Spec: docs/specs/assistant-v2-sprint-4.md section 5.5.
 *
 * admin and site_team only. snagger_external is rejected with 403.
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

  if (auth.role !== 'admin' && auth.role !== 'site_team') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();

  const { data: existing, error: lookupErr } = await supabase
    .from('schedule_events')
    .select('id, tenant_id, status')
    .eq('id', eventId)
    .maybeSingle();
  if (lookupErr) {
    console.error('[schedule-event-cancel] lookup_failed reason=%s', lookupErr.message);
    return NextResponse.json({ error: 'Could not load event' }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }
  if (existing.tenant_id !== auth.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (existing.status === 'cancelled') {
    return NextResponse.json({ id: eventId, status: 'cancelled', already_cancelled: true });
  }

  const { data: updated, error: updateErr } = await supabase
    .from('schedule_events')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', eventId)
    .select('id, status, updated_at')
    .single();
  if (updateErr || !updated) {
    console.error('[schedule-event-cancel] update_failed reason=%s', updateErr?.message ?? 'unknown');
    return NextResponse.json({ error: 'Could not cancel event' }, { status: 500 });
  }

  return NextResponse.json({
    id: updated.id,
    status: updated.status,
    updated_at: updated.updated_at,
  });
}
