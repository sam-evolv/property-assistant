#!/usr/bin/env npx tsx
import { db } from '@openhouse/db/client';
import { sql } from 'drizzle-orm';
import { developments, units, documents, doc_chunks, noticeboard_posts, houseTypes } from '@openhouse/db/schema';
import { eq } from 'drizzle-orm';

interface VerificationResult {
  test: string;
  passed: boolean;
  details: string;
}

const results: VerificationResult[] = [];

function log(message: string) {
  console.log(`[Verify] ${message}`);
}

function pass(test: string, details: string) {
  results.push({ test, passed: true, details });
  console.log(`✅ PASS: ${test} - ${details}`);
}

function fail(test: string, details: string) {
  results.push({ test, passed: false, details });
  console.log(`❌ FAIL: ${test} - ${details}`);
}

async function verifyDevelopmentIsolation(devName: string) {
  log(`\n========================================`);
  log(`Verifying development: ${devName}`);
  log(`========================================\n`);

  const dev = await db.query.developments.findFirst({
    where: sql`LOWER(${developments.name}) LIKE ${`%${devName.toLowerCase()}%`}`,
  });

  if (!dev) {
    fail(`${devName} exists`, `Development not found in database`);
    return;
  }

  pass(`${devName} exists`, `Found development: ${dev.name} (ID: ${dev.id})`);

  const devUnits = await db.query.units.findMany({
    where: eq(units.development_id, dev.id),
  });

  log(`Found ${devUnits.length} units for ${devName}`);

  if (devUnits.length > 0) {
    pass(`${devName} has units`, `${devUnits.length} units found`);

    const sameDevId = devUnits.every(u => u.development_id === dev.id);
    if (sameDevId) {
      pass(`${devName} units have correct development_id`, `All ${devUnits.length} units reference development ${dev.id}`);
    } else {
      fail(`${devName} units have correct development_id`, `Some units have mismatched development_id`);
    }

    const sameTenantId = devUnits.every(u => u.tenant_id === dev.tenant_id);
    if (sameTenantId) {
      pass(`${devName} units have correct tenant_id`, `All units reference tenant ${dev.tenant_id}`);
    } else {
      fail(`${devName} units have correct tenant_id`, `Some units have mismatched tenant_id`);
    }

    const sampleUnit = devUnits[0];
    log(`Sample unit: ${sampleUnit.unit_uid} - ${sampleUnit.address_line_1}`);
    
    if (sampleUnit.house_type_code) {
      pass(`${devName} unit has house_type_code`, `Sample unit has house type: ${sampleUnit.house_type_code}`);
    }

    if (sampleUnit.eircode) {
      pass(`${devName} unit has eircode`, `Sample unit eircode: ${sampleUnit.eircode}`);
    } else {
      log(`INFO: Sample unit has no eircode (optional field)`);
    }
  } else {
    log(`INFO: No units yet for ${devName} (pending CSV import)`);
  }

  const devHouseTypes = await db.query.houseTypes.findMany({
    where: eq(houseTypes.development_id, dev.id),
  });
  log(`Found ${devHouseTypes.length} house types for ${devName}: ${devHouseTypes.map(h => h.house_type_code).join(', ')}`);

  const devDocs = await db.query.documents.findMany({
    where: eq(documents.development_id, dev.id),
  });
  log(`Found ${devDocs.length} documents for ${devName}`);

  const devNotices = await db.query.noticeboard_posts.findMany({
    where: eq(noticeboard_posts.development_id, dev.id),
  });
  log(`Found ${devNotices.length} noticeboard posts for ${devName}`);

  return { dev, units: devUnits };
}

