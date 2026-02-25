import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: developments } = await supabase
      .from('developments')
      .select('id, name')
      .eq('developer_id', user.id);

    const devs = developments || [];
    const devIds = devs.map((d) => d.id);
    const devNameMap = Object.fromEntries(devs.map((d) => [d.id, d.name]));

    if (devIds.length === 0) {
      return NextResponse.json({ items: [] });
    }

    // Get all units for these developments
    const { data: units } = await supabase
      .from('units')
      .select('id, development_id, unit_number')
      .in('development_id', devIds);

    const unitIds = (units || []).map((u) => u.id);
    const unitDevMap = Object.fromEntries(
      (units || []).map((u) => [u.id, u.development_id])
    );

    const items: any[] = [];

    if (unitIds.length > 0) {
      // 1. Pipeline items stuck for >30 days
      const { data: stuckPipeline } = await supabase
        .from('sales_pipeline')
        .select('unit_id, stage, updated_at')
        .in('unit_id', unitIds);

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const stuckUnits = (stuckPipeline || []).filter(
        (p) => p.updated_at && new Date(p.updated_at) < thirtyDaysAgo
      );

      if (stuckUnits.length > 0) {
        // Group by development
        const byDev: Record<string, number> = {};
        stuckUnits.forEach((u) => {
          const devId = unitDevMap[u.unit_id];
          if (devId) byDev[devId] = (byDev[devId] || 0) + 1;
        });

        Object.entries(byDev).forEach(([devId, count]) => {
          items.push({
            id: `stuck-${devId}`,
            type: 'stuck_pipeline',
            severity: 'red',
            title: `${count} unit${count > 1 ? 's' : ''} stuck in pipeline for over 30 days`,
            development_name: devNameMap[devId],
            development_id: devId,
          });
        });
      }

      // 2. Compliance documents overdue
      const { data: overdueDocs } = await supabase
        .from('compliance_documents')
        .select('unit_id, document_type, status')
        .in('unit_id', unitIds)
        .eq('status', 'overdue');

      if (overdueDocs && overdueDocs.length > 0) {
        const byDev: Record<string, number> = {};
        overdueDocs.forEach((d) => {
          const devId = unitDevMap[d.unit_id];
          if (devId) byDev[devId] = (byDev[devId] || 0) + 1;
        });

        Object.entries(byDev).forEach(([devId, count]) => {
          items.push({
            id: `compliance-${devId}`,
            type: 'compliance_overdue',
            severity: 'amber',
            title: `${count} compliance document${count > 1 ? 's' : ''} overdue`,
            development_name: devNameMap[devId],
            development_id: devId,
          });
        });
      }

      // 3. Open snag items
      const { data: openSnags } = await supabase
        .from('snag_items')
        .select('unit_id, status')
        .in('unit_id', unitIds)
        .in('status', ['open', 'in_progress']);

      if (openSnags && openSnags.length > 0) {
        const byDev: Record<string, number> = {};
        openSnags.forEach((s) => {
          const devId = unitDevMap[s.unit_id];
          if (devId) byDev[devId] = (byDev[devId] || 0) + 1;
        });

        Object.entries(byDev).forEach(([devId, count]) => {
          if (count >= 5) {
            items.push({
              id: `snags-${devId}`,
              type: 'open_snags',
              severity: 'amber',
              title: `${count} open snag items need resolution`,
              development_name: devNameMap[devId],
              development_id: devId,
            });
          }
        });
      }
    }

    // Sort by severity (red first)
    const severityOrder = { red: 0, amber: 1, gold: 2, blue: 3 };
    items.sort(
      (a, b) =>
        (severityOrder[a.severity as keyof typeof severityOrder] ?? 4) -
        (severityOrder[b.severity as keyof typeof severityOrder] ?? 4)
    );

    return NextResponse.json({ items });
  } catch (error) {
    console.error('[dev-app/overview/attention] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
