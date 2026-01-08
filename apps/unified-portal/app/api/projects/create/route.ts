import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
      db: { schema: 'public' }
    }
  );
}

interface ProjectInput {
  name: string;
  address: string;
  image_url: string;
}

interface UnitTypeInput {
  name: string;
  floor_plan_pdf_url?: string;
  designation?: string;
  bedrooms?: number;
  bathrooms?: number;
  sqm?: number;
}

interface UnitInput {
  address: string;
  unit_type_name: string;
  purchaser_name: string;
  handover_date: string;
}

function normalizeTypeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

async function materialiseUnitTypes(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  projectId: string,
  unitTypes: UnitTypeInput[],
  units: UnitInput[]
): Promise<{ unitTypeMap: Map<string, string>; created: number; enriched: number }> {
  const distinctTypesFromUnits = new Map<string, string>();
  for (const unit of units) {
    if (unit.unit_type_name) {
      const normalized = normalizeTypeName(unit.unit_type_name);
      if (!distinctTypesFromUnits.has(normalized)) {
        distinctTypesFromUnits.set(normalized, unit.unit_type_name);
      }
    }
  }
  
  const enrichmentMap = new Map<string, UnitTypeInput>();
  for (const ut of unitTypes) {
    enrichmentMap.set(normalizeTypeName(ut.name), ut);
  }
  
  const allTypeNames = new Set<string>([
    ...Array.from(distinctTypesFromUnits.keys()),
    ...Array.from(enrichmentMap.keys()),
  ]);
  
  const unitTypeMap = new Map<string, string>();
  let created = 0;
  let enriched = 0;
  
  for (const normalized of Array.from(allTypeNames)) {
    const originalName = distinctTypesFromUnits.get(normalized) || enrichmentMap.get(normalized)?.name;
    if (!originalName) continue;
    
    const enrichment = enrichmentMap.get(normalized);
    
    const { data: existingTypes } = await supabase
      .from('unit_types')
      .select('id, name')
      .eq('project_id', projectId);
    
    let existing: { id: string; name: string } | null = null;
    for (const ut of existingTypes || []) {
      if (normalizeTypeName(ut.name) === normalized) {
        existing = ut;
        break;
      }
    }
    
    if (existing) {
      unitTypeMap.set(normalized, existing.id);
      
      if (enrichment && (enrichment.floor_plan_pdf_url || enrichment.designation)) {
        await supabase
          .from('unit_types')
          .update({
            floor_plan_pdf_url: enrichment.floor_plan_pdf_url || null,
          })
          .eq('id', existing.id);
        enriched++;
      }
    } else {
      const insertData: Record<string, any> = {
        project_id: projectId,
        name: originalName,
        floor_plan_pdf_url: enrichment?.floor_plan_pdf_url || null,
      };
      
      const { data: inserted, error: insertError } = await supabase
        .from('unit_types')
        .insert(insertData)
        .select()
        .single();
      
      if (insertError) {
        if (insertError.code === '23505') {
          const { data: refetchTypes } = await supabase
            .from('unit_types')
            .select('id, name')
            .eq('project_id', projectId);
          
          for (const ut of refetchTypes || []) {
            if (normalizeTypeName(ut.name) === normalized) {
              unitTypeMap.set(normalized, ut.id);
              break;
            }
          }
        } else {
          console.error(`[materialiseUnitTypes] Failed to create unit type "${originalName}":`, insertError);
          throw new Error(`Failed to create unit type "${originalName}": ${insertError.message}`);
        }
      } else if (inserted) {
        unitTypeMap.set(normalized, inserted.id);
        created++;
      }
    }
  }
  
  return { unitTypeMap, created, enriched };
}

export async function POST(request: Request) {
  const supabaseAdmin = getSupabaseAdmin();
  let projectId: string | null = null;
  
  try {
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

    projectId = projectData.id;
    
    const { unitTypeMap, created: unitTypesCreated, enriched: unitTypesEnriched } = await materialiseUnitTypes(
      supabaseAdmin,
      projectId!,
      unitTypes || [],
      units || []
    );
    
    console.log(`[API /projects/create] Materialised ${unitTypesCreated} unit types (${unitTypesEnriched} enriched) for project ${projectId}`);

    let unitsCreated = 0;
    let unitsWithMissingType = 0;
    
    if (units && units.length > 0) {
      const unitsWithIds = units.map(u => {
        const normalized = normalizeTypeName(u.unit_type_name);
        const unitTypeId = unitTypeMap.get(normalized);
        
        if (!unitTypeId) {
          unitsWithMissingType++;
          console.warn(`[API /projects/create] Unit "${u.address}" has unmapped type "${u.unit_type_name}"`);
        }
        
        return {
          project_id: projectId,
          unit_type_id: unitTypeId || null,
          address: u.address,
          purchaser_name: u.purchaser_name || null,
          handover_date: u.handover_date || null,
        };
      });

      const { data: insertedUnits, error: unitsError } = await supabaseAdmin
        .from('units')
        .insert(unitsWithIds)
        .select();

      if (unitsError) {
        console.error('[API /projects/create] Units error:', unitsError);
        await supabaseAdmin.from('unit_types').delete().eq('project_id', projectId);
        await supabaseAdmin.from('projects').delete().eq('id', projectId);
        return NextResponse.json({ error: unitsError.message || 'Failed to create units' }, { status: 500 });
      }
      
      unitsCreated = insertedUnits?.length || 0;
    }

    console.log(`[API /projects/create] Successfully created project ${projectId}: ${unitTypesCreated} unit types, ${unitsCreated} units`);

    return NextResponse.json({
      projectId,
      unitTypesCreated,
      unitTypesEnriched,
      unitsCreated,
      unitsWithMissingType,
    });
  } catch (err) {
    console.error('[API /projects/create] Error:', err);
    
    if (projectId) {
      try {
        await supabaseAdmin.from('units').delete().eq('project_id', projectId);
        await supabaseAdmin.from('unit_types').delete().eq('project_id', projectId);
        await supabaseAdmin.from('projects').delete().eq('id', projectId);
        console.log(`[API /projects/create] Rolled back project ${projectId}`);
      } catch (rollbackErr) {
        console.error('[API /projects/create] Rollback failed:', rollbackErr);
      }
    }
    
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create project' },
      { status: 500 }
    );
  }
}
