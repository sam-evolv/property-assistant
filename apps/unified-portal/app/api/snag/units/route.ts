/**
 * GET /api/snag/units
 *
 * Assistant V2 Sprint 2. Returns the list of units in a development that
 * the caller is allowed to see, for the snag form's unit picker.
 *
 * Auth via snag-auth.resolveSnagAuth. The caller must have access to the
 * requested development under their site_team_members membership:
 *   - admin / site_team: any development in their tenant
 *   - snagger_external:  must be in their development_ids array
 *
 * Cross-tenant or out-of-scope developments surface as 403. A
 * development that does not exist is 404.
 *
 * Gated on FEATURE_BUILDER_SNAG_APP.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { isBuilderSnagAppEnabled } from '@/lib/feature-flags';
import {
  resolveSnagAuth,
  assertCanAccessDevelopment,
  snagAuthErrorToResponse,
  snagFeatureDisabledResponse,
  SnagAuthError,
} from '@/lib/assistant/snag-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  if (!isBuilderSnagAppEnabled()) {
    return snagFeatureDisabledResponse();
  }

  const url = new URL(request.url);
  const developmentId = url.searchParams.get('development_id') ?? '';
  if (!UUID_RE.test(developmentId)) {
    return NextResponse.json({ error: 'development_id must be a uuid' }, { status: 400 });
  }

  let auth;
  try {
    auth = await resolveSnagAuth(request);
    assertCanAccessDevelopment(auth, developmentId);
  } catch (err) {
    if (err instanceof SnagAuthError) return snagAuthErrorToResponse(err);
    throw err;
  }

  const supabase = getSupabaseAdmin();

  const { data: development, error: devErr } = await supabase
    .from('developments')
    .select('id, tenant_id, name')
    .eq('id', developmentId)
    .maybeSingle();
  if (devErr) {
    console.error('[snag-units] development_lookup_failed reason=%s', devErr.message);
    return NextResponse.json({ error: 'Could not load development' }, { status: 500 });
  }
  if (!development) {
    return NextResponse.json({ error: 'Development not found' }, { status: 404 });
  }
  if (development.tenant_id !== auth.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: units, error: unitsErr } = await supabase
    .from('units')
    .select('id, unit_code, unit_number, address, address_line_1, address_line_2, city, eircode, purchaser_name')
    .eq('development_id', developmentId)
    .eq('tenant_id', auth.tenantId)
    .order('unit_code', { ascending: true });
  if (unitsErr) {
    console.error('[snag-units] units_lookup_failed reason=%s', unitsErr.message);
    return NextResponse.json({ error: 'Could not load units' }, { status: 500 });
  }

  const rows = (units ?? []).map((u) => ({
    id: u.id as string,
    unit_code: (u.unit_code as string | null) ?? null,
    unit_number: (u.unit_number as string | null) ?? null,
    address: (u.address as string | null) ?? null,
    address_line_1: (u.address_line_1 as string | null) ?? null,
    address_line_2: (u.address_line_2 as string | null) ?? null,
    city: (u.city as string | null) ?? null,
    eircode: (u.eircode as string | null) ?? null,
    purchaser_name: (u.purchaser_name as string | null) ?? null,
    display_name:
      (u.unit_code as string | null) ??
      (u.unit_number as string | null) ??
      (u.address as string | null) ??
      (u.address_line_1 as string | null) ??
      'Unit',
  }));

  return NextResponse.json({
    development: { id: development.id, name: development.name },
    units: rows,
  });
}
