import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import {
  PIPELINE_SELECT_COLUMNS,
  derivePipelineStage,
  isSold,
} from '@/lib/dev-app/pipeline-helpers';

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

    // Fetch developer's developments (filter test/junk data)
    const { data: developments } = await supabase
      .from('developments')
      .select('id, name, address, project_type, created_at')
      .eq('developer_user_id', user.id)
      .not('name', 'ilike', '%test%')
      .not('name', 'ilike', 'NULL%')
      .not('name', 'ilike', '%demo%')
      .not('name', 'ilike', '%sample%')
      .order('name');

    if (!developments || developments.length === 0) {
      return NextResponse.json({ developments: [] });
    }

    // Fetch unit counts per development
    const devIds = developments.map((d: any) => d.id);
    const { data: units } = await supabase
      .from('units')
      .select('id, development_id')
      .in('development_id', devIds);

    const unitIds = (units || []).map((u: any) => u.id);

    // Fetch pipeline data
    let pipelineData: any[] = [];
    if (unitIds.length > 0) {
      const { data } = await supabase
        .from('unit_sales_pipeline')
        .select(PIPELINE_SELECT_COLUMNS)
        .in('unit_id', unitIds);
      pipelineData = data || [];
    }

    // Build unit-to-development map
    const unitDevMap: Record<string, string> = {};
    (units || []).forEach((u: any) => {
      unitDevMap[u.id] = u.development_id;
    });

    // Aggregate per development
    const devUnitCounts: Record<string, number> = {};
    const devSoldCounts: Record<string, number> = {};

    (units || []).forEach((u: any) => {
      devUnitCounts[u.development_id] =
        (devUnitCounts[u.development_id] || 0) + 1;
    });

    pipelineData.forEach((p: any) => {
      const devId = unitDevMap[p.unit_id];
      if (!devId) return;
      if (isSold(p)) {
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

    const result = developments.map((dev: any) => {
      const total = devUnitCounts[dev.id] || 0;
      const sold = devSoldCounts[dev.id] || 0;
      const progress = total > 0 ? Math.round((sold / total) * 100) : 0;

      return {
        id: dev.id,
        name: dev.name,
        location: dev.address || '',
        sector: dev.project_type || 'bts',
        total_units: total,
        sold_units: sold,
        progress,
        is_most_active: dev.id === mostActiveId,
        created_at: dev.created_at,
      };
    });

    // Filter out developments with 0 units (unless created within last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const filtered = result.filter((d: any) =>
      d.total_units > 0 || (d.created_at && new Date(d.created_at) > sevenDaysAgo)
    );

    return NextResponse.json({ developments: filtered });
  } catch (error) {
    console.error('[dev-app/developments] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
