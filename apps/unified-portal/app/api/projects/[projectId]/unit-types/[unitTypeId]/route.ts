import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { projectId: string; unitTypeId: string } }
) {
  try {
    await requireRole(['super_admin']);
    const supabaseAdmin = getSupabaseAdmin();
    
    const body = await request.json();
    const { name, floor_plan_pdf_url, specification_json } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Unit type name is required' },
        { status: 400 }
      );
    }

    const { data: existingType } = await supabaseAdmin
      .from('unit_types')
      .select('id')
      .eq('project_id', params.projectId)
      .eq('name', name.trim())
      .neq('id', params.unitTypeId)
      .single();

    if (existingType) {
      return NextResponse.json(
        { error: `Unit type "${name}" already exists for this project` },
        { status: 400 }
      );
    }

    const { data: unitType, error } = await supabaseAdmin
      .from('unit_types')
      .update({
        name: name.trim(),
        floor_plan_pdf_url: floor_plan_pdf_url || null,
        specification_json: specification_json || null,
      })
      .eq('id', params.unitTypeId)
      .eq('project_id', params.projectId)
      .select()
      .single();

    if (error) {
      console.error('[Unit Types] Error updating:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('[Unit Types] Updated:', unitType.name, 'for project:', params.projectId);
    return NextResponse.json({ unitType });
  } catch (error) {
    console.error('[Unit Types] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update unit type' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { projectId: string; unitTypeId: string } }
) {
  try {
    await requireRole(['super_admin']);
    const supabaseAdmin = getSupabaseAdmin();

    const { data: linkedUnits } = await supabaseAdmin
      .from('units')
      .select('id')
      .eq('unit_type_id', params.unitTypeId)
      .limit(1);

    if (linkedUnits && linkedUnits.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete unit type that has units assigned to it' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('unit_types')
      .delete()
      .eq('id', params.unitTypeId)
      .eq('project_id', params.projectId);

    if (error) {
      console.error('[Unit Types] Error deleting:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('[Unit Types] Deleted unit type:', params.unitTypeId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Unit Types] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete unit type' },
      { status: 500 }
    );
  }
}
