import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import {
  PIPELINE_SELECT_COLUMNS,
  derivePipelineStage,
  daysAtStage,
  mapComplianceStatus,
} from '@/lib/dev-app/pipeline-helpers';

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
      .select('id, name, address, project_type')
      .eq('id', devId)
      .eq('developer_user_id', user.id)
      .single();

    if (!development) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Normalise for client (keep API shape stable)
    const devResponse = {
      id: development.id,
      name: development.name,
      location: development.address || '',
      sector: development.project_type || 'bts',
    };

    // Fetch units
    const { data: units } = await supabase
      .from('units')
      .select('id, unit_number, development_id')
      .eq('development_id', devId)
      .order('unit_number');

    const unitIds = (units || []).map((u: any) => u.id);
    const unitMap = Object.fromEntries(
      (units || []).map((u: any) => [u.id, u.unit_number])
    );

    let sectionData: any = {};

    if (section === 'pipeline' && unitIds.length > 0) {
      const { data: pipeline } = await supabase
        .from('unit_sales_pipeline')
        .select(PIPELINE_SELECT_COLUMNS)
        .in('unit_id', unitIds);

      sectionData.pipeline = (pipeline || []).map((p: any) => {
        const derived = derivePipelineStage(p);
        const days = daysAtStage(p);
        return {
          unit_id: p.unit_id,
          unit_number: unitMap[p.unit_id] || '',
          purchaser_name: p.purchaser_name || 'Unknown',
          phone: p.purchaser_phone,
          email: p.purchaser_email,
          stage: derived.stage,
          days_at_stage: days,
          status: days > 30 ? 'red' : days > 14 ? 'amber' : 'green',
        };
      });
    }

    if (section === 'compliance' && unitIds.length > 0) {
      const { data: docs } = await supabase
        .from('compliance_documents')
        .select('unit_id, status, document_type_id, compliance_document_types!inner(name)')
        .in('unit_id', unitIds);

      const docTypes = [
        ...new Set(
          (docs || []).map(
            (d: any) => d.compliance_document_types?.name || 'Unknown'
          )
        ),
      ].sort();
      const totalDocs = (docs || []).length;
      const completeDocs = (docs || []).filter(
        (d: any) => d.status === 'verified'
      ).length;

      const byUnit: Record<
        string,
        Array<{ type: string; status: string }>
      > = {};
      (docs || []).forEach((d: any) => {
        if (!byUnit[d.unit_id]) byUnit[d.unit_id] = [];
        byUnit[d.unit_id].push({
          type: d.compliance_document_types?.name || 'Unknown',
          status: mapComplianceStatus(d.status),
        });
      });

      sectionData.compliance = {
        overall_pct:
          totalDocs > 0
            ? Math.round((completeDocs / totalDocs) * 100)
            : 0,
        document_types: docTypes,
        units: (units || []).map((u: any) => ({
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

      sectionData.snags = (snags || []).map((s: any) => ({
        ...s,
        unit_number: unitMap[s.unit_id] || '',
      }));
    }

    if (section === 'selections' && unitIds.length > 0) {
      const { data: selections } = await supabase
        .from('kitchen_selections')
        .select('id, unit_id, has_kitchen, counter_type, unit_finish, handle_style, has_wardrobe, wardrobe_style, updated_at')
        .in('unit_id', unitIds);

      sectionData.selections = (selections || []).map((s: any) => {
        const choice = s.has_kitchen
          ? [s.counter_type, s.unit_finish, s.handle_style]
              .filter(Boolean)
              .join(' / ') || 'Selected'
          : 'Not selected';
        return {
          id: s.id,
          unit_id: s.unit_id,
          unit_number: unitMap[s.unit_id] || '',
          kitchen_choice: choice,
          status: s.has_kitchen ? 'confirmed' : 'pending',
          deadline: null,
        };
      });
    }

    if (section === 'homeowners' && unitIds.length > 0) {
      // Get purchaser info from pipeline (per-unit)
      const { data: pipelineOwners } = await supabase
        .from('unit_sales_pipeline')
        .select('unit_id, purchaser_name, purchaser_email, purchaser_phone')
        .in('unit_id', unitIds)
        .not('purchaser_name', 'is', null);

      sectionData.homeowners = (pipelineOwners || []).map((h: any) => ({
        id: h.unit_id,
        full_name: h.purchaser_name,
        email: h.purchaser_email,
        phone: h.purchaser_phone,
        unit_id: h.unit_id,
        unit_number: unitMap[h.unit_id] || '',
        created_at: null,
      }));
    }

    return NextResponse.json({
      development: devResponse,
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
