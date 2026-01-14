#!/usr/bin/env tsx
/**
 * FIX BRANDING LINKAGES - Phase 2 Idempotent Migration
 * 
 * This script fixes all development linkages and logo URLs.
 * It is IDEMPOTENT (safe to re-run) and uses stable identifiers.
 * 
 * What it fixes:
 * 1. Ensures all developments have correct logo_url
 * 2. Links orphan units to correct development by name matching
 * 3. Creates missing Rathard Lawn development if needed
 * 
 * Usage: npx tsx apps/unified-portal/scripts/fix-branding-linkages.ts
 */
import { createClient } from '@supabase/supabase-js';
import { db } from '@openhouse/db';
import { units, developments, tenants } from '@openhouse/db/schema';
import { eq, ilike, isNull, and, sql } from 'drizzle-orm';

const DEVELOPMENT_LOGOS: Record<string, string> = {
  'Longview Park': '/longview-logo.png',
  'Rathard Park': '/rathard-park-logo.png',
  'Rathard Lawn': '/rathard-lawn-logo.png',
};

async function fixBrandingLinkages() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║        FIX BRANDING LINKAGES - Idempotent Migration          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  const stats = {
    developmentsUpdated: 0,
    developmentsCreated: 0,
    unitsLinked: 0,
    errors: [] as string[],
  };

  try {
    console.log('📋 STEP 1: Update development logo URLs\n');
    console.log('─'.repeat(60));

    for (const [devName, logoUrl] of Object.entries(DEVELOPMENT_LOGOS)) {
      const result = await db.execute(sql`
        UPDATE developments 
        SET logo_url = ${logoUrl}
        WHERE LOWER(name) = LOWER(${devName})
          AND (logo_url IS NULL OR logo_url != ${logoUrl})
        RETURNING id, name
      `);
      
      if (result.rows.length > 0) {
        console.log(`  ✓ Updated ${devName} logo -> ${logoUrl}`);
        stats.developmentsUpdated++;
      } else {
        const existing = await db.execute(sql`
          SELECT id, name, logo_url FROM developments WHERE LOWER(name) = LOWER(${devName})
        `);
        if (existing.rows.length > 0) {
          console.log(`  ○ ${devName} already has correct logo`);
        } else {
          console.log(`  ? ${devName} development not found in database`);
        }
      }
    }

    console.log('\n📋 STEP 2: Check for Rathard Lawn development\n');
    console.log('─'.repeat(60));

    const rathardLawn = await db.execute(sql`
      SELECT id, name, logo_url FROM developments WHERE LOWER(name) LIKE '%rathard lawn%'
    `);

    if (rathardLawn.rows.length === 0) {
      console.log('  ⚠️  Rathard Lawn development does not exist');
      console.log('  → Checking if there are units that need Rathard Lawn...');
      
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      
      const { data: rathardLawnProject } = await supabase
        .from('projects')
        .select('id, name')
        .ilike('name', '%rathard lawn%')
        .single();
      
      if (rathardLawnProject) {
        console.log(`  → Found Rathard Lawn in Supabase: ${rathardLawnProject.name}`);
        console.log('  → Need to create Rathard Lawn development in Drizzle');
        
        const defaultTenant = await db.execute(sql`
          SELECT id FROM tenants LIMIT 1
        `);
        
        if (defaultTenant.rows.length > 0) {
          const tenantId = (defaultTenant.rows[0] as any).id;
          
          const existingByCode = await db
            .select()
            .from(developments)
            .where(eq(developments.code, 'RATHARD_LAWN_001'))
            .limit(1);
          
          if (existingByCode.length === 0) {
            await db.insert(developments).values({
              tenant_id: tenantId,
              code: 'RATHARD_LAWN_001',
              name: 'Rathard Lawn',
              logo_url: '/rathard-lawn-logo.png',
              is_active: true,
            });
            console.log('  ✓ Created Rathard Lawn development');
            stats.developmentsCreated++;
          } else {
            await db.update(developments)
              .set({
                logo_url: '/rathard-lawn-logo.png',
                name: 'Rathard Lawn',
              })
              .where(eq(developments.code, 'RATHARD_LAWN_001'));
            console.log('  ✓ Updated Rathard Lawn development');
            stats.developmentsUpdated++;
          }
        }
      } else {
        console.log('  ○ No Rathard Lawn project found in Supabase');
      }
    } else {
      console.log(`  ✓ Rathard Lawn exists: ${(rathardLawn.rows[0] as any).id}`);
    }

    console.log('\n📋 STEP 3: Link orphan units to developments\n');
    console.log('─'.repeat(60));

    const orphanUnits = await db.execute(sql`
      SELECT id, unit_uid, unit_number, address_line_1, address_line_2
      FROM units
      WHERE development_id IS NULL
    `);

    console.log(`  Found ${orphanUnits.rows.length} units without development_id\n`);

    if (orphanUnits.rows.length > 0) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      
      for (const unit of orphanUnits.rows as any[]) {
        const addressHint = [unit.address_line_1, unit.address_line_2].filter(Boolean).join(' ').toLowerCase();
        let matchedDev: any = null;
        
        if (addressHint.includes('longview')) {
          const devResult = await db.execute(sql`
            SELECT id, name FROM developments WHERE LOWER(name) = 'longview park' LIMIT 1
          `);
          matchedDev = devResult.rows[0];
        } else if (addressHint.includes('rathard park') || addressHint.includes('lahardane')) {
          const devResult = await db.execute(sql`
            SELECT id, name FROM developments WHERE LOWER(name) = 'rathard park' LIMIT 1
          `);
          matchedDev = devResult.rows[0];
        } else if (addressHint.includes('rathard lawn')) {
          const devResult = await db.execute(sql`
            SELECT id, name FROM developments WHERE LOWER(name) = 'rathard lawn' LIMIT 1
          `);
          matchedDev = devResult.rows[0];
        }
        
        if (matchedDev) {
          await db.execute(sql`
            UPDATE units SET development_id = ${matchedDev.id}::uuid WHERE id = ${unit.id}::uuid
          `);
          console.log(`  ✓ Linked unit ${unit.unit_uid || unit.id} -> ${matchedDev.name}`);
          stats.unitsLinked++;
        } else {
          console.log(`  ? Could not match unit ${unit.unit_uid || unit.id}: ${addressHint.substring(0, 50)}...`);
          stats.errors.push(`Unmatched unit: ${unit.unit_uid || unit.id}`);
        }
      }
    }

    console.log('\n' + '═'.repeat(60));
    console.log('                    MIGRATION SUMMARY');
    console.log('═'.repeat(60) + '\n');
    
    console.log(`Developments updated:    ${stats.developmentsUpdated}`);
    console.log(`Developments created:    ${stats.developmentsCreated}`);
    console.log(`Units linked:            ${stats.unitsLinked}`);
    console.log(`Errors:                  ${stats.errors.length}`);
    
    if (stats.errors.length > 0) {
      console.log('\nUnresolved issues:');
      stats.errors.forEach(e => console.log(`  - ${e}`));
    }

    console.log('\n✅ Migration complete. Run branding-audit.ts to verify.\n');

    return stats;

  } catch (err: any) {
    console.error('💥 MIGRATION FAILED:', err.message);
    process.exit(1);
  }
}

fixBrandingLinkages()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