async function verifyCrossDevIsolation(dev1Name: string, dev2Name: string) {
  log(`\n========================================`);
  log(`Verifying isolation between ${dev1Name} and ${dev2Name}`);
  log(`========================================\n`);

  const dev1 = await db.query.developments.findFirst({
    where: sql`LOWER(${developments.name}) LIKE ${`%${dev1Name.toLowerCase()}%`}`,
  });

  const dev2 = await db.query.developments.findFirst({
    where: sql`LOWER(${developments.name}) LIKE ${`%${dev2Name.toLowerCase()}%`}`,
  });

  if (!dev1 || !dev2) {
    log(`SKIP: One or both developments not found - cannot verify isolation`);
    return;
  }

  const crossRefUnits = await db.execute(sql`
    SELECT id, unit_uid, address_line_1, development_id 
    FROM units 
    WHERE development_id = ${dev1.id}::uuid 
    AND (
      LOWER(address_line_1) LIKE ${`%${dev2Name.toLowerCase()}%`}
      OR LOWER(unit_uid) LIKE ${`%${dev2Name.toLowerCase()}%`}
    )
  `);

  if (crossRefUnits.rows.length === 0) {
    pass(`No ${dev1Name} units reference ${dev2Name}`, `0 cross-references found`);
  } else {
    fail(`${dev1Name} units reference ${dev2Name}`, `${crossRefUnits.rows.length} units have cross-references`);
    (crossRefUnits.rows as any[]).forEach(u => {
      log(`  - ${u.unit_uid}: ${u.address_line_1}`);
    });
  }

  const crossRefDocs = await db.execute(sql`
    SELECT id, file_name, development_id 
    FROM documents 
    WHERE development_id = ${dev1.id}::uuid 
    AND (
      LOWER(file_name) LIKE ${`%${dev2Name.toLowerCase()}%`}
      OR LOWER(title) LIKE ${`%${dev2Name.toLowerCase()}%`}
    )
    LIMIT 10
  `);

  if (crossRefDocs.rows.length === 0) {
    pass(`No ${dev1Name} documents reference ${dev2Name}`, `0 cross-references found`);
  } else {
    fail(`${dev1Name} documents reference ${dev2Name}`, `${crossRefDocs.rows.length} documents have cross-references`);
  }
}

async function verifyNoHardcodedIds() {
  log(`\n========================================`);
  log(`Verifying no hardcoded development assumptions`);
  log(`========================================\n`);

  const allDevs = await db.query.developments.findMany();
  log(`Total developments in database: ${allDevs.length}`);

  for (const dev of allDevs) {
    log(`- ${dev.name} (ID: ${dev.id}, Tenant: ${dev.tenant_id})`);
  }

  const unitsWithoutDevId = await db.execute(sql`
    SELECT COUNT(*) as count FROM units WHERE development_id IS NULL
  `);
  const nullDevCount = (unitsWithoutDevId.rows[0] as any).count;
  
  if (parseInt(nullDevCount) === 0) {
    pass(`All units have development_id`, `No orphaned units found`);
  } else {
    fail(`All units have development_id`, `${nullDevCount} units have NULL development_id`);
  }

  const unitsWithoutTenantId = await db.execute(sql`
    SELECT COUNT(*) as count FROM units WHERE tenant_id IS NULL
  `);
  const nullTenantCount = (unitsWithoutTenantId.rows[0] as any).count;
  
  if (parseInt(nullTenantCount) === 0) {
    pass(`All units have tenant_id`, `No orphaned units found`);
  } else {
    fail(`All units have tenant_id`, `${nullTenantCount} units have NULL tenant_id`);
  }
}

async function main() {
  console.log(`\n╔════════════════════════════════════════════════════════════╗`);
  console.log(`║     MULTI-DEVELOPMENT ISOLATION VERIFICATION SCRIPT       ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝\n`);

  try {
    await verifyDevelopmentIsolation('Longview');

    await verifyDevelopmentIsolation('Rathard');

    await verifyCrossDevIsolation('Longview', 'Rathard');
    await verifyCrossDevIsolation('Rathard', 'Longview');

    await verifyNoHardcodedIds();

    console.log(`\n╔════════════════════════════════════════════════════════════╗`);
    console.log(`║                    VERIFICATION SUMMARY                    ║`);
    console.log(`╚════════════════════════════════════════════════════════════╝\n`);

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    console.log(`Total tests: ${results.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(``);

    if (failed > 0) {
      console.log(`\n❌ OVERALL: FAIL - ${failed} test(s) failed\n`);
      results.filter(r => !r.passed).forEach(r => {
        console.log(`  - ${r.test}: ${r.details}`);
      });
      process.exit(1);
    } else {
      console.log(`\n✅ OVERALL: PASS - All ${passed} tests passed\n`);
      process.exit(0);
    }
  } catch (error) {
    console.error(`\n❌ FATAL ERROR:`, error);
    process.exit(1);
  }
}

main();
