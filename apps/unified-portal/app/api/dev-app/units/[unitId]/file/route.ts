import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, getSupabaseAdmin } from '@/lib/supabase-server';
import { getOwnedUnit, OPEN_SNAG_STATUSES } from '@/lib/dev-app/snags';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/dev-app/units/[unitId]/file
 * The "one-click unit file". V1.0 returns a structured manifest assembled from
 * what we already hold (unit details + every snag). The shape is stable so the
 * client can render it today; V1.1 fills the stubbed sections with documents,
 * unit_systems, warranties, handover_events and the HPI QA 8.0 evidence, and
 * adds PDF/zip rendering.
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

    const { data: unit } = await admin
      .from('units')
      .select(
        'id, unit_number, unit_code, address_line_1, city, eircode, house_type_code, development_id, tenant_id',
      )
      .eq('id', owned.id)
      .single();

    const { data: snags } = await admin
      .from('snag_items')
      .select(
        'id, title, description, status, severity, trade, responsible_contractor_id, created_at, resolved_at',
      )
      .eq('unit_id', owned.id)
      .order('created_at', { ascending: false });

    const snagList = snags ?? [];
    const openCount = snagList.filter((s: any) =>
      OPEN_SNAG_STATUSES.includes(s.status),
    ).length;

    return NextResponse.json({
      generated_at: new Date().toISOString(),
      unit,
      sections: {
        snags: {
          total: snagList.length,
          open: openCount,
          items: snagList,
        },
        // TODO(V1.1): assemble from documents, unit_systems, handover_events.
        documents: { status: 'not_yet_assembled' },
        systems: { status: 'not_yet_assembled' },
        hpi_qa8_evidence: { status: 'not_yet_assembled' },
      },
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
