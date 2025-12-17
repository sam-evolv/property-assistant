#!/usr/bin/env tsx
/**
 * SYNC RATHARD PARK UNITS - Full Synchronization Script
 * Imports all units from Supabase (Rathard Park) into Drizzle database
 */
import { createClient } from '@supabase/supabase-js';
import { db } from '@openhouse/db';
import { units, developments } from '@openhouse/db/schema';
import { eq, ilike, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

const RATHARD_PARK_SUPABASE_PROJECT_ID = '6d3789de-2e46-430c-bf31-22224bd878da';
const RATHARD_PARK_NAME = 'Rathard Park';
const DEVELOPMENT_CODE = 'RATHARD_PARK_8U9H';

async function syncRathardPark() {
  console.log('🔄 Starting Rathard Park Synchronization...\n');

  // Initialize Supabase client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Step 1: Fetch Rathard Park project from Supabase
  console.log('📥 Fetching Rathard Park from Supabase...');
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', RATHARD_PARK_SUPABASE_PROJECT_ID)
    .single();

  if (projectError || !project) {
    console.error('❌ Failed to fetch Rathard Park project:', projectError);
    process.exit(1);
  }
  console.log(`✓ Found project: ${project.name}`);

  // Step 2: Find Rathard Park development in Drizzle
  console.log('\n📋 Finding Rathard Park development in Drizzle...');
  const drizzleDevelopment = await db
    .select()
    .from(developments)
    .where(eq(developments.code, DEVELOPMENT_CODE))
    .then(rows => rows[0]);

  if (!drizzleDevelopment) {
    console.error('❌ Rathard Park development not found in Drizzle with code:', DEVELOPMENT_CODE);
    console.log('   Please ensure development exists with code:', DEVELOPMENT_CODE);
    process.exit(1);
  }
  console.log(`✓ Found development: ${drizzleDevelopment.id} (${drizzleDevelopment.name})`);

  // Step 3: Fetch all units from Supabase
  console.log('\n📥 Fetching units from Supabase...');
  const { data: supabaseUnits, error: unitsError } = await supabase
    .from('units')
    .select('*')
    .eq('project_id', RATHARD_PARK_SUPABASE_PROJECT_ID);

  if (unitsError) {
    console.error('❌ Failed to fetch units:', unitsError);
    process.exit(1);
  }
  console.log(`✓ Found ${supabaseUnits?.length || 0} units in Supabase`);

  // Step 4: Get existing units in Drizzle to check for duplicates
  const existingUnits = await db
    .select()
    .from(units)
    .where(eq(units.development_id, drizzleDevelopment.id));
  
  const existingUnitMap = new Map(existingUnits.map(u => [u.unit_number, u]));
  console.log(`📊 Existing units in Drizzle: ${existingUnits.length}`);

  // Step 5: Sync each unit
  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const unit of supabaseUnits || []) {
    try {
      const unitNumber = unit.unit_number || unit.name || `Unit-${unit.id.substring(0, 8)}`;
      const existingUnit = existingUnitMap.get(unitNumber);
      const unitCode = unit.unit_code || `${DEVELOPMENT_CODE}-${unitNumber.replace(/\s+/g, '-')}`;
      const unitUid = unit.unit_uid || `${DEVELOPMENT_CODE.toLowerCase()}-${nanoid(12)}`;

      // Map Supabase unit data to Drizzle schema with all required fields
      const unitData = {
        tenant_id: drizzleDevelopment.tenant_id,
        development_id: drizzleDevelopment.id,
        development_code: DEVELOPMENT_CODE,
        unit_number: unitNumber,
        unit_code: unitCode,
        unit_uid: unitUid,
        address_line_1: unit.address || `${unitNumber}, Rathard Park`,
        address_line_2: unit.address_line_2 || 'Lahardane, Ballyvolane',
        city: unit.city || 'Cork',
        state_province: unit.state_province || 'Cork',
        postal_code: unit.postal_code || null,
        country: unit.country || 'Ireland',
        eircode: unit.eircode || null,
        property_designation: unit.property_designation || null,
        property_type: unit.property_type || 'house',
        house_type_code: unit.house_type || unit.house_type_code || 'A',
        bedrooms: unit.bedrooms || null,
        bathrooms: unit.bathrooms || null,
        square_footage: unit.square_footage || null,
        floor_area_m2: unit.floor_area_sqm || unit.floor_area_m2 || null,
        purchaser_name: unit.purchaser_name || null,
        purchaser_email: unit.purchaser_email || null,
        purchaser_phone: unit.purchaser_phone || null,
        mrpn: unit.mrpn || null,
        latitude: unit.latitude || null,
        longitude: unit.longitude || null,
      };

      if (existingUnit) {
        // Update existing unit (exclude unit_uid as it must be unique)
        const { unit_uid, ...updateData } = unitData;
        await db.update(units)
          .set(updateData)
          .where(eq(units.id, existingUnit.id));
        updated++;
        console.log(`  ⟳ Updated: ${unitNumber}`);
      } else {
        // Create new unit
        await db.insert(units).values(unitData);
        created++;
        console.log(`  + Created: ${unitNumber}`);
      }
    } catch (err: any) {
      console.error(`❌ Error syncing unit ${unit.unit_number || unit.id}:`, err.message || err);
      errors++;
    }
  }

  // Step 6: Verify final counts
  const finalCount = await db
    .select()
    .from(units)
    .where(eq(units.development_id, drizzleDevelopment.id))
    .then(rows => rows.length);

  console.log('\n✅ SYNC COMPLETE!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📊 Results:`);
  console.log(`   Created: ${created} units`);
  console.log(`   Updated: ${updated} units`);
  console.log(`   Errors:  ${errors}`);
  console.log(`   Total in Drizzle: ${finalCount} units`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  process.exit(0);
}

syncRathardPark().catch(console.error);
