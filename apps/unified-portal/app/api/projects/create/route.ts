import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface ProjectInput {
  name: string;
  address: string;
  image_url: string;
}

interface UnitTypeInput {
  name: string;
  floor_plan_pdf_url: string;
}

interface UnitInput {
  address: string;
  unit_type_name: string;
  purchaser_name: string;
  handover_date: string;
}

export async function POST(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await request.json();
    const { project, unitTypes, units } = body as {
      project: ProjectInput;
      unitTypes: UnitTypeInput[];
      units: UnitInput[];
    };

    if (!project?.name) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
    }

    const { data: projectData, error: projectError } = await supabaseAdmin
      .from('projects')
      .insert({
        name: project.name,
        address: project.address || null,
        image_url: project.image_url || null,
      })
      .select()
      .single();

    if (projectError || !projectData) {
      console.error('[API /projects/create] Project creation error:', projectError);
      return NextResponse.json({ error: projectError?.message || 'Failed to create project' }, { status: 500 });
    }

    const projectId = projectData.id;
    const unitTypeMap: Record<string, string> = {};

    if (unitTypes && unitTypes.length > 0) {
      const unitTypesWithProjectId = unitTypes.map(ut => ({
        project_id: projectId,
        name: ut.name,
        floor_plan_pdf_url: ut.floor_plan_pdf_url || null,
      }));

      const { data: insertedUnitTypes, error: utError } = await supabaseAdmin
        .from('unit_types')
        .insert(unitTypesWithProjectId)
        .select();

      if (utError) {
        console.error('[API /projects/create] Unit types error:', utError);
        await supabaseAdmin.from('projects').delete().eq('id', projectId);
        return NextResponse.json({ error: utError.message || 'Failed to create unit types' }, { status: 500 });
      }

      for (const ut of insertedUnitTypes || []) {
        unitTypeMap[ut.name] = ut.id;
      }
    }

    if (units && units.length > 0) {
      const unitsWithIds = units.map(u => ({
        project_id: projectId,
        unit_type_id: unitTypeMap[u.unit_type_name] || null,
        address: u.address,
        purchaser_name: u.purchaser_name || null,
        handover_date: u.handover_date || null,
      }));

      const { error: unitsError } = await supabaseAdmin
        .from('units')
        .insert(unitsWithIds);

      if (unitsError) {
        console.error('[API /projects/create] Units error:', unitsError);
        await supabaseAdmin.from('unit_types').delete().eq('project_id', projectId);
        await supabaseAdmin.from('projects').delete().eq('id', projectId);
        return NextResponse.json({ error: unitsError.message || 'Failed to create units' }, { status: 500 });
      }
    }

    console.log('[API /projects/create] Successfully created project:', projectId);

    return NextResponse.json({
      projectId,
      unitTypesCreated: Object.keys(unitTypeMap).length,
      unitsCreated: units?.length || 0,
    });
  } catch (err) {
    console.error('[API /projects/create] Error:', err);
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}
