import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { devId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const devId = params.devId;
    const { searchParams } = new URL(request.url);
    const section = searchParams.get('section') || 'pipeline';

    // Verify ownership
    const { data: development } = await supabase
      .from('developments')
      .select('id, name, location, sector')
      .eq('id', devId)
      .eq('developer_id', user.id)
      .single();

    if (!development) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Fetch units
    const { data: units } = await supabase
      .from('units')
      .select('id, unit_number, development_id')
      .eq('development_id', devId)
      .order('unit_number');

    const unitIds = (units || []).map((u) => u.id);
    const unitMap = Object.fromEntries(
      (units || []).map((u) => [u.id, u.unit_number])
    );

    let sectionData: any = {};

    if (section === 'pipeline' && unitIds.length > 0) {
      const { data: pipeline } = await supabase
        .from('sales_pipeline')
        .select('*')
        .in('unit_id', unitIds);

      const { data: homeowners } = await supabase
        .from('homeowner_profiles')
        .select('unit_id, full_name, email, phone')
        .in('unit_id', unitIds);

      const hoMap = Object.fromEntries(
        (homeowners || []).map((h) => [h.unit_id, h])
      );

      const now = Date.now();
      sectionData.pipeline = (pipeline || []).map((p) => {
        const daysAtStage = p.updated_at
          ? Math.floor((now - new Date(p.updated_at).getTime()) / 86400000)
          : 0;
        const ho = hoMap[p.unit_id];
        return {
          unit_id: p.unit_id,
          unit_number: unitMap[p.unit_id] || '',
          purchaser_name: ho?.full_name || 'Unknown',
          phone: ho?.phone,
          email: ho?.email,
          stage: p.stage || 'Unknown',
          days_at_stage: daysAtStage,
          status:
            daysAtStage > 30 ? 'red' : daysAtStage > 14 ? 'amber' : 'green',
          solicitor: p.solicitor,
          agent: p.agent,
          deposit: p.deposit ? parseFloat(p.deposit) : undefined,
          price: p.price ? parseFloat(p.price) : undefined,
        };
      });
    }

    if (section === 'compliance' && unitIds.length > 0) {
      const { data: docs } = await supabase
        .from('compliance_documents')
        .select('unit_id, document_type, status')
        .in('unit_id', unitIds);

      const docTypes = [
        ...new Set((docs || []).map((d) => d.document_type)),
      ].sort();
      const totalDocs = (docs || []).length;
      const completeDocs = (docs || []).filter(
        (d) => d.status === 'complete'
      ).length;

      const byUnit: Record<
        string,
        Array<{ type: string; status: string }>
      > = {};
      (docs || []).forEach((d) => {
        if (!byUnit[d.unit_id]) byUnit[d.unit_id] = [];
        byUnit[d.unit_id].push({ type: d.document_type, status: d.status });
      });

      sectionData.compliance = {
        overall_pct: totalDocs > 0 ? Math.round((completeDocs / totalDocs) * 100) : 0,
        document_types: docTypes,
        units: (units || []).map((u) => ({
          unit_id: u.id,
          unit_number: u.unit_number,
          documents: byUnit[u.id] || [],
        })),
      };
    }

    if (section === 'snagging' && unitIds.length > 0) {
      const { data: snags } = await supabase
        .from('snag_items')
        .select('id, unit_id, description, status, photo_url, created_at')
        .in('unit_id', unitIds)
        .order('created_at', { ascending: false });

      sectionData.snags = (snags || []).map((s) => ({
        ...s,
        unit_number: unitMap[s.unit_id] || '',
      }));
    }

    if (section === 'selections' && unitIds.length > 0) {
      const { data: selections } = await supabase
        .from('kitchen_selections')
        .select('id, unit_id, kitchen_choice, status, deadline')
        .in('unit_id', unitIds);

      sectionData.selections = (selections || []).map((s) => ({
        ...s,
        unit_number: unitMap[s.unit_id] || '',
      }));
    }

    if (section === 'homeowners' && unitIds.length > 0) {
      const { data: homeowners } = await supabase
        .from('homeowner_profiles')
        .select('id, full_name, email, phone, unit_id, created_at')
        .in('unit_id', unitIds);

      sectionData.homeowners = (homeowners || []).map((h) => ({
        ...h,
        unit_number: unitMap[h.unit_id] || '',
      }));
    }

    return NextResponse.json({
      development,
      units: units || [],
      ...sectionData,
    });
  } catch (error) {
    console.error('[dev-app/developments/[devId]] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
