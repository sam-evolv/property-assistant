#!/usr/bin/env npx tsx
/**
 * Initialize Sales Pipeline Records
 *
 * Creates unit_sales_pipeline records for all existing units that don't have one.
 * If a unit has purchaser data, it will be auto-released.
 *
 * Usage:
 *   npx tsx scripts/init-sales-pipeline.ts
 *   npx tsx scripts/init-sales-pipeline.ts --dry-run
 *   npx tsx scripts/init-sales-pipeline.ts --tenant-id=<uuid>
 */

import { db } from '@/lib/db';
import { units, unitSalesPipeline } from '@openhouse/db/schema';
import { eq, isNull, sql } from 'drizzle-orm';

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const tenantIdArg = args.find(a => a.startsWith('--tenant-id='));
  const specificTenantId = tenantIdArg ? tenantIdArg.split('=')[1] : null;

  console.log('===========================================');
  console.log('  Sales Pipeline Initialization Script');
  console.log('===========================================');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE'}`);
  console.log('');

  try {
    // Find all units that don't have a pipeline record
    const unitsWithoutPipeline = await db
      .select({
        unit: units,
      })
      .from(units)
      .leftJoin(unitSalesPipeline, eq(units.id, unitSalesPipeline.unit_id))
      .where(isNull(unitSalesPipeline.id));

    console.log(`Found ${unitsWithoutPipeline.length} units without pipeline records`);

    if (unitsWithoutPipeline.length === 0) {
      console.log('✅ All units already have pipeline records. Nothing to do.');
      return;
    }

    // Filter by tenant if specified
    const unitsToProcess = specificTenantId
      ? unitsWithoutPipeline.filter(u => u.unit.tenant_id === specificTenantId)
      : unitsWithoutPipeline;

    if (specificTenantId) {
      console.log(`Filtering to tenant: ${specificTenantId}`);
      console.log(`Units to process: ${unitsToProcess.length}`);
    }

    // Group by tenant for summary
    const byTenant = new Map<string, typeof unitsToProcess>();
    for (const { unit } of unitsToProcess) {
      const existing = byTenant.get(unit.tenant_id) || [];
      existing.push({ unit });
      byTenant.set(unit.tenant_id, existing);
    }

    console.log('\n📊 Summary by Tenant:');
    for (const [tenantId, tenantUnits] of byTenant) {
      const withPurchaser = tenantUnits.filter(u => u.unit.purchaser_name).length;
      console.log(`  - Tenant ${tenantId.slice(0, 8)}...: ${tenantUnits.length} units (${withPurchaser} with purchaser data)`);
    }
    console.log('');

    if (dryRun) {
      console.log('🔍 DRY RUN - No changes will be made');
      console.log(`Would create ${unitsToProcess.length} pipeline records`);
      return;
    }

    // Create pipeline records
    let created = 0;
    let released = 0;
    let errors = 0;

    for (const { unit } of unitsToProcess) {
      try {
        const hasExistingPurchaser = !!unit.purchaser_name;

        await db.insert(unitSalesPipeline).values({
          tenant_id: unit.tenant_id,
          development_id: unit.development_id,
          unit_id: unit.id,
          purchaser_name: unit.purchaser_name,
          purchaser_email: unit.purchaser_email,
          purchaser_phone: unit.purchaser_phone,
          // If has purchaser, assume it's been released
          release_date: hasExistingPurchaser ? new Date() : null,
        });

        created++;
        if (hasExistingPurchaser) released++;

        // Progress indicator
        if (created % 50 === 0) {
          console.log(`  Created ${created}/${unitsToProcess.length} records...`);
        }
      } catch (err) {
        console.error(`  ❌ Error creating record for unit ${unit.id}:`, err);
        errors++;
      }
    }

    console.log('');
    console.log('===========================================');
    console.log('  Results');
    console.log('===========================================');
    console.log(`✅ Created: ${created} pipeline records`);
    console.log(`   - Auto-released: ${released} (had purchaser data)`);
    console.log(`   - Not released: ${created - released}`);
    if (errors > 0) {
      console.log(`❌ Errors: ${errors}`);
    }
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main().catch(console.error);
