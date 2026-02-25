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

    // Fetch developer's developments
    const { data: developments } = await supabase
      .from('developments')
      .select('id, name, location, sector, created_at')
      .eq('developer_id', user.id)
      .order('name');

    if (!developments || developments.length === 0) {
      return NextResponse.json({ developments: [] });
    }

    // Fetch unit counts per development
    const devIds = developments.map((d) => d.id);
    const { data: units } = await supabase
      .from('units')
      .select('id, development_id')
      .in('development_id', devIds);

    const { data: pipelineData } = await supabase
      .from('sales_pipeline')
      .select('unit_id, stage, price')
      .in(
        'unit_id',
        (units || []).map((u) => u.id)
      );

    // Build unit-to-development map
    const unitDevMap: Record<string, string> = {};
    (units || []).forEach((u) => {
      unitDevMap[u.id] = u.development_id;
    });

    // Aggregate per development
    const devUnitCounts: Record<string, number> = {};
    const devSoldCounts: Record<string, number> = {};
    const devRecentActivity: Record<string, number> = {};

    (units || []).forEach((u) => {
      devUnitCounts[u.development_id] = (devUnitCounts[u.development_id] || 0) + 1;
    });

    const soldStages = [
      'contracts_signed',
      'loan_approved',
      'snagging',
      'handover',
      'complete',
    ];

    (pipelineData || []).forEach((p) => {
      const devId = unitDevMap[p.unit_id];
      if (!devId) return;
      const normalizedStage = (p.stage || '').toLowerCase().replace(/\s+/g, '_');
      if (soldStages.includes(normalizedStage)) {
        devSoldCounts[devId] = (devSoldCounts[devId] || 0) + 1;
      }
    });

    // Determine most active development
    let mostActiveId = devIds[0];
    let maxActivity = 0;
    Object.entries(devSoldCounts).forEach(([devId, count]) => {
      if (count > maxActivity) {
        maxActivity = count;
        mostActiveId = devId;
      }
    });

    const result = developments.map((dev) => {
      const total = devUnitCounts[dev.id] || 0;
      const sold = devSoldCounts[dev.id] || 0;
      const progress = total > 0 ? Math.round((sold / total) * 100) : 0;

      return {
        id: dev.id,
        name: dev.name,
        location: dev.location || '',
        sector: dev.sector || 'bts',
        total_units: total,
        sold_units: sold,
        progress,
        is_most_active: dev.id === mostActiveId,
      };
    });

    return NextResponse.json({ developments: result });
  } catch (error) {
    console.error('[dev-app/developments] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
