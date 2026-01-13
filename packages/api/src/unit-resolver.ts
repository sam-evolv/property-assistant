import { createClient } from '@supabase/supabase-js';

export interface ResolvedUnit {
  id: string;
  tenant_id: string | null;
  development_id: string | null;
  address: string;
  house_type_code?: string;
  unit_type_id?: string;
}

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function getUnitInfo(unitUid: string): Promise<ResolvedUnit | null> {
  const supabase = getSupabaseClient();
  
  // Try by id first, then by unit_uid
  let supabaseUnit: any = null;
  let error: any = null;
  
  const { data: unitById, error: errById } = await supabase
    .from('units')
    .select('id, address, project_id, unit_type_id, tenant_id, house_type_code')
    .eq('id', unitUid)
    .single();
  
  if (unitById) {
    supabaseUnit = unitById;
  } else {
    // Try by unit_uid
    const { data: unitByUid, error: errByUid } = await supabase
      .from('units')
      .select('id, address, project_id, unit_type_id, tenant_id, house_type_code')
      .eq('unit_uid', unitUid)
      .single();
    
    if (unitByUid) {
      supabaseUnit = unitByUid;
    } else {
      error = errById || errByUid;
    }
  }

  if (error || !supabaseUnit) {
    console.log('[UnitResolver] Unit not found:', unitUid, error?.message);
    return null;
  }

  console.log('[UnitResolver] Found unit:', supabaseUnit.id, 'project:', supabaseUnit.project_id, 'tenant:', supabaseUnit.tenant_id);

  let tenantId: string | null = supabaseUnit.tenant_id || null;
  let houseTypeCode: string | undefined = supabaseUnit.house_type_code;

  if (supabaseUnit.unit_type_id) {
    const { data: unitType } = await supabase
      .from('unit_types')
      .select('id, code, project_id')
      .eq('id', supabaseUnit.unit_type_id)
      .single();
    
    if (unitType && unitType.code) {
      houseTypeCode = unitType.code;
      console.log('[UnitResolver] House type code:', houseTypeCode);
    }
  }

  // Fallback: get tenant_id from project if not on unit
  if (!tenantId && supabaseUnit.project_id) {
    const { data: project } = await supabase
      .from('projects')
      .select('id, tenant_id')
      .eq('id', supabaseUnit.project_id)
      .single();

    if (project) {
      tenantId = project.tenant_id;
    }
  }

  return {
    id: supabaseUnit.id,
    tenant_id: tenantId,
    development_id: supabaseUnit.project_id || null,
    address: supabaseUnit.address || 'Unknown Unit',
    house_type_code: houseTypeCode,
    unit_type_id: supabaseUnit.unit_type_id,
  };
}
