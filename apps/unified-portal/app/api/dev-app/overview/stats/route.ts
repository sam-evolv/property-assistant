import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import {
  PIPELINE_SELECT_COLUMNS,
  isSold,
  isHandedOver,
  mapComplianceStatus,
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
      .select('id')
      .eq('developer_user_id', user.id)
      .not('name', 'ilike', '%test%')
      .not('name', 'ilike', 'NULL%')
      .not('name', 'ilike', '%demo%')
      .not('name', 'ilike', '%sample%');

    const devIds = (developments || []).map((d: any) => d.id);

    if (devIds.length === 0) {
      return NextResponse.json({
        pipeline_value: 0,
        units_sold: 0,
        compliance_pct: 0,
        handover_ready: 0,
      });
    }

    // Get all units
    const { data: allUnits } = await supabase
      .from('units')
      .select('id')
      .in('development_id', devIds);

    const unitIds = (allUnits || []).map((u: any) => u.id);

    if (unitIds.length === 0) {
      return NextResponse.json({
        pipeline_value: 0,
        units_sold: 0,
        compliance_pct: 0,
        handover_ready: 0,
      });
    }

    // Pipeline data
    const { data: pipelineData } = await supabase
      .from('unit_sales_pipeline')
      .select(PIPELINE_SELECT_COLUMNS)
      .in('unit_id', unitIds);

    const pipeline = pipelineData || [];
    const unitsSold = pipeline.filter((p: any) => isSold(p)).length;
    // Pipeline value: not tracked in unit_sales_pipeline; use count-based metric
    const pipelineValue = unitsSold * 350000; // placeholder estimate

    // Compliance percentage
    const { data: complianceDocs } = await supabase
      .from('compliance_documents')
      .select('status, unit_id')
      .in('unit_id', unitIds);

    const docs = complianceDocs || [];
    const totalDocs = docs.length;
    const completeDocs = docs.filter(
      (d: any) => d.status === 'verified'
    ).length;
    const compliancePct =
      totalDocs > 0 ? Math.round((completeDocs / totalDocs) * 100) : 0;

    // Handover ready: units that are handed over
    const handoverReady = pipeline.filter((p: any) =>
      isHandedOver(p)
    ).length;

    // Include user's first name for greeting
    const firstName = user.user_metadata?.full_name?.split(' ')[0]
      || user.user_metadata?.first_name
      || user.email?.split('@')[0]
      || 'there';
    const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();

    return NextResponse.json({
      pipeline_value: pipelineValue,
      units_sold: unitsSold,
      total_units: unitIds.length,
      compliance_pct: compliancePct,
      handover_ready: handoverReady,
      display_name: displayName,
    });
  } catch (error) {
    console.error('[dev-app/overview/stats] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
