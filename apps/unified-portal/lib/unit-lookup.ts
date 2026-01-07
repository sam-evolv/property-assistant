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
  bedrooms?: number | null;
  bathrooms?: number | null;
  development_name?: string;
}

export async function getUnitInfo(unitUid: string): Promise<UnitInfo | null> {
  if (!unitUid) return null;

  try {
    const supabase = getSupabaseClient();
    
    const { data: supabaseUnit, error } = await supabase
      .from('units')
      .select('id, address, purchaser_name, project_id, unit_type_id, unit_types(name, floor_plan_pdf_url, specification_json)')
      .eq('id', unitUid)
      .single();

    if (error || !supabaseUnit) {
      console.log('[UnitLookup] Not found in Supabase:', error?.message);
      return null;
    }

    console.log('[UnitLookup] Found in Supabase:', supabaseUnit.id);

    const unitType = supabaseUnit.unit_types as any;
    const houseTypeCode = unitType?.name || null;
    const supabaseProjectId = supabaseUnit.project_id;

    console.log('[UnitLookup] House type from Supabase:', houseTypeCode);

    let drizzleDevelopmentId: string | null = null;
    let tenantId: string | null = null;
    let developmentName: string | null = null;

    if (supabaseUnit.project_id) {
      const { data: supabaseProject } = await supabase
        .from('projects')
        .select('id, name')
        .eq('id', supabaseUnit.project_id)
        .single();
      
      if (supabaseProject) {
        console.log('[UnitLookup] Supabase project name:', supabaseProject.name);
        developmentName = supabaseProject.name;
        
        try {
          const { rows: devRows } = await db.execute(sql`
            SELECT id, tenant_id, name FROM developments 
            WHERE LOWER(name) = LOWER(${supabaseProject.name})
          `);
          
          if (devRows.length > 0) {
            const dev = devRows[0] as any;
            drizzleDevelopmentId = dev.id;
            tenantId = dev.tenant_id;
            developmentName = dev.name;
            console.log('[UnitLookup] Matched Drizzle development by name:', dev.name);
          }
        } catch (dbError) {
          console.log('[UnitLookup] Drizzle lookup failed (expected in dev), using fallback IDs');
        }
      }
    }

    if (!drizzleDevelopmentId || !tenantId) {
      drizzleDevelopmentId = '34316432-f1e8-4297-b993-d9b5c88ee2d8';
      tenantId = 'fdd1bd1a-97fa-4a1c-94b5-ae22dceb077d';
      console.log('[UnitLookup] Using hardcoded fallback tenant/development IDs');
    }

    const specJson = unitType?.specification_json || {};
    const bedrooms = specJson.bedrooms ? parseInt(specJson.bedrooms) || null : null;
    const bathrooms = specJson.bathrooms ? parseInt(specJson.bathrooms) || null : null;

    console.log('[UnitLookup] Returning unit with house_type:', houseTypeCode, 'project_id:', supabaseProjectId);

    return {
      id: supabaseUnit.id,
      tenant_id: tenantId,
      development_id: drizzleDevelopmentId,
      supabase_project_id: supabaseProjectId,
      house_type_code: houseTypeCode,
      address: supabaseUnit.address || 'Unknown Unit',
      purchaser_name: supabaseUnit.purchaser_name,
      bedrooms,
      bathrooms,
      development_name: developmentName || undefined,
    };
  } catch (err) {
    console.error('[UnitLookup] Error:', err);
    return null;
  }
}

export async function getHouseTypeForUnit(unitUid: string): Promise<string | null> {
  const unitInfo = await getUnitInfo(unitUid);
  return unitInfo?.house_type_code || null;
}
