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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getUnitInfo(unitUid: string): Promise<ResolvedUnit | null> {
  const supabase = getSupabaseClient();

  // The homeowner app addresses a unit by its human unit_uid (e.g. AV-015-7CCB),
  // while the developer portal passes the units.id UUID. Match the shape-appropriate
  // column so a non-UUID is never compared against the uuid id column, which errors
  // with 22P02 and was being swallowed into a null (a 404). The two forms are
  // disjoint, so there is no cross-match risk.
  const column = UUID_RE.test(unitUid) ? 'id' : 'unit_uid';

  // Include tenant_id and development_id directly from units table
  const { data: supabaseUnit, error } = await supabase
    .from('units')
    .select('id, address, development_id, unit_type_id, tenant_id')
    .eq(column, unitUid)
    .maybeSingle();

  if (error) {
    // Surface the REST error rather than swallowing it silently, then fall through
    // to null. A genuine not-found is error-free with maybeSingle, so it returns
    // null below without logging. We never throw: callers 404 on null today, and
    // throwing would turn those graceful 404s into 500s.
    console.error('[unit-resolver] getUnitInfo lookup failed', JSON.stringify({
      unitUid,
      column,
      code: (error as { code?: string }).code ?? null,
      message: error.message ?? null,
      details: (error as { details?: string }).details ?? null,
      hint: (error as { hint?: string }).hint ?? null,
    }));
  }

  if (error || !supabaseUnit) {
    return null;
  }

  // Use tenant_id directly from unit (not from projects table which has organization_id instead)
  const tenantId: string | null = supabaseUnit.tenant_id || null;

  let houseTypeCode: string | undefined;

  if (supabaseUnit.unit_type_id) {
    const { data: unitType } = await supabase
      .from('unit_types')
      .select('id, code, project_id')
      .eq('id', supabaseUnit.unit_type_id)
      .single();

    if (unitType) {
      houseTypeCode = unitType.code;
    }
  }

  return {
    id: supabaseUnit.id,
    tenant_id: tenantId,
    development_id: supabaseUnit.development_id || null,
    address: supabaseUnit.address || 'Unknown Unit',
    house_type_code: houseTypeCode,
    unit_type_id: supabaseUnit.unit_type_id,
  };
}
