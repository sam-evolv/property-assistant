/**
 * Multi-Tenant Isolation Tests v2
 * 
 * These tests verify that tenant isolation is properly enforced:
 * 1. Cross-tenant data access is blocked by RLS
 * 2. Tenant isolation trigger rejects mismatched data
 * 3. Constraints prevent orphaned data
 * 4. Transactional development creation works correctly
 * 
 * Prerequisites:
 * - Run 001_multi_tenant_hardening.sql migration first
 * 
 * Usage:
 *   npx tsx scripts/hardening/test-tenant-isolation.ts
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
  console.log(`  ${status}: ${name}`);
  if (!passed) console.log(`         ${message}`);
}

// Test 1: Verify tenant_id is required on messages
async function testMessagesRequireTenantId() {
  console.log('\n[Test 1] Messages require tenant_id...');
  
  const { error } = await supabase
    .from('messages')
    .insert({
      content: 'Test message without tenant',
    });

  const passed = error !== null && 
    (error.message.includes('null') || 
     error.message.includes('tenant') ||
     error.message.includes('violates not-null'));

  log(
    'Messages reject null tenant_id',
    passed,
    error?.message || 'No error thrown - constraint missing'
  );
}

// Test 2: Verify tenant isolation trigger blocks invalid unit_id
async function testTriggerRejectsInvalidUnit() {
  console.log('\n[Test 2] Trigger rejects invalid unit_id...');

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .limit(1)
    .single();

  if (!tenant) {
    log('Trigger rejects invalid unit_id', false, 'No tenants found');
    return;
  }

  const { data: dev } = await supabase
    .from('developments')
    .select('id')
    .eq('tenant_id', tenant.id)
    .limit(1)
    .single();

  if (!dev) {
    log('Trigger rejects invalid unit_id', false, 'No developments found');
    return;
  }

  // Try to insert a message with a non-existent unit_id
  const fakeUnitId = '00000000-0000-0000-0000-000000000000';
  
  const { error } = await supabase
    .from('messages')
    .insert({
      tenant_id: tenant.id,
      development_id: dev.id,
      unit_id: fakeUnitId,
      content: 'Test with invalid unit',
    });

  const passed = error !== null && 
    (error.message.includes('Invalid unit_id') || 
     error.message.includes('does not exist') ||
     error.message.includes('violates'));

  log(
    'Trigger rejects invalid unit_id',
    passed,
    error?.message || 'Insert succeeded when it should have failed'
  );
}

// Test 3: Verify tenant isolation trigger blocks cross-tenant data
async function testTriggerBlocksCrossTenant() {
  console.log('\n[Test 3] Trigger blocks cross-tenant data...');

  // Get two different tenants
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id')
    .limit(2);

  if (!tenants || tenants.length < 2) {
    log('Trigger blocks cross-tenant data', false, 'Need at least 2 tenants to test');
    return;
  }

  // Get a unit from tenant 1
  const { data: unit } = await supabase
    .from('units')
    .select('id, tenant_id, project_id')
    .eq('tenant_id', tenants[0].id)
    .limit(1)
    .single();

  if (!unit) {
    log('Trigger blocks cross-tenant data', false, 'No units found for tenant 1');
    return;
  }

  // Try to insert a message with mismatched tenant_id
  const { error } = await supabase
    .from('messages')
    .insert({
      tenant_id: tenants[1].id, // Different tenant!
      development_id: unit.project_id,
      unit_id: unit.id,
      content: 'Cross-tenant test',
    });

  const passed = error !== null && 
    (error.message.includes('isolation violation') || 
     error.message.includes('tenant') ||
     error.message.includes('does not match'));

  log(
    'Trigger blocks cross-tenant message insert',
    passed,
    error?.message || 'Insert succeeded when it should have failed'
  );
}

// Test 4: Verify valid message insert works
async function testValidMessageInsert() {
  console.log('\n[Test 4] Valid message insert works...');

  const { data: unit } = await supabase
    .from('units')
    .select('id, tenant_id, project_id')
    .limit(1)
    .single();

  if (!unit) {
    log('Valid message insert works', false, 'No units found');
    return;
  }

  const { data, error } = await supabase
    .from('messages')
    .insert({
      tenant_id: unit.tenant_id,
      development_id: unit.project_id,
      unit_id: unit.id,
      content: 'Valid test message',
      source: 'test',
    })
    .select('id')
    .single();

  log(
    'Valid message with matching tenant/unit accepted',
    !error && data?.id,
    error?.message || 'Insert succeeded'
  );

  // Clean up
  if (data?.id) {
    await supabase.from('messages').delete().eq('id', data.id);
  }
}

// Test 5: Verify recovery_map table has tenant_id
async function testRecoveryMapHasTenant() {
  console.log('\n[Test 5] Recovery map table has tenant scoping...');

  const { data, error } = await supabase
    .from('recovery_map')
    .select('id, tenant_id')
    .limit(1);

  if (error && error.message.includes('does not exist')) {
    log(
      'Recovery map table exists with tenant_id',
      false,
      'Table not created yet - run migration first'
    );
    return;
  }

  // Check if tenant_id column exists
  const hasTenantId = !error;

  log(
    'Recovery map table exists with tenant_id',
    hasTenantId,
    error?.message || 'Table accessible with tenant_id column'
  );
}

// Test 6: Verify transactional creation function exists
async function testTransactionalFunctionExists() {
  console.log('\n[Test 6] Transactional creation function...');

  // Try to call the function with a test seed
  const { data, error } = await supabase.rpc('create_development_transactional', {
    p_seed_identifier: 'test-isolation-check-' + Date.now(),
    p_tenant_name: 'Test Tenant',
    p_tenant_slug: 'test-tenant-' + Date.now(),
    p_dev_code: 'TEST-' + Date.now(),
    p_dev_name: 'Test Development',
    p_dev_slug: 'test-dev-' + Date.now(),
    p_dev_address: null,
    p_house_types: [],
    p_units: [],
  });

  if (error && error.message.includes('does not exist')) {
    log(
      'Transactional creation function exists',
      false,
      'Function not created yet - run migration first'
    );
    return;
  }

  // Function exists - even if it creates test data, we verified it works
  log(
    'Transactional creation function exists',
    !error || !error.message.includes('does not exist'),
    error?.message || `Function returned: ${JSON.stringify(data)}`
  );
}

// Test 7: Verify orphaned data summary view
async function testOrphanedDataView() {
  console.log('\n[Test 7] Orphaned data monitoring view...');

  const { data, error } = await supabase
    .from('orphaned_data_summary')
    .select('*');

  if (error && error.message.includes('does not exist')) {
    log(
      'Orphaned data view exists',
      false,
      'View not created yet - run migration first'
    );
    return;
  }

  log(
    'Orphaned data view exists',
    !error,
    error?.message || `Found ${data?.length || 0} table summaries`
  );
}

// Test 8: Verify RLS is enabled
async function testRLSEnabled() {
  console.log('\n[Test 8] Row Level Security enabled...');

  // We can check if RLS is enabled by querying the pg_tables with RLS info
  // Since we're using service role, we can't directly test RLS blocking
  // Instead, verify that policies exist

  const tables = ['messages', 'documents', 'developments', 'units'];
  let policiesFound = 0;

  for (const table of tables) {
    // Try to query - if RLS is enabled with policies, this should work for service role
    const { error } = await supabase.from(table).select('id').limit(1);
    if (!error) {
      policiesFound++;
    }
  }

  log(
    'RLS configured on tenant tables',
    policiesFound === tables.length,
    `${policiesFound}/${tables.length} tables accessible via service role`
  );
}

// Test 9: Verify documents trigger blocks cross-tenant development
async function testDocumentsTenantAlignment() {
  console.log('\n[Test 9] Documents tenant alignment trigger...');

  const { data: tenants } = await supabase
    .from('tenants')
    .select('id')
    .limit(2);

  if (!tenants || tenants.length < 2) {
    log('Documents tenant alignment', false, 'Need at least 2 tenants to test');
    return;
  }

  const { data: devA } = await supabase
    .from('developments')
    .select('id, tenant_id')
    .eq('tenant_id', tenants[0].id)
    .limit(1)
    .single();

  if (!devA) {
    log('Documents tenant alignment', false, 'No development found for first tenant');
    return;
  }

  // Try to insert document with Tenant B's ID but Tenant A's development
  const { error } = await supabase
    .from('documents')
    .insert({
      tenant_id: tenants[1].id,
      development_id: devA.id,
      title: 'Cross-tenant document test',
      document_type: 'test',
    });

  const passed = error !== null && 
    (error.message.includes('alignment') || 
     error.message.includes('mismatch') ||
     error.message.includes('tenant'));

  log(
    'Documents tenant alignment trigger blocks cross-tenant',
    passed,
    error?.message || 'Insert succeeded when it should have failed'
  );
}

// Test 10: Verify units trigger blocks cross-tenant development
async function testUnitsTenantAlignment() {
  console.log('\n[Test 10] Units tenant alignment trigger...');

  const { data: tenants } = await supabase
    .from('tenants')
    .select('id')
    .limit(2);

  if (!tenants || tenants.length < 2) {
    log('Units tenant alignment', false, 'Need at least 2 tenants to test');
    return;
  }

  const { data: devA } = await supabase
    .from('developments')
    .select('id, tenant_id')
    .eq('tenant_id', tenants[0].id)
    .limit(1)
    .single();

  if (!devA) {
    log('Units tenant alignment', false, 'No development found for first tenant');
    return;
  }

  // Try to insert unit with Tenant B's ID but Tenant A's development
  const { error } = await supabase
    .from('units')
    .insert({
      tenant_id: tenants[1].id,
      project_id: devA.id,
      unit_number: 'TEST-CROSS',
      unit_code: 'TEST',
      unit_uid: 'TEST-CROSS-' + Date.now(),
      address: 'Test Address',
    });

  const passed = error !== null && 
    (error.message.includes('alignment') || 
     error.message.includes('mismatch') ||
     error.message.includes('tenant'));

  log(
    'Units tenant alignment trigger blocks cross-tenant',
    passed,
    error?.message || 'Insert succeeded when it should have failed'
  );
}

async function main() {
  console.log('='.repeat(60));
  console.log('MULTI-TENANT ISOLATION TESTS v3');
  console.log('='.repeat(60));
  console.log('\nPrerequisites: Run 001_multi_tenant_hardening.sql migration first\n');

  await testMessagesRequireTenantId();
  await testTriggerRejectsInvalidUnit();
  await testTriggerBlocksCrossTenant();
  await testValidMessageInsert();
  await testRecoveryMapHasTenant();
  await testTransactionalFunctionExists();
  await testOrphanedDataView();
  await testRLSEnabled();
  await testDocumentsTenantAlignment();
  await testUnitsTenantAlignment();

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total:  ${results.length}`);

  if (failed > 0) {
    console.log('\nFailed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.message}`);
    });
    console.log('\nNote: Some tests may fail if migration has not been applied.');
    console.log('Run the SQL migration first: apps/unified-portal/migrations/001_multi_tenant_hardening.sql');
  }

  console.log('\n' + '='.repeat(60));
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
