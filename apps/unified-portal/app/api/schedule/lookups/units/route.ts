/**
 * GET /api/schedule/lookups/units?development_id=...
 *
 * Assistant V2 Sprint 4. Returns the units in a given development for
 * use in the Add/Edit event modal's unit picker. admin and site_team
 * only; matches the rest of the schedule write surface.
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

function deriveUnitLabel(u: {
  unit_code: string | null;
  unit_number: string | null;
  address_line_1: string | null;
}): string {
  return u.unit_code ?? u.unit_number ?? u.address_line_1 ?? 'Unit';
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

  if (auth.role !== 'admin' && auth.role !== 'site_team') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const developmentId = url.searchParams.get('development_id') ?? '';
  if (!UUID_RE.test(developmentId)) {
    return NextResponse.json({ error: 'development_id must be a uuid' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: dev, error: devErr } = await supabase
    .from('developments')
    .select('id, tenant_id')
    .eq('id', developmentId)
    .maybeSingle();
  if (devErr) {
    console.error('[schedule-lookups-units] dev_lookup_failed reason=%s', devErr.message);
    return NextResponse.json({ error: 'Could not validate development' }, { status: 500 });
  }
  if (!dev || dev.tenant_id !== auth.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: unitRows, error: unitErr } = await supabase
    .from('units')
    .select('id, unit_code, unit_number, address_line_1')
    .eq('development_id', developmentId)
    .order('unit_code', { ascending: true });
  if (unitErr) {
    console.error('[schedule-lookups-units] units_failed reason=%s', unitErr.message);
    return NextResponse.json({ error: 'Could not load units' }, { status: 500 });
  }

  const units = (unitRows ?? []).map((u) => ({
    id: u.id as string,
    label: deriveUnitLabel({
      unit_code: (u.unit_code as string | null) ?? null,
      unit_number: (u.unit_number as string | null) ?? null,
      address_line_1: (u.address_line_1 as string | null) ?? null,
    }),
  }));

  return NextResponse.json({ units });
}
