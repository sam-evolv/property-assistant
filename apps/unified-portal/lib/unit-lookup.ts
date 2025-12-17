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

    // CRITICAL FIX: Match Supabase unit to Drizzle unit by address to get correct house_type_code
    // Do NOT use LIMIT 1 on house_types - that picks wrong type for multi-type developments
    let houseTypeCode: string | null = null;
    let matchedBedrooms: number | null = null;
    let matchedBathrooms: number | null = null;

    if (supabaseUnit.address) {
      // Extract unit number from address using flexible patterns:
      // "31 Longview Park", "House 31 Longview", "31, Longview", "Unit 31", "31A Longview"
      const addressNormalized = supabaseUnit.address.trim();
      
      // Try multiple patterns to extract unit number
      const patterns = [
        /^(\d+[A-Za-z]?)[,\s]/,              // "31 Longview" or "31, Longview" or "31A Longview"
        /^(?:House|Unit|No\.?|#)\s*(\d+[A-Za-z]?)/i,  // "House 31" or "Unit 31A"
        /\b(\d+[A-Za-z]?)\s+(?:Longview|Park|Street|Road|Avenue|Lane|Drive)/i  // "at 31 Longview Park"
      ];
      
      let unitNumber: string | null = null;
      for (const pattern of patterns) {
        const match = addressNormalized.match(pattern);
        if (match) {
          unitNumber = match[1];
          break;
        }
      }
      
      if (unitNumber) {
        // Try to find matching Drizzle unit by address containing this number
        // Use fully wildcarded ILIKE patterns to handle all cases:
        // - "31 Longview" (start), "House 31 Longview" (middle), "31, Longview" (comma)
        const { rows: matchedRows } = await db.execute(sql`
          SELECT house_type_code, bedrooms, bathrooms, address_line_1
          FROM units 
          WHERE development_id = ${developmentId}::uuid
            AND (
              address_line_1 ILIKE ${'%' + unitNumber + ' %'}
              OR address_line_1 ILIKE ${'%' + unitNumber + ',%'}
              OR address_line_1 ILIKE ${unitNumber + ' %'}
              OR address_line_1 ILIKE ${unitNumber + ',%'}
              OR address_line_1 ~ ${'^' + unitNumber + '[^0-9]'}
            )
          LIMIT 1
        `);
        
        const matched = matchedRows[0] as any;
        if (matched) {
          houseTypeCode = matched.house_type_code;
          matchedBedrooms = matched.bedrooms;
          matchedBathrooms = matched.bathrooms;
          console.log('[UnitLookup] Matched Supabase unit to Drizzle by address number:', unitNumber, '-> house_type:', houseTypeCode, 'matched address:', matched.address_line_1);
        }
      }
    }
    
    // Fallback: get sample unit data for bedrooms/bathrooms even if house type matching failed
    if (!matchedBedrooms || !matchedBathrooms) {
      const { rows: sampleRows } = await db.execute(sql`
        SELECT bedrooms, bathrooms 
        FROM units 
        WHERE development_id = ${developmentId}::uuid
          AND bedrooms IS NOT NULL
        LIMIT 1
      `);
      const sample = sampleRows[0] as any;
      if (sample) {
        matchedBedrooms = matchedBedrooms || sample.bedrooms;
        matchedBathrooms = matchedBathrooms || sample.bathrooms;
      }
    }
    
    // Only fall back to first house type if address matching failed
    if (!houseTypeCode) {
      console.log('[UnitLookup] WARNING: Could not match unit by address, using fallback (may be incorrect)');
      const { rows: houseTypeRows } = await db.execute(sql`
        SELECT house_type_code 
        FROM house_types 
        WHERE development_id = ${developmentId}::uuid
        ORDER BY house_type_code
        LIMIT 1
      `);
      const fallbackType = houseTypeRows[0] as any;
      houseTypeCode = fallbackType?.house_type_code || null;
    }

    console.log('[UnitLookup] Using development:', developmentId, 'House type:', houseTypeCode || 'null');

    return {
      id: supabaseUnit.id,
      tenant_id: tenantId,
      development_id: developmentId,
      house_type_code: houseTypeCode,
      address: supabaseUnit.address || 'Unknown Unit',
      purchaser_name: supabaseUnit.purchaser_name,
      bedrooms: matchedBedrooms,
      bathrooms: matchedBathrooms,
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
