#!/usr/bin/env tsx
/**
 * BRANDING AUDIT SCRIPT - Phase 5 Verification
 * Iterates through ALL units and verifies:
 * - unit has development_id
 * - development has name and logo_url
 * Reports any broken units that would display incorrect branding
 * 
 * Usage: npx tsx apps/unified-portal/scripts/branding-audit.ts
 */
import { createClient } from '@supabase/supabase-js';
import { db } from '@openhouse/db';
import { units, developments } from '@openhouse/db/schema';
import { eq, isNull, sql } from 'drizzle-orm';

interface AuditResult {
  unit_id: string;
  unit_uid: string | null;
  unit_number: string | null;
  address: string | null;
  development_id: string | null;
  development_name: string | null;
  logo_url: string | null;
  status: 'OK' | 'MISSING_DEV_ID' | 'MISSING_DEV_NAME' | 'MISSING_LOGO' | 'ERROR';
  error?: string;
}

async function runBrandingAudit() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           OPENHOUSE BRANDING AUDIT REPORT                    ║');
  console.log('║           Multi-Tenant Portal Verification                   ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  const results: AuditResult[] = [];
  let totalUnits = 0;
  let okCount = 0;
  let missingDevIdCount = 0;
  let missingDevNameCount = 0;
  let missingLogoCount = 0;
  let errorCount = 0;

  try {
    console.log('📋 PHASE 1: Audit Drizzle Units Table\n');
    console.log('─'.repeat(80));

    const allUnits = await db.execute(sql`
      SELECT 
        u.id,
        u.unit_uid,
        u.unit_number,
        u.address_line_1,
        u.address_line_2,
        u.city,
        u.development_id,
        d.name as dev_name,
        d.logo_url as dev_logo_url
      FROM units u
      LEFT JOIN developments d ON u.development_id = d.id
      ORDER BY d.name NULLS LAST, u.unit_number
    `);

    totalUnits = allUnits.rows.length;
    console.log(`Found ${totalUnits} units in Drizzle database\n`);

    for (const unit of allUnits.rows as any[]) {
      const addressParts = [unit.address_line_1, unit.address_line_2, unit.city].filter(Boolean);
      const fullAddress = addressParts.join(', ');
      
      let status: AuditResult['status'] = 'OK';
      
      if (!unit.development_id) {
        status = 'MISSING_DEV_ID';
        missingDevIdCount++;
      } else if (!unit.dev_name) {
        status = 'MISSING_DEV_NAME';
        missingDevNameCount++;
      } else if (!unit.dev_logo_url) {
        status = 'MISSING_LOGO';
        missingLogoCount++;
      } else {
        okCount++;
      }

      const result: AuditResult = {
        unit_id: unit.id,
        unit_uid: unit.unit_uid,
        unit_number: unit.unit_number,
        address: fullAddress || null,
        development_id: unit.development_id,
        development_name: unit.dev_name,
        logo_url: unit.dev_logo_url,
        status,
      };

      results.push(result);

      if (status !== 'OK') {
        const icon = status === 'MISSING_DEV_ID' ? '❌' : status === 'MISSING_LOGO' ? '⚠️' : '❓';
        console.log(`${icon} [${status}] Unit: ${unit.unit_uid || unit.id}`);
        console.log(`   Address: ${fullAddress || 'N/A'}`);
        console.log(`   Development ID: ${unit.development_id || 'NULL'}`);
        console.log(`   Development Name: ${unit.dev_name || 'NULL'}`);
        console.log(`   Logo URL: ${unit.dev_logo_url || 'NULL'}\n`);
      }
    }

    console.log('\n' + '─'.repeat(80));
    console.log('📋 PHASE 2: Audit Developments Table\n');
    
    const allDevelopments = await db.execute(sql`
      SELECT 
        id, name, code, logo_url, tenant_id,
        (SELECT COUNT(*) FROM units WHERE development_id = developments.id) as unit_count
      FROM developments
      ORDER BY name
    `);

    console.log(`Found ${allDevelopments.rows.length} developments:\n`);
    
    for (const dev of allDevelopments.rows as any[]) {
      const logoStatus = dev.logo_url ? '✓' : '✗';
      console.log(`  ${logoStatus} ${dev.name} (${dev.code})`);
      console.log(`     ID: ${dev.id}`);
      console.log(`     Logo: ${dev.logo_url || 'NOT SET'}`);
      console.log(`     Units: ${dev.unit_count}`);
      console.log('');
    }

    console.log('\n' + '═'.repeat(80));
    console.log('                        AUDIT SUMMARY');
    console.log('═'.repeat(80) + '\n');
    
    console.log(`Total Units Audited:     ${totalUnits}`);
    console.log(`✓ OK (complete):         ${okCount}`);
    console.log(`❌ Missing Dev ID:        ${missingDevIdCount}`);
    console.log(`❓ Missing Dev Name:      ${missingDevNameCount}`);
    console.log(`⚠️  Missing Logo:          ${missingLogoCount}`);
    console.log(`💥 Errors:               ${errorCount}`);
    
    const brokenUnits = missingDevIdCount + missingDevNameCount + errorCount;
    console.log(`\n${'─'.repeat(40)}`);
    
    if (brokenUnits === 0) {
      console.log('✅ PASS: All units have complete branding data');
      console.log('   (Missing logos are warnings, not failures)');
    } else {
      console.log(`❌ FAIL: ${brokenUnits} units have broken branding`);
      console.log('   Run fix-branding-linkages.ts to repair');
    }

    console.log('\n' + '═'.repeat(80) + '\n');

    return {
      total: totalUnits,
      ok: okCount,
      missing_dev_id: missingDevIdCount,
      missing_dev_name: missingDevNameCount,
      missing_logo: missingLogoCount,
      errors: errorCount,
      broken: brokenUnits,
      pass: brokenUnits === 0,
      results,
    };

  } catch (err: any) {
    console.error('💥 AUDIT FAILED:', err.message);
    process.exit(1);
  }
}

runBrandingAudit()
  .then((summary) => {
    process.exit(summary.pass ? 0 : 1);
  })
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
