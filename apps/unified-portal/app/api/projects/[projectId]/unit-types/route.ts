import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    await requireRole(['super_admin']);
    
    const { data: unitTypes, error } = await supabaseAdmin
      .from('unit_types')
      .select('*')
      .eq('project_id', params.projectId)
      .order('name', { ascending: true });

    if (error) {
      console.error('[Unit Types] Error fetching:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ unitTypes });
  } catch (error) {
    console.error('[Unit Types] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch unit types' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    await requireRole(['super_admin']);
    
    const body = await request.json();
    const { name, floor_plan_pdf_url, specification_json } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Unit type name is required' },
        { status: 400 }
      );
    }

    const { data: existingType, error: checkError } = await supabaseAdmin
      .from('unit_types')
      .select('id')
      .eq('project_id', params.projectId)
      .eq('name', name.trim())
      .single();

    if (existingType) {
      return NextResponse.json(
        { error: `Unit type "${name}" already exists for this project` },
        { status: 400 }
      );
    }

    const { data: unitType, error } = await supabaseAdmin
      .from('unit_types')
      .insert({
        project_id: params.projectId,
        name: name.trim(),
        floor_plan_pdf_url: floor_plan_pdf_url || null,
        specification_json: specification_json || null,
      })
      .select()
      .single();

    if (error) {
      console.error('[Unit Types] Error creating:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('[Unit Types] Created:', unitType.name, 'for project:', params.projectId);
    return NextResponse.json({ unitType }, { status: 201 });
  } catch (error) {
    console.error('[Unit Types] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create unit type' },
      { status: 500 }
    );
  }
}
