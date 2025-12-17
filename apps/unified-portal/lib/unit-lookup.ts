import { db } from '@openhouse/db/client';
import { units, developments } from '@openhouse/db/schema';
import { eq, sql } from 'drizzle-orm';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// NO HARDCODED DEVELOPMENT IDS - All lookups derive from unit.development_id

export interface UnitInfo {
  id: string;
  tenant_id: string;
  development_id: string;
  house_type_code: string | null;
  address: string;
  purchaser_name?: string;
  bedrooms?: number | null;
  bathrooms?: number | null;
}

export async function getUnitInfo(unitUid: string): Promise<UnitInfo | null> {
  if (!unitUid) return null;

  try {
    const drizzleResult = await db.execute(sql`
      SELECT 
        u.id,
        u.tenant_id,
        u.development_id,
        u.house_type_code,
        u.address_line_1,
        u.purchaser_name,
        u.bedrooms,
        u.bathrooms
      FROM units u
      WHERE u.id = ${unitUid}::uuid OR u.unit_uid = ${unitUid}
      LIMIT 1
    `);

    const drizzleUnit = drizzleResult.rows[0] as any;

    if (drizzleUnit && drizzleUnit.house_type_code) {
      console.log('[UnitLookup] Found in Drizzle with house_type_code:', drizzleUnit.house_type_code);
      return {
        id: drizzleUnit.id,
        tenant_id: drizzleUnit.tenant_id,
        development_id: drizzleUnit.development_id,
        house_type_code: drizzleUnit.house_type_code,
        address: drizzleUnit.address_line_1 || 'Unknown Unit',
        purchaser_name: drizzleUnit.purchaser_name,
        bedrooms: drizzleUnit.bedrooms,
        bathrooms: drizzleUnit.bathrooms,
      };
    }

    console.log('[UnitLookup] Not in Drizzle or missing house_type_code, checking Supabase...');
    const supabase = getSupabaseClient();
    const { data: supabaseUnit, error } = await supabase
      .from('units')
      .select('id, address, purchaser_name, project_id')
      .eq('id', unitUid)
      .single();

    if (error || !supabaseUnit) {
      console.log('[UnitLookup] Not found in Supabase either');
      return null;
    }

    console.log('[UnitLookup] Found in Supabase:', supabaseUnit.id);

    // Supabase units may have project_id that needs to be resolved to a development
    // Try to find the development by matching the project_id or by address pattern
    let developmentId: string | null = null;
    let tenantId: string | null = null;

    // First, try to find development by project_id (if it's a valid UUID)
    if (supabaseUnit.project_id) {
      const devByProjectId = await db.query.developments.findFirst({
        where: eq(developments.id, supabaseUnit.project_id),
        columns: { id: true, tenant_id: true, name: true },
      });
      if (devByProjectId) {
        developmentId = devByProjectId.id;
        tenantId = devByProjectId.tenant_id;
        console.log('[UnitLookup] Matched development by project_id:', devByProjectId.name);
      }
    }

    // If no match by project_id, try to find by address pattern
    if (!developmentId && supabaseUnit.address) {
      // Extract development name keywords from address (e.g., "Longview", "Rathard")
      const addressLower = supabaseUnit.address.toLowerCase();
      const allDevs = await db.query.developments.findMany({
        columns: { id: true, tenant_id: true, name: true },
      });
      
      for (const dev of allDevs) {
        const devNameLower = dev.name.toLowerCase();
        // Check if any significant word from dev name appears in address
        const devWords = devNameLower.split(/\s+/).filter(w => w.length > 3);
        for (const word of devWords) {
          if (addressLower.includes(word)) {
            developmentId = dev.id;
            tenantId = dev.tenant_id;
            console.log('[UnitLookup] Matched development by address pattern:', dev.name);
            break;
          }
        }
        if (developmentId) break;
      }
    }

    if (!developmentId || !tenantId) {
      console.log('[UnitLookup] WARNING: Could not resolve development for Supabase unit:', supabaseUnit.id);
      return null;
    }

    // Get house type for this development
    // TODO: For multi-house-type developments, we need unit-specific house type mapping
    const { rows: houseTypeRows } = await db.execute(sql`
      SELECT house_type_code, name 
      FROM house_types 
      WHERE development_id = ${developmentId}::uuid
      ORDER BY house_type_code
      LIMIT 1
    `);
    const houseType = houseTypeRows[0] as any;
    
    if (!houseType) {
      console.log('[UnitLookup] WARNING: No house types found for development:', developmentId);
    }

    const { rows: sampleUnitRows } = await db.execute(sql`
      SELECT bedrooms, bathrooms 
      FROM units 
      WHERE development_id = ${developmentId}::uuid
        AND bedrooms IS NOT NULL
      LIMIT 1
    `);
    const sampleUnit = sampleUnitRows[0] as any;

    console.log('[UnitLookup] Using development:', developmentId, 'House type:', houseType?.house_type_code || 'null');

    return {
      id: supabaseUnit.id,
      tenant_id: tenantId,
      development_id: developmentId,
      house_type_code: houseType?.house_type_code || null,
      address: supabaseUnit.address || 'Unknown Unit',
      purchaser_name: supabaseUnit.purchaser_name,
      bedrooms: sampleUnit?.bedrooms || null,
      bathrooms: sampleUnit?.bathrooms || null,
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
