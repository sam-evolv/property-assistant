#!/usr/bin/env tsx
/**
 * COMPREHENSIVE BRANDING AUDIT - Phase 5 Verification
 * 
 * Enumerates ALL resolvable units from:
 * 1. Drizzle units table (primary)
 * 2. Supabase units table (fallback)
 * 
 * For each unit, verifies:
 * - development_id is present
 * - development.name is present
 * - development_logo_url is present (for 3 estates)
 * 
 * Usage: npx tsx apps/unified-portal/scripts/branding-audit.ts
 */
import { createClient } from '@supabase/supabase-js';
import { db } from '@openhouse/db';
import { sql } from 'drizzle-orm';

interface AuditResult {
  unit_id: string;
  source: 'drizzle' | 'supabase';
  unit_identifier: string | null;
  address: string | null;
  development_id: string | null;
  development_name: string | null;
  logo_url: string | null;
  status: 'OK' | 'MISSING_DEV_ID' | 'MISSING_DEV_NAME' | 'MISSING_LOGO' | 'NO_DRIZZLE_MATCH';
}

const REQUIRED_LOGOS: Record<string, string> = {
  'Longview Park': '/longview-logo.png',
  'Rathard Park': '/rathard-park-logo.png',
  'Rathard Lawn': '/rathard-lawn-logo.png',
};

