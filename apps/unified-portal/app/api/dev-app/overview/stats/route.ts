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
      .select('id')
      .eq('developer_id', user.id);

    const devIds = (developments || []).map((d) => d.id);

    if (devIds.length === 0) {
      return NextResponse.json({
        pipeline_value: 0,
        units_sold: 0,
        compliance_pct: 0,
        handover_ready: 0,
      });
    }

    // Pipeline value & units sold
    const { data: pipelineData } = await supabase
      .from('sales_pipeline')
      .select('price, stage, unit_id')
      .in(
        'unit_id',
        (
          await supabase
            .from('units')
            .select('id')
            .in('development_id', devIds)
        ).data?.map((u) => u.id) || []
      );

    const pipeline = pipelineData || [];
    const pipelineValue = pipeline.reduce(
      (sum, p) => sum + (parseFloat(p.price) || 0),
      0
    );
    const unitsSold = pipeline.filter((p) =>
      ['contracts_signed', 'loan_approved', 'snagging', 'handover', 'complete'].includes(
        (p.stage || '').toLowerCase().replace(/\s+/g, '_')
      )
    ).length;

    // Compliance percentage
    const { data: complianceDocs } = await supabase
      .from('compliance_documents')
      .select('status, unit_id')
      .in(
        'unit_id',
        (
          await supabase
            .from('units')
            .select('id')
            .in('development_id', devIds)
        ).data?.map((u) => u.id) || []
      );

    const docs = complianceDocs || [];
    const totalDocs = docs.length;
    const completeDocs = docs.filter((d) => d.status === 'complete').length;
    const compliancePct = totalDocs > 0 ? Math.round((completeDocs / totalDocs) * 100) : 0;

    // Handover ready (units with all compliance complete and no open snags)
    const { data: snagItems } = await supabase
      .from('snag_items')
      .select('unit_id, status')
      .in(
        'unit_id',
        (
          await supabase
            .from('units')
            .select('id')
            .in('development_id', devIds)
        ).data?.map((u) => u.id) || []
      )
      .neq('status', 'resolved');

    const unitsWithOpenSnags = new Set((snagItems || []).map((s) => s.unit_id));
    const unitsWithIncompleteDocs = new Set(
      docs.filter((d) => d.status !== 'complete').map((d) => d.unit_id)
    );

    const { data: allUnits } = await supabase
      .from('units')
      .select('id')
      .in('development_id', devIds);

    const handoverReady = (allUnits || []).filter(
      (u) => !unitsWithOpenSnags.has(u.id) && !unitsWithIncompleteDocs.has(u.id)
    ).length;

    return NextResponse.json({
      pipeline_value: pipelineValue,
      units_sold: unitsSold,
      compliance_pct: compliancePct,
      handover_ready: handoverReady,
    });
  } catch (error) {
    console.error('[dev-app/overview/stats] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
