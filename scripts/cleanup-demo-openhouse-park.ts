/**
 * CLEANUP SCRIPT - Remove Demo Open House Park Data
 *
 * This script safely removes the demo tenant and ALL related data.
 * It uses CASCADE deletion - removing the tenant removes all child records.
 *
 * TO RUN: npx tsx scripts/cleanup-demo-openhouse-park.ts
 */

import { createClient } from '@supabase/supabase-js';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Demo tenant ID from the seed script
const DEMO_TENANT_ID = 'aaaaaaaa-demo-4000-demo-openhousepark1';

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  CLEANUP - Removing Demo Open House Park Data');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  // Check if demo tenant exists
  const { data: tenant, error: checkError } = await supabase
    .from('tenants')
    .select('id, name')
    .eq('id', DEMO_TENANT_ID)
    .single();

  if (checkError || !tenant) {
    console.log('ℹ️  Demo tenant not found - nothing to clean up.');
    return;
  }

  console.log(`Found demo tenant: ${tenant.name} (${tenant.id})`);
  console.log('');
  console.log('Deleting related data...');

  // Delete in order of dependencies (children first)
  const tables = [
    'noticeboard_posts',
    'faq_entries',
    'unit_room_dimensions',
    'units',
    'house_types',
    'developments',
    'tenants',
  ];

  for (const table of tables) {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq(table === 'tenants' ? 'id' : 'tenant_id', DEMO_TENANT_ID);

    if (error) {
      console.log(`  ⚠️  ${table}: ${error.message}`);
    } else {
      console.log(`  ✅ ${table}: cleaned`);
    }
  }

  console.log('');
  console.log('✅ Demo data cleanup complete!');
  console.log('');
}

main();
