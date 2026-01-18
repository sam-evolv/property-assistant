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

  // Include tenant_id directly from units table - it's already there!
  const { data: supabaseUnit, error } = await supabase
    .from('units')
    .select('id, address, project_id, unit_type_id, tenant_id')
    .eq('id', unitUid)
    .single();

  if (error || !supabaseUnit) {
    console.log('[UnitResolver] Unit not found:', unitUid, error?.message);
    return null;
  }

  // Use tenant_id directly from unit (not from projects table which has organization_id instead)
  const tenantId: string | null = supabaseUnit.tenant_id || null;

  console.log('[UnitResolver] Found unit:', supabaseUnit.id, 'tenant:', tenantId, 'project:', supabaseUnit.project_id);

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

  return {
    id: supabaseUnit.id,
    tenant_id: tenantId,
    development_id: supabaseUnit.project_id || null,
    address: supabaseUnit.address || 'Unknown Unit',
    house_type_code: houseTypeCode,
    unit_type_id: supabaseUnit.unit_type_id,
  };
}
