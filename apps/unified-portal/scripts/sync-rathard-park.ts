#!/usr/bin/env tsx
/**
 * SYNC RATHARD PARK UNITS - Full Synchronization Script
 * Imports all units from Supabase (Rathard Park) into Drizzle database
 */
import { createClient } from '@supabase/supabase-js';
import { db } from '@openhouse/db';
import { units, developments, houseTypes } from '@openhouse/db/schema';
import { eq, and } from 'drizzle-orm';

const RATHARD_PARK_SUPABASE_PROJECT_ID = '6d3789de-2e46-430c-bf31-22224bd878da';

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

  // Step 2: Find or create Rathard Park development in Drizzle
  console.log('\n📋 Checking Drizzle database for Rathard Park development...');
  let drizzleDevelopment = await db
    .select()
    .from(developments)
    .where(eq(developments.supabase_project_id, RATHARD_PARK_SUPABASE_PROJECT_ID))
    .then(rows => rows[0]);

  if (!drizzleDevelopment) {
    console.log('⚠️ Rathard Park not found in Drizzle, creating...');
    const [newDev] = await db.insert(developments).values({
      name: project.name || 'Rathard Park',
      code: 'RATHARD',
      address: 'Lahardane, Ballyvolane, Cork City, Cork',
      supabase_project_id: RATHARD_PARK_SUPABASE_PROJECT_ID,
      tenant_id: '00000000-0000-0000-0000-000000000001',
    }).returning();
    drizzleDevelopment = newDev;
    console.log(`✓ Created Rathard Park development: ${drizzleDevelopment.id}`);
  } else {
    console.log(`✓ Found existing development: ${drizzleDevelopment.id}`);
  }

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

  // Step 4: Get existing unit types
  const existingTypes = await db.select().from(houseTypes).where(eq(houseTypes.development_id, drizzleDevelopment.id));
  const typeMap = new Map(existingTypes.map(t => [t.code, t.id]));

  // Step 5: Sync each unit
  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const unit of supabaseUnits || []) {
    try {
      // Check if unit already exists
      const existingUnit = await db
        .select()
        .from(units)
        .where(eq(units.supabase_unit_id, unit.id))
        .then(rows => rows[0]);

      const unitData = {
        development_id: drizzleDevelopment.id,
        tenant_id: drizzleDevelopment.tenant_id,
        supabase_unit_id: unit.id,
        unit_number: unit.unit_number || unit.name || `Unit-${unit.id.substring(0, 8)}`,
        address: unit.address || `${unit.unit_number || 'Unit'}, Rathard Park, Cork`,
        status: unit.status || 'available',
        handover_date: unit.handover_date ? new Date(unit.handover_date) : null,
        bedrooms: unit.bedrooms || null,
        bathrooms: unit.bathrooms || null,
        floor_area_sqm: unit.floor_area_sqm || null,
        purchaser_name: unit.purchaser_name || null,
        purchaser_email: unit.purchaser_email || null,
        unique_qr_token: unit.unique_qr_token || crypto.randomUUID(),
        eircode: unit.eircode || null,
        mrpn: unit.mrpn || null,
        latitude: unit.latitude || null,
        longitude: unit.longitude || null,
      };

      if (existingUnit) {
        await db.update(units)
          .set(unitData)
          .where(eq(units.id, existingUnit.id));
        updated++;
      } else {
        await db.insert(units).values(unitData);
        created++;
      }
    } catch (err) {
      console.error(`❌ Error syncing unit ${unit.id}:`, err);
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
