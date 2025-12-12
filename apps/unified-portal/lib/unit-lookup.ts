import { db } from '@openhouse/db/client';
import { units, developments } from '@openhouse/db/schema';
import { eq, sql } from 'drizzle-orm';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const LONGVIEW_DEVELOPMENT_ID = '34316432-f1e8-4297-b993-d9b5c88ee2d8';
const LONGVIEW_TENANT_ID = 'fdd1bd1a-97fa-4a1c-94b5-ae22dceb077d';

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

    // CRITICAL: Supabase project_id may be the old Supabase project ID (57dc3919...),
    // not the Drizzle development ID (34316432...). We need to use the correct
    // Drizzle development ID for house type lookups.
    // For Longview units, always use the correct LONGVIEW_DEVELOPMENT_ID.
    const isLongviewAddress = (supabaseUnit.address || '').toLowerCase().includes('longview');
    const developmentId = isLongviewAddress ? LONGVIEW_DEVELOPMENT_ID : (supabaseUnit.project_id || LONGVIEW_DEVELOPMENT_ID);

    // TODO: For multi-house-type developments, we need to map each Supabase unit
    // to its specific house type. Options:
    // 1. Add house_type column to Supabase units table
    // 2. Create a mapping table unit_id -> house_type_code
    // 3. Derive from unit address/name patterns
    // For now, this works for Longview Park which has a single house type (BD01)
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

    // Use correct tenant ID for the development
    let tenantId = LONGVIEW_TENANT_ID;
    const dev = await db.query.developments.findFirst({
      where: eq(developments.id, developmentId),
      columns: { tenant_id: true },
    });
    if (dev) {
      tenantId = dev.tenant_id;
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
