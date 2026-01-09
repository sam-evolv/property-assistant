import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAdminContextFromSession, isSuperAdmin, AdminContext } from '@/lib/api-auth';

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

async function deriveOrganizationId(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  adminContext: AdminContext,
  requestedOrgId?: string
): Promise<{ organizationId: string | null; error?: string }> {
  // First check if the adminContext has a tenantId
  if (adminContext.tenantId) {
    // Verify the tenant exists in the organisations table (projects FK references organisations, not tenants)
    const { data: org } = await supabase
      .from('organisations')
      .select('id')
      .eq('id', adminContext.tenantId)
      .single();
    
    if (org) {
      console.log(`[deriveOrganizationId] Using tenantId from context: ${adminContext.tenantId}`);
      return { organizationId: adminContext.tenantId };
    }
    
    // Fallback: check tenants table and see if there's a matching org
    console.warn(`[deriveOrganizationId] tenantId ${adminContext.tenantId} not found in organisations table, checking tenants...`);
  }
  
  if (isSuperAdmin(adminContext)) {
    if (requestedOrgId) {
      // Check organisations table first (this is what projects FK references)
      const { data: org } = await supabase
        .from('organisations')
        .select('id')
        .eq('id', requestedOrgId)
        .single();
      
      if (org) {
        console.log(`[deriveOrganizationId] Super-admin using selected org: ${requestedOrgId}`);
        return { organizationId: requestedOrgId };
      }
      
      // Fallback: check tenants table
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('id', requestedOrgId)
        .single();
      
      if (tenant) {
        console.log(`[deriveOrganizationId] Super-admin using tenant as org (may fail if not in organisations table): ${requestedOrgId}`);
        return { organizationId: requestedOrgId };
      }
    }
    
    // Try organisations table first
    const { data: orgs } = await supabase
      .from('organisations')
      .select('id, name')
      .order('created_at', { ascending: true })
      .limit(5);
    
    if (orgs && orgs.length === 1) {
      console.log(`[deriveOrganizationId] Super-admin fallback to single org: ${orgs[0].id} (${orgs[0].name})`);
      return { organizationId: orgs[0].id };
    }
    
    if (orgs && orgs.length > 1) {
      console.warn(`[deriveOrganizationId] Super-admin has multiple orgs available, none selected`);
      return { 
        organizationId: null, 
        error: 'Multiple organisations available. Please select an organisation to create a project.' 
      };
    }
    
    // If no organisations found, try tenants as fallback
    const { data: tenants } = await supabase
      .from('tenants')
      .select('id, name')
      .order('created_at', { ascending: true })
      .limit(5);
    
    if (tenants && tenants.length === 1) {
      console.log(`[deriveOrganizationId] Super-admin fallback to single tenant: ${tenants[0].id} (${tenants[0].name})`);
      return { organizationId: tenants[0].id };
    }
    
    if (tenants && tenants.length > 1) {
      console.warn(`[deriveOrganizationId] Super-admin has multiple tenants available, none selected`);
      return { 
        organizationId: null, 
        error: 'Multiple organisations available. Please select an organisation to create a project.' 
      };
    }
    
    return { 
      organizationId: null, 
      error: 'No organisations available. Please contact an admin.' 
    };
  }
  
  return { 
    organizationId: null, 
    error: 'Cannot create project: no organisation set for your account. Contact an admin.' 
  };
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
    const adminContext = await getAdminContextFromSession();
    
    if (!adminContext) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in.' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { project, unitTypes, units, organizationId: requestedOrgId } = body as {
      project: ProjectInput;
      unitTypes: UnitTypeInput[];
      units: UnitInput[];
      organizationId?: string;
    };

    if (!project?.name) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
    }

    const { organizationId, error: orgError } = await deriveOrganizationId(
      supabaseAdmin,
      adminContext,
      requestedOrgId
    );
    
    if (!organizationId || orgError) {
      console.error(`[API /projects/create] Organization derivation failed for user ${adminContext.email}:`, orgError);
      return NextResponse.json(
        { error: orgError || 'Cannot determine organisation for project creation.' },
        { status: 400 }
      );
    }
    
    console.log(`[API /projects/create] User: ${adminContext.email} (${adminContext.id}), Org: ${organizationId}, Project: ${project.name}`);

    const { data: projectData, error: projectError } = await supabaseAdmin
      .from('projects')
      .insert({
        name: project.name,
        address: project.address || null,
        image_url: project.image_url || null,
        organization_id: organizationId,
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
