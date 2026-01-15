/**
 * Safe Development Creation Script v2
 * 
 * This script creates a new development with all required data using a 
 * server-side SQL function for TRUE transactional operation.
 * If any step fails, the entire operation is rolled back by PostgreSQL.
 * 
 * Features:
 * - TRUE transactional creation via SQL function (all-or-nothing)
 * - Idempotent: safe to re-run with same seed_identifier
 * - Environment guard: demo seeding disabled unless ALLOW_DEMO_SEED=true
 * - Audit trail via demo_seed_log table
 * 
 * Prerequisites:
 * - Run 001_multi_tenant_hardening.sql migration first to create the 
 *   create_development_transactional() function
 * 
 * Usage:
 *   ALLOW_DEMO_SEED=true npx tsx scripts/hardening/create-development-safe.ts <seed-file.json>
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface SeedConfig {
  seed_identifier: string;
  is_demo: boolean;
  tenant: {
    name: string;
    slug: string;
    logo_url?: string;
  };
  development: {
    code: string;
    name: string;
    slug: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    logo_url?: string;
  };
  house_types: {
    code: string;
    name: string;
    bedrooms?: number;
    bathrooms?: number;
    floor_area_sqm?: number;
  }[];
  units: {
    unit_number: string;
    house_type_code: string;
    address_line_1: string;
    purchaser_name?: string;
  }[];
}

async function createDevelopmentTransactional(config: SeedConfig): Promise<any> {
  // Call the server-side transactional function
  const { data, error } = await supabase.rpc('create_development_transactional', {
    p_seed_identifier: config.seed_identifier,
    p_tenant_name: config.tenant.name,
    p_tenant_slug: config.tenant.slug,
    p_dev_code: config.development.code,
    p_dev_name: config.development.name,
    p_dev_slug: config.development.slug,
    p_dev_address: config.development.address || null,
    p_house_types: config.house_types.map(ht => ({
      code: ht.code,
      name: ht.name,
      floor_area_sqm: ht.floor_area_sqm || null,
      bedrooms: ht.bedrooms || null,
      bathrooms: ht.bathrooms || null,
    })),
    p_units: config.units.map(u => ({
      unit_number: u.unit_number,
      house_type_code: u.house_type_code,
      address_line_1: u.address_line_1,
      purchaser_name: u.purchaser_name || null,
    })),
  });

  if (error) {
    throw new Error(`Transactional creation failed: ${error.message}`);
  }

  return data;
}

async function main() {
  const args = process.argv.slice(2);
  const seedFile = args[0];

  console.log('='.repeat(60));
  console.log('SAFE DEVELOPMENT CREATION SCRIPT v2');
  console.log('(Uses transactional SQL function)');
  console.log('='.repeat(60));

  // Environment guard for demo seeding
  if (!seedFile) {
    console.error('\nUsage: npx tsx scripts/hardening/create-development-safe.ts <seed-file.json>');
    console.error('\nExample seed file structure:');
    console.error(JSON.stringify({
      seed_identifier: 'demo-development-001',
      is_demo: true,
      tenant: { name: 'Demo Developer', slug: 'demo-developer' },
      development: { code: 'DEMO', name: 'Demo Park', slug: 'demo-park' },
      house_types: [{ code: 'A1', name: 'Type A1', bedrooms: 3, bathrooms: 2, floor_area_sqm: 110 }],
      units: [{ unit_number: '1', house_type_code: 'A1', address_line_1: '1 Demo Park' }],
    }, null, 2));
    process.exit(1);
  }

  let config: SeedConfig;
  try {
    config = JSON.parse(readFileSync(seedFile, 'utf-8'));
  } catch (err) {
    console.error(`Failed to read seed file: ${err}`);
    process.exit(1);
  }

  // Check demo guard
  if (config.is_demo && process.env.ALLOW_DEMO_SEED !== 'true') {
    console.error('\n[BLOCKED] Demo seeding is disabled.');
    console.error('Set ALLOW_DEMO_SEED=true to enable demo seeding.');
    process.exit(1);
  }

  console.log(`\nSeed identifier: ${config.seed_identifier}`);
  console.log(`Tenant: ${config.tenant.name} (${config.tenant.slug})`);
  console.log(`Development: ${config.development.name} (${config.development.code})`);
  console.log(`House types: ${config.house_types.length}`);
  console.log(`Units: ${config.units.length}`);

  try {
    console.log('\nCalling transactional creation function...');
    const result = await createDevelopmentTransactional(config);

    if (result.status === 'skipped') {
      console.log('\n[IDEMPOTENT] Seed already completed. No action taken.');
      process.exit(0);
    }

    console.log('\n' + '-'.repeat(60));
    console.log('SUCCESS!');
    console.log('-'.repeat(60));
    console.log(`Status:         ${result.status}`);
    console.log(`Tenant ID:      ${result.tenant_id}`);
    console.log(`Development ID: ${result.development_id}`);
    console.log(`House Types:    ${result.house_types_count}`);
    console.log(`Units:          ${result.units_count}`);
    console.log('='.repeat(60));
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`\n[ERROR] ${error}`);
    console.error('\nSeed failed. The transaction was rolled back - no partial data created.');
    console.error('Check demo_seed_log table for details.');
    process.exit(1);
  }
}

main().catch(console.error);
