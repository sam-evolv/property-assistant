export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@openhouse/api/session';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { summariseHpiQa8 } from '@/lib/dev-app/unit-systems';

/**
 * GET /api/homeowners/[id]/unit-file
 *
 * The unit file for the homeowner detail page. In this product a "homeowner" IS
 * a unit, so [id] is units.id. Auth mirrors /api/homeowners/[id]/details:
 * getAdminSession + service-role reads (the portal authorises by admin role).
 *
 * Returns the unit's installed systems, handover events, latest Home User Guide,
 * and the HPI QA 8.0 readiness summary.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    if (!['super_admin', 'developer', 'admin'].includes(session.role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();

    // Confirm the unit exists (select * — prod unit columns vary from the repo base schema).
    const { data: unit, error: unitError } = await supabase
      .from('units')
      .select('*')
      .eq('id', id)
      .single();
    if (unitError || !unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    const [{ data: systems }, { data: handover }, { data: guide }] = await Promise.all([
      supabase.from('unit_systems').select('*').eq('unit_id', id).order('system_type'),
      supabase
        .from('handover_events')
        .select('*')
        .eq('unit_id', id)
        .order('occurred_at', { ascending: false }),
      supabase
        .from('home_user_guides')
        .select('*')
        .eq('unit_id', id)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const systemList = systems ?? [];
    const handoverList = handover ?? [];

    return NextResponse.json({
      systems: systemList,
      handover: handoverList,
      guide: guide ?? null,
      hpi_qa8_evidence: summariseHpiQa8(systemList, handoverList),
    });
  } catch {
    return NextResponse.json({ error: 'Failed to load unit file' }, { status: 500 });
  }
}
