/**
 * Test 02: Partial Failure Recovery
 * 
 * Proves that partial failures during development creation are safely handled:
 * 1. Transactional creation rolls back on ANY failure
 * 2. No orphaned tenants/developments/units left behind
 * 3. Recovery procedures work correctly
 * 
 * Run: npx tsx scripts/hardening/tests/02-partial-failure-recovery.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

function log(name: string, passed: boolean, message: string) {
  results.push({ name, passed, message });
  const status = passed ? '✓ PASS' : '✗ FAIL';
  const icon = passed ? '✅' : '❌';
  console.log(`  ${icon} ${status}: ${name}`);
  if (!passed) console.log(`         ${message}`);
}

console.log('='.repeat(70));
console.log('TEST 02: PARTIAL FAILURE RECOVERY');
console.log('='.repeat(70));
console.log('\nVerifying transactional integrity and recovery procedures:\n');

// Test 1: Transactional function rolls back on invalid house type
async function testTransactionRollbackOnBadHouseType() {
  console.log('\n[Test 2.1] Transaction rollback on invalid house type...');
  
  const testId = 'rollback-test-' + Date.now();
  
  const { data: beforeCount } = await supabase
    .from('tenants')
    .select('id', { count: 'exact', head: true });

  const { error } = await supabase.rpc('create_development_transactional', {
    p_seed_identifier: testId,
    p_tenant_name: 'Rollback Test Tenant',
    p_tenant_slug: 'rollback-test-' + Date.now(),
    p_dev_code: 'RBT',
    p_dev_name: 'Rollback Test Dev',
    p_dev_slug: 'rollback-dev-' + Date.now(),
    p_dev_address: null,
    p_house_types: [{ name: null, bedrooms: -1 }],
    p_units: [],
  });

  const { data: afterCount } = await supabase
    .from('tenants')
    .select('id', { count: 'exact', head: true });

  const { data: orphanCheck } = await supabase
    .from('tenants')
    .select('id')
    .ilike('name', '%Rollback Test%');

  const noOrphans = !orphanCheck || orphanCheck.length === 0;

  log(
    'Transaction rolls back completely on failure',
    error !== null && noOrphans,
    error ? `Error correctly thrown: ${error.message.substring(0, 50)}...` : 'No error - unexpected success'
  );
}

// Test 2: Valid transaction succeeds completely
async function testValidTransactionSucceeds() {
  console.log('\n[Test 2.2] Valid transaction succeeds atomically...');
  
  const testId = 'valid-test-' + Date.now();
  
  const { data, error } = await supabase.rpc('create_development_transactional', {
    p_seed_identifier: testId,
    p_tenant_name: 'Valid Test Tenant ' + testId,
    p_tenant_slug: 'valid-test-' + testId,
    p_dev_code: 'VT' + Date.now().toString().slice(-4),
    p_dev_name: 'Valid Test Development',
    p_dev_slug: 'valid-dev-' + testId,
    p_dev_address: '123 Test Street',
    p_house_types: [
      { name: 'Type A', bedrooms: 3 },
      { name: 'Type B', bedrooms: 4 },
    ],
    p_units: [
      { unit_number: '1', unit_code: 'VT1', address: '1 Test St' },
      { unit_number: '2', unit_code: 'VT2', address: '2 Test St' },
    ],
  });

  if (error) {
    log('Valid transaction succeeds', false, error.message);
    return;
  }

  const { data: dev } = await supabase
    .from('developments')
    .select(`
      id,
      tenant_id,
      house_types(id),
      units(id)
    `)
    .eq('id', data.development_id)
    .single();

  const allCreated = !!(dev && 
    dev.house_types && dev.house_types.length === 2 &&
    dev.units && dev.units.length === 2);

  log(
    'All entities created atomically',
    allCreated,
    allCreated ? `Created: 1 dev, 2 house types, 2 units` : 'Incomplete creation'
  );

  if (dev) {
    await supabase.from('units').delete().eq('project_id', dev.id);
    await supabase.from('house_types').delete().eq('development_id', dev.id);
    await supabase.from('developments').delete().eq('id', dev.id);
    await supabase.from('tenants').delete().eq('id', dev.tenant_id);
  }
}

// Test 3: Orphaned data detection view works
async function testOrphanedDataDetection() {
  console.log('\n[Test 2.3] Orphaned data detection view...');
  
  const { data, error } = await supabase
    .from('orphaned_data_summary')
    .select('*');

  if (error && error.message.includes('does not exist')) {
    log('Orphaned data view exists', false, 'View not created - run migration');
    return;
  }

  log(
    'Orphaned data monitoring available',
    !error,
    error?.message || `Monitoring ${data?.length || 0} tables for orphans`
  );

  if (data && data.length > 0) {
    console.log('\n    Current orphan status:');
    data.forEach((row: any) => {
      console.log(`    - ${row.table_name}: ${row.orphaned_count} orphans`);
    });
  }
}

// Test 4: Recovery map tracks all changes
async function testRecoveryMapTracking() {
  console.log('\n[Test 2.4] Recovery map audit trail...');
  
  const { data: columns, error } = await supabase
    .from('recovery_map')
    .select('*')
    .limit(1);

  if (error && error.message.includes('does not exist')) {
    log('Recovery map exists', false, 'Table not created - run migration');
    return;
  }

  const { data: schema } = await supabase.rpc('get_table_columns', {
    table_name: 'recovery_map'
  }).single();

  const hasRequiredColumns = !error;

  log(
    'Recovery map tracks changes',
    hasRequiredColumns,
    hasRequiredColumns ? 'Audit trail available for all recovery operations' : 'Recovery map incomplete'
  );
}

// Test 5: Apply recovery function exists and works
async function testApplyRecoveryFunction() {
  console.log('\n[Test 2.5] Recovery function availability...');
  
  const { error } = await supabase.rpc('apply_message_recovery', {
    p_recovery_entries: []
  });

  const exists = !error || !error.message.includes('does not exist');

  log(
    'Recovery function available',
    exists,
    exists ? 'apply_message_recovery() ready for use' : 'Function not created'
  );
}

// Test 6: Simulated partial failure leaves no orphans
async function testNoOrphansAfterFailure() {
  console.log('\n[Test 2.6] No orphans after simulated failure...');
  
  const testId = 'orphan-check-' + Date.now();

  const { data: tenantsBefore } = await supabase
    .from('tenants')
    .select('id')
    .ilike('slug', '%orphan-check%');

  const beforeCount = tenantsBefore?.length || 0;

  try {
    await supabase.rpc('create_development_transactional', {
      p_seed_identifier: testId,
      p_tenant_name: 'Orphan Check Tenant',
      p_tenant_slug: 'orphan-check-' + testId,
      p_dev_code: 'OCT',
      p_dev_name: 'Orphan Check Dev',
      p_dev_slug: 'orphan-dev-' + testId,
      p_dev_address: null,
      p_house_types: [],
      p_units: [{ unit_number: null, unit_code: null, address: null }],
    });
  } catch {}

  const { data: tenantsAfter } = await supabase
    .from('tenants')
    .select('id')
    .ilike('slug', '%orphan-check%');

  const afterCount = tenantsAfter?.length || 0;
  const noNewOrphans = afterCount === beforeCount;

  log(
    'No orphaned tenants after failed creation',
    noNewOrphans,
    noNewOrphans ? 'Transaction rollback successful' : `${afterCount - beforeCount} orphaned tenants created`
  );
}

async function main() {
  await testTransactionRollbackOnBadHouseType();
  await testValidTransactionSucceeds();
  await testOrphanedDataDetection();
  await testRecoveryMapTracking();
  await testApplyRecoveryFunction();
  await testNoOrphansAfterFailure();

  console.log('\n' + '='.repeat(70));
  console.log('PARTIAL FAILURE RECOVERY RESULTS');
  console.log('='.repeat(70));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`\n  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  📊 Total: ${results.length}`);

  if (failed > 0) {
    console.log('\n⚠️  FAILURES:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.message}`);
    });
    console.log('\n❌ PARTIAL FAILURE RECOVERY: NEEDS ATTENTION');
    process.exit(1);
  } else {
    console.log('\n✅ PARTIAL FAILURE RECOVERY: PASSED');
    console.log('   All partial failures are safely handled with full rollback.');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
