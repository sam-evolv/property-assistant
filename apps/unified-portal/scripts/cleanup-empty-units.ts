#!/usr/bin/env tsx
/**
 * CLEANUP EMPTY UNITS - Remove orphan units with no data
 * 
 * These units exist in Drizzle as placeholders but have:
 * - No unit_uid
 * - No unit_number
 * - No address
 * - No development_id
 * 
 * They are correctly resolved via Supabase fallback in the resolve API,
 * but clutter the branding audit. This script removes them from Drizzle.
 * 
 * Usage: npx tsx apps/unified-portal/scripts/cleanup-empty-units.ts
 */
import { db } from '@openhouse/db';
import { sql } from 'drizzle-orm';

async function cleanupEmptyUnits() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║             CLEANUP EMPTY UNITS                              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  try {
    const orphans = await db.execute(sql`
      SELECT id FROM units
      WHERE development_id IS NULL
        AND unit_uid IS NULL
        AND unit_number IS NULL
        AND address_line_1 IS NULL
    `);

    console.log(`Found ${orphans.rows.length} empty orphan units\n`);

    if (orphans.rows.length === 0) {
      console.log('✅ No empty units to clean up');
      return { deleted: 0 };
    }

    console.log('These units have no useful data and are resolved via Supabase.');
    console.log('Deleting from Drizzle to clean up audit...\n');

    const result = await db.execute(sql`
      DELETE FROM units
      WHERE development_id IS NULL
        AND unit_uid IS NULL
        AND unit_number IS NULL
        AND address_line_1 IS NULL
      RETURNING id
    `);

    console.log(`✅ Deleted ${result.rows.length} empty units\n`);
    console.log('Run branding-audit.ts to verify cleanup.\n');

    return { deleted: result.rows.length };

  } catch (err: any) {
    console.error('💥 CLEANUP FAILED:', err.message);
    process.exit(1);
  }
}

cleanupEmptyUnits()
  .then((result) => {
    console.log('Summary:', result);
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
