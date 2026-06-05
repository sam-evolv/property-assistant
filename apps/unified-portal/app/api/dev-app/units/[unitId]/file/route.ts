import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, getSupabaseAdmin } from '@/lib/supabase-server';
import { getOwnedUnit, OPEN_SNAG_STATUSES } from '@/lib/dev-app/snags';
import { summariseHpiQa8 } from '@/lib/dev-app/unit-systems';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/dev-app/units/[unitId]/file
 * The "one-click unit file". Assembles, from what we already hold, a structured
 * manifest of the home: details, every snag, the installed systems, the handover
 * evidence trail, and an HPI QA 8.0 readiness summary.
 *
 * Still stubbed: the `documents` section (V1.1 — needs the documents assembly)
 * and PDF/zip rendering. The shape is stable so the client can render today.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { unitId: string } },
) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const owned = await getOwnedUnit(supabase, user.id, params.unitId);
    if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const admin = getSupabaseAdmin();

    const [{ data: unit }, { data: snags }, { data: systems }, { data: handover }] =
      await Promise.all([
        admin
          .from('units')
          .select(
            'id, unit_number, unit_code, address_line_1, city, eircode, house_type_code, development_id, tenant_id',
          )
          .eq('id', owned.id)
          .single(),
        admin
          .from('snag_items')
          .select(
            'id, title, description, status, severity, trade, responsible_contractor_id, created_at, resolved_at',
          )
          .eq('unit_id', owned.id)
          .order('created_at', { ascending: false }),
        admin
          .from('unit_systems')
          .select('*')
          .eq('unit_id', owned.id)
          .order('system_type'),
        admin
          .from('handover_events')
          .select('*')
          .eq('unit_id', owned.id)
          .order('occurred_at', { ascending: false }),
      ]);

    const snagList = snags ?? [];
    const systemList = systems ?? [];
    const handoverList = handover ?? [];
    const openCount = snagList.filter((s: any) =>
      OPEN_SNAG_STATUSES.includes(s.status),
    ).length;

    return NextResponse.json({
      generated_at: new Date().toISOString(),
      unit,
      sections: {
        snags: { total: snagList.length, open: openCount, items: snagList },
        systems: { total: systemList.length, items: systemList },
        handover: { total: handoverList.length, items: handoverList },
        hpi_qa8_evidence: summariseHpiQa8(systemList, handoverList),
        // TODO(V1.1): documents assembly + PDF/zip rendering.
        documents: { status: 'not_yet_assembled' },
      },
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
