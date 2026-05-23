/**
 * GET /api/schedule/lookups
 *
 * Assistant V2 Sprint 4. Returns the tenant's developments and active
 * site_team_members for use in the Add/Edit event modal's pickers.
 * admin and site_team only; snagger_external cannot create or edit
 * events so they have no reason to fetch this data.
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

  if (auth.role !== 'admin' && auth.role !== 'site_team') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();

  const [devRes, memberRes] = await Promise.all([
    supabase
      .from('developments')
      .select('id, name')
      .eq('tenant_id', auth.tenantId)
      .order('name', { ascending: true }),
    supabase
      .from('site_team_members')
      .select('user_id, role, invited_email')
      .eq('tenant_id', auth.tenantId)
      .eq('active', true)
      .order('invited_at', { ascending: true }),
  ]);

  if (devRes.error) {
    console.error('[schedule-lookups] dev_lookup_failed reason=%s', devRes.error.message);
    return NextResponse.json({ error: 'Could not load developments' }, { status: 500 });
  }
  if (memberRes.error) {
    console.error('[schedule-lookups] member_lookup_failed reason=%s', memberRes.error.message);
    return NextResponse.json({ error: 'Could not load team members' }, { status: 500 });
  }

  const developments = (devRes.data ?? []).map((d) => ({
    id: d.id as string,
    name: (d.name as string | null) ?? 'Development',
  }));

  const members = (memberRes.data ?? [])
    .filter((m) => !!m.user_id)
    .map((m) => ({
      user_id: m.user_id as string,
      role: (m.role as string | null) ?? null,
      email: (m.invited_email as string | null) ?? null,
    }));

  return NextResponse.json({ developments, members });
}
