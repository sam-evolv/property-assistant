import { db } from '@openhouse/db/client';
import { sql } from 'drizzle-orm';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export interface UnitInfo {
  id: string;
  tenant_id: string;
  development_id: string;
  supabase_project_id?: string;
  house_type_code: string | null;
  address: string;
  purchaser_name?: string;
  // All spec fields come straight from the `units` row — never from unit_types.specification_json.
  // If a value is null on the unit row, it stays null; callers must render "—" rather than guess.
  bedrooms?: number | null;
  bathrooms?: number | null;
  floor_area_m2?: number | null;
  property_type?: string | null;
  development_name?: string;
}

export async function getUnitInfo(unitUid: string): Promise<UnitInfo | null> {
  if (!unitUid) return null;

  try {
    const supabase = getSupabaseClient();

    // Source of truth: read spec fields directly from the units row.
    // unit_types.specification_json is NOT read here — it is a type-level default, not unit-level truth.
    const SELECT_FIELDS = 'id, unit_uid, address, address_line_1, purchaser_name, project_id, tenant_id, development_id, house_type_code, bedrooms, bathrooms, floor_area_m2, property_type';

    let supabaseUnit: any = null;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(unitUid);

    if (!isUuid) {
      const { data, error } = await supabase.from('units').select(SELECT_FIELDS).eq('unit_uid', unitUid).single();
      if (!error && data) supabaseUnit = data;
    }

    if (!supabaseUnit) {
      const { data, error } = await supabase.from('units').select(SELECT_FIELDS).eq('id', unitUid).single();
      if (!error && data) { supabaseUnit = data; }
    }

    if (!supabaseUnit) {
      return null;
    }

    const houseTypeCode = (supabaseUnit as any).house_type_code || null;
    const supabaseProjectId = supabaseUnit.project_id;
    const unitDevelopmentId = (supabaseUnit as any).development_id || null;

    // DEVELOPMENT NAME: always resolve via `developments` table using the unit's
    // development_id. Never fall back to projects.name — projects shares UUIDs
    // with developments in production data and that collision produces the
    // "Árdan View" leak on Rathárd Park homes.
    let drizzleDevelopmentId: string | null = unitDevelopmentId;
    let tenantId: string | null = (supabaseUnit as any).tenant_id || null;
    let developmentName: string | null = null;
    let projectsName: string | null = null;

    if (unitDevelopmentId) {
      try {
        const { rows: devRows } = await db.execute(sql`
          SELECT id, tenant_id, name FROM developments WHERE id = ${unitDevelopmentId}::uuid LIMIT 1
        `);
        if (devRows.length > 0) {
          const dev = devRows[0] as any;
          drizzleDevelopmentId = dev.id;
          tenantId = dev.tenant_id || tenantId;
          developmentName = dev.name;
        }
      } catch (_devLookupErr) {
        // Fall through — leave developmentName null; caller will show "—"
      }
    }

    // Grab projects.name purely for diagnostics logging — never for display.
    if (supabaseProjectId) {
      try {
        const { data: supabaseProject } = await supabase
          .from('projects')
          .select('name')
          .eq('id', supabaseProjectId)
          .single();
        projectsName = supabaseProject?.name || null;
      } catch (_projLookupErr) {
        // ignore
      }
    }

    // Defensive diagnostic log — lets us validate the collision fix on any unit.
    // Leave in place while Sam verifies other units (task brief Part B.3).
    console.log('[unit-lookup] resolved', JSON.stringify({
      unit_id: supabaseUnit.id,
      project_id: supabaseProjectId,
      development_id: drizzleDevelopmentId,
      developments_name: developmentName,
      projects_name: projectsName,
    }));

    const toNumberOrNull = (v: unknown): number | null => {
      if (v === null || v === undefined || v === '') return null;
      const n = typeof v === 'number' ? v : parseFloat(String(v));
      return Number.isFinite(n) ? n : null;
    };

    return {
      id: supabaseUnit.id,
      tenant_id: tenantId || '',
      development_id: drizzleDevelopmentId || '',
      supabase_project_id: supabaseProjectId,
      house_type_code: houseTypeCode,
      address: supabaseUnit.address || (supabaseUnit as any).address_line_1 || 'Unknown Unit',
      purchaser_name: supabaseUnit.purchaser_name,
      bedrooms: toNumberOrNull((supabaseUnit as any).bedrooms),
      bathrooms: toNumberOrNull((supabaseUnit as any).bathrooms),
      floor_area_m2: toNumberOrNull((supabaseUnit as any).floor_area_m2),
      property_type: (supabaseUnit as any).property_type || null,
      development_name: developmentName || undefined,
    };
  } catch (err) {
    return null;
  }
}

export async function getHouseTypeForUnit(unitUid: string): Promise<string | null> {
  const unitInfo = await getUnitInfo(unitUid);
  return unitInfo?.house_type_code || null;
}