async function runComprehensiveBrandingAudit() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║       COMPREHENSIVE BRANDING AUDIT REPORT                    ║');
  console.log('║       All Resolvable Units (Drizzle + Supabase)              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  const results: AuditResult[] = [];
  const seenUnitIds = new Set<string>();

  // Initialize Supabase client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // =========================================================================
  // PHASE 1: Enumerate Drizzle developments (source of truth for branding)
  // =========================================================================
  console.log('📋 PHASE 1: Audit Drizzle Developments (Source of Truth)\n');
  console.log('─'.repeat(70));

  const developments = await db.execute(sql`
    SELECT id, name, code, logo_url, tenant_id
    FROM developments
    ORDER BY name
  `);

  const devMap = new Map<string, { name: string; logo_url: string | null }>();
  const devByName = new Map<string, { id: string; logo_url: string | null }>();

  console.log(`Found ${developments.rows.length} developments:\n`);
  for (const dev of developments.rows as any[]) {
    devMap.set(dev.id, { name: dev.name, logo_url: dev.logo_url });
    devByName.set(dev.name.toLowerCase(), { id: dev.id, logo_url: dev.logo_url });
    
    const logoStatus = dev.logo_url ? '✓' : '✗';
    const required = REQUIRED_LOGOS[dev.name];
    const logoMatch = required && dev.logo_url === required ? '(correct)' : required ? '(WRONG!)' : '';
    console.log(`  ${logoStatus} ${dev.name}`);
    console.log(`     Logo: ${dev.logo_url || 'NOT SET'} ${logoMatch}`);
  }

  // =========================================================================
  // PHASE 2: Enumerate Drizzle units
  // =========================================================================
  console.log('\n' + '─'.repeat(70));
  console.log('📋 PHASE 2: Audit Drizzle Units\n');

  const drizzleUnits = await db.execute(sql`
    SELECT 
      u.id, u.unit_uid, u.unit_number, u.address_line_1, u.address_line_2, u.city,
      u.development_id, d.name as dev_name, d.logo_url as dev_logo_url
    FROM units u
    LEFT JOIN developments d ON u.development_id = d.id
    ORDER BY d.name NULLS LAST, u.unit_number
  `);

  console.log(`Found ${drizzleUnits.rows.length} units in Drizzle\n`);

  for (const unit of drizzleUnits.rows as any[]) {
    seenUnitIds.add(unit.id);
    
    const addressParts = [unit.address_line_1, unit.address_line_2, unit.city].filter(Boolean);
    const fullAddress = addressParts.join(', ') || null;
    
    let status: AuditResult['status'] = 'OK';
    if (!unit.development_id) {
      status = 'MISSING_DEV_ID';
    } else if (!unit.dev_name) {
      status = 'MISSING_DEV_NAME';
    } else if (!unit.dev_logo_url && REQUIRED_LOGOS[unit.dev_name]) {
      status = 'MISSING_LOGO';
    }

    results.push({
      unit_id: unit.id,
      source: 'drizzle',
      unit_identifier: unit.unit_uid || unit.unit_number || null,
      address: fullAddress,
      development_id: unit.development_id,
      development_name: unit.dev_name,
      logo_url: unit.dev_logo_url,
      status,
    });

    if (status !== 'OK') {
      const icon = status === 'MISSING_DEV_ID' ? '❌' : status === 'MISSING_LOGO' ? '⚠️' : '❓';
      console.log(`${icon} [${status}] ${unit.unit_uid || unit.id}`);
    }
  }

  // =========================================================================
  // PHASE 3: Enumerate Supabase units (fallback source)
  // =========================================================================
  console.log('\n' + '─'.repeat(70));
  console.log('📋 PHASE 3: Audit Supabase Units (Fallback Source)\n');

  const { data: supabaseUnits, error: supaError } = await supabase
    .from('units')
    .select('id, address, purchaser_name, project_id');

  if (supaError) {
    console.error('Failed to fetch Supabase units:', supaError);
  }

  // Get Supabase projects for name resolution
  const { data: supabaseProjects } = await supabase
    .from('projects')
    .select('id, name, logo_url');

  const projectMap = new Map<string, { name: string; logo_url: string | null }>();
  for (const p of supabaseProjects || []) {
    projectMap.set(p.id, { name: p.name, logo_url: p.logo_url });
  }

  console.log(`Found ${supabaseUnits?.length || 0} units in Supabase\n`);
  console.log(`Found ${supabaseProjects?.length || 0} projects in Supabase\n`);

  let supabaseNewUnits = 0;
  for (const unit of supabaseUnits || []) {
    // Skip if already seen in Drizzle
    if (seenUnitIds.has(unit.id)) {
      continue;
    }
    supabaseNewUnits++;
    seenUnitIds.add(unit.id);

    // Resolve development from Supabase project -> Drizzle development
    const project = projectMap.get(unit.project_id);
    let drizzleDev: { id: string; logo_url: string | null } | undefined;
    
    if (project?.name) {
      drizzleDev = devByName.get(project.name.toLowerCase());
    }

    let status: AuditResult['status'] = 'OK';
    if (!unit.project_id) {
      status = 'MISSING_DEV_ID';
    } else if (!project?.name) {
      status = 'MISSING_DEV_NAME';
    } else if (!drizzleDev) {
      status = 'NO_DRIZZLE_MATCH';
    } else if (!drizzleDev.logo_url && REQUIRED_LOGOS[project.name]) {
      status = 'MISSING_LOGO';
    }

    results.push({
      unit_id: unit.id,
      source: 'supabase',
      unit_identifier: null,
      address: unit.address,
      development_id: drizzleDev?.id || unit.project_id,
      development_name: project?.name || null,
      logo_url: drizzleDev?.logo_url || project?.logo_url || null,
      status,
    });

    if (status !== 'OK') {
      const icon = status === 'MISSING_DEV_ID' ? '❌' : status === 'MISSING_LOGO' ? '⚠️' : '❓';
      console.log(`${icon} [${status}] ${unit.id} (Supabase only)`);
    }
  }

  console.log(`  → ${supabaseNewUnits} units unique to Supabase (not in Drizzle)`);

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n' + '═'.repeat(70));
  console.log('                        AUDIT SUMMARY');
  console.log('═'.repeat(70) + '\n');

  const byDevelopment: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  
  for (const r of results) {
    const devName = r.development_name || 'UNKNOWN';
    byDevelopment[devName] = (byDevelopment[devName] || 0) + 1;
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  }

  console.log('Units by Development:');
  for (const [name, count] of Object.entries(byDevelopment).sort()) {
    const logo = devByName.get(name.toLowerCase())?.logo_url || 'NO LOGO';
    console.log(`  ${name}: ${count} units (logo: ${logo})`);
  }

  console.log('\nUnits by Status:');
  for (const [status, count] of Object.entries(byStatus)) {
    const icon = status === 'OK' ? '✓' : '❌';
    console.log(`  ${icon} ${status}: ${count}`);
  }

  const totalUnits = results.length;
  const okCount = byStatus['OK'] || 0;
  const brokenCount = totalUnits - okCount;

  console.log(`\n${'─'.repeat(40)}`);
  console.log(`Total Resolvable Units:  ${totalUnits}`);
  console.log(`  From Drizzle:          ${drizzleUnits.rows.length}`);
  console.log(`  From Supabase only:    ${supabaseNewUnits}`);
  console.log(`✓ OK (complete):         ${okCount}`);
  console.log(`❌ Broken (failures):     ${brokenCount}`);

  if (brokenCount === 0 && totalUnits > 0) {
    console.log('\n✅ PASS: All resolvable units have complete branding data');
  } else if (totalUnits === 0) {
    console.log('\n⚠️  WARNING: No units found in any data source!');
  } else {
    console.log('\n❌ FAIL: Some units have incomplete branding');
  }

  console.log('\n' + '═'.repeat(70) + '\n');

  // Check required logos are set
  console.log('Logo Status for Required Estates:');
  for (const [name, expectedLogo] of Object.entries(REQUIRED_LOGOS)) {
    const dev = devByName.get(name.toLowerCase());
    if (!dev) {
      console.log(`  ❌ ${name}: Development not found in Drizzle`);
    } else if (!dev.logo_url) {
      console.log(`  ❌ ${name}: Logo not set (expected: ${expectedLogo})`);
    } else if (dev.logo_url !== expectedLogo) {
      console.log(`  ⚠️  ${name}: Wrong logo (got: ${dev.logo_url}, expected: ${expectedLogo})`);
    } else {
      console.log(`  ✓ ${name}: ${dev.logo_url}`);
    }
  }

  console.log('\n');

  return {
    total: totalUnits,
    ok: okCount,
    broken: brokenCount,
    byDevelopment,
    byStatus,
    pass: brokenCount === 0 && totalUnits > 0,
    results,
  };
}

runComprehensiveBrandingAudit()
  .then((summary) => {
    console.log('Audit complete. Exit code:', summary.pass ? 0 : 1);
    process.exit(summary.pass ? 0 : 1);
  })
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
