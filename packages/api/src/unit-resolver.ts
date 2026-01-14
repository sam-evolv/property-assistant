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
  
  const { data: supabaseUnit, error } = await supabase
    .from('units')
    .select('id, address, project_id, unit_type_id')
    .eq('id', unitUid)
    .single();

  if (error || !supabaseUnit) {
    console.log('[UnitResolver] Unit not found:', unitUid, error?.message);
    return null;
  }

  console.log('[UnitResolver] Found unit:', supabaseUnit.id, 'project:', supabaseUnit.project_id);

  let tenantId: string | null = null;
  let houseTypeCode: string | undefined;

  if (supabaseUnit.unit_type_id) {
    const { data: unitType } = await supabase
      .from('unit_types')
      .select('id, code, project_id')
      .eq('id', supabaseUnit.unit_type_id)
      .single();
    
    if (unitType) {
      houseTypeCode = unitType.code;
      console.log('[UnitResolver] House type code:', houseTypeCode);
    }
  }

  if (supabaseUnit.project_id) {
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
