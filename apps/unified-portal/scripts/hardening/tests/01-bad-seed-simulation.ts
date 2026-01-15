/**
 * Test 01: Bad Seed Script Simulation
 * 
 * Proves that bad seed scripts CANNOT corrupt the database because:
 * 1. NOT NULL constraints prevent orphaned data
 * 2. FK constraints prevent invalid references
 * 3. Tenant alignment triggers prevent cross-tenant contamination
 * 
 * Run: npx tsx scripts/hardening/tests/01-bad-seed-simulation.ts
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
  severity: 'critical' | 'high' | 'medium';
}

const results: TestResult[] = [];

function log(name: string, passed: boolean, message: string, severity: 'critical' | 'high' | 'medium' = 'critical') {
  results.push({ name, passed, message, severity });
  const status = passed ? '✓ BLOCKED' : '✗ ALLOWED (VULNERABILITY!)';
  const icon = passed ? '🛡️' : '🚨';
  console.log(`  ${icon} ${status}: ${name}`);
  if (!passed) console.log(`         SECURITY BREACH: ${message}`);
}

console.log('='.repeat(70));
console.log('TEST 01: BAD SEED SCRIPT SIMULATION');
console.log('='.repeat(70));
console.log('\nSimulating common seed script mistakes that MUST be blocked:\n');

// Scenario 1: Seed script forgets to set tenant_id on messages
async function testSeedWithoutTenantId() {
  console.log('\n[Scenario 1.1] Seed script creates message without tenant_id...');
  
  const { error } = await supabase
    .from('messages')
    .insert({
      content: 'Bad seed - no tenant',
      sender_type: 'system',
    });

  const blocked = error !== null && 
    (error.message.includes('null') || 
     error.message.includes('tenant') ||
     error.message.includes('NOT NULL'));

  log(
    'Message without tenant_id',
    blocked,
    error?.message || 'INSERT SUCCEEDED - DATA CORRUPTION POSSIBLE',
    'critical'
  );
}

// Scenario 2: Seed script creates unit without tenant_id
async function testUnitWithoutTenantId() {
  console.log('\n[Scenario 1.2] Seed script creates unit without tenant_id...');
  
  const { error } = await supabase
    .from('units')
    .insert({
      unit_number: 'BAD-001',
      unit_code: 'BAD',
      unit_uid: 'bad-seed-' + Date.now(),
      address: 'Test',
    });

  const blocked = error !== null;

  log(
    'Unit without tenant_id',
    blocked,
    error?.message || 'INSERT SUCCEEDED - ORPHANED UNIT CREATED',
    'critical'
  );
}

// Scenario 3: Seed script references non-existent tenant
async function testInvalidTenantReference() {
  console.log('\n[Scenario 1.3] Seed script references non-existent tenant...');
  
  const fakeTenantId = '00000000-0000-0000-0000-000000000000';
  
  const { error } = await supabase
    .from('messages')
    .insert({
      tenant_id: fakeTenantId,
      content: 'Bad seed - fake tenant',
      sender_type: 'system',
    });

  const blocked = error !== null && 
    (error.message.includes('foreign key') || 
     error.message.includes('violates') ||
     error.message.includes('not present'));

  log(
    'Message with non-existent tenant_id',
    blocked,
    error?.message || 'INSERT SUCCEEDED - ORPHANED MESSAGE CREATED',
    'critical'
  );
}

// Scenario 4: Seed script creates unit with wrong tenant for development
async function testUnitWithWrongTenant() {
  console.log('\n[Scenario 1.4] Seed script assigns unit to wrong tenant...');
  
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id')
    .limit(2);

  if (!tenants || tenants.length < 2) {
    log('Unit with wrong tenant', false, 'Need 2 tenants to test', 'critical');
    return;
  }

  const { data: devA } = await supabase
    .from('developments')
    .select('id, tenant_id')
    .eq('tenant_id', tenants[0].id)
    .limit(1)
    .single();

  if (!devA) {
    log('Unit with wrong tenant', false, 'No development found', 'critical');
    return;
  }

  const { error } = await supabase
    .from('units')
    .insert({
      tenant_id: tenants[1].id,
      project_id: devA.id,
      unit_number: 'WRONG-TENANT',
      unit_code: 'WT',
      unit_uid: 'wrong-tenant-' + Date.now(),
      address: 'Test',
    });

  const blocked = error !== null && 
    (error.message.includes('alignment') || 
     error.message.includes('mismatch') ||
     error.message.includes('tenant'));

  log(
    'Unit assigned to wrong tenant',
    blocked,
    error?.message || 'INSERT SUCCEEDED - CROSS-TENANT CONTAMINATION',
    'critical'
  );
}

// Scenario 5: Seed script creates development without tenant
async function testDevelopmentWithoutTenant() {
  console.log('\n[Scenario 1.5] Seed script creates development without tenant...');
  
  const { error } = await supabase
    .from('developments')
    .insert({
      name: 'Orphan Development',
      slug: 'orphan-dev-' + Date.now(),
      code: 'ORPHAN',
    });

  const blocked = error !== null;

  log(
    'Development without tenant_id',
    blocked,
    error?.message || 'INSERT SUCCEEDED - ORPHANED DEVELOPMENT CREATED',
    'critical'
  );
}

// Scenario 6: Seed script creates house_type for wrong tenant's development
async function testHouseTypeWrongTenant() {
  console.log('\n[Scenario 1.6] Seed script creates house_type for wrong tenant...');
  
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id')
    .limit(2);

  if (!tenants || tenants.length < 2) {
    log('House type wrong tenant', false, 'Need 2 tenants to test', 'critical');
    return;
  }

  const { data: devA } = await supabase
    .from('developments')
    .select('id, tenant_id')
    .eq('tenant_id', tenants[0].id)
    .limit(1)
    .single();

  if (!devA) {
    log('House type wrong tenant', false, 'No development found', 'critical');
    return;
  }

  const { error } = await supabase
    .from('house_types')
    .insert({
      tenant_id: tenants[1].id,
      development_id: devA.id,
      name: 'Wrong Tenant House',
      bedrooms: 3,
    });

  const blocked = error !== null && 
    (error.message.includes('alignment') || 
     error.message.includes('mismatch') ||
     error.message.includes('tenant'));

  log(
    'House type for wrong tenant development',
    blocked,
    error?.message || 'INSERT SUCCEEDED - CROSS-TENANT CONTAMINATION',
    'critical'
  );
}

async function main() {
  await testSeedWithoutTenantId();
  await testUnitWithoutTenantId();
  await testInvalidTenantReference();
  await testUnitWithWrongTenant();
  await testDevelopmentWithoutTenant();
  await testHouseTypeWrongTenant();

  console.log('\n' + '='.repeat(70));
  console.log('BAD SEED SIMULATION RESULTS');
  console.log('='.repeat(70));

  const blocked = results.filter(r => r.passed).length;
  const vulnerabilities = results.filter(r => !r.passed).length;

  console.log(`\n  🛡️ Attacks Blocked: ${blocked}`);
  console.log(`  🚨 Vulnerabilities: ${vulnerabilities}`);
  console.log(`  📊 Total Tests: ${results.length}`);

  if (vulnerabilities > 0) {
    console.log('\n⚠️  SECURITY FAILURES DETECTED:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  [${r.severity.toUpperCase()}] ${r.name}`);
      console.log(`    ${r.message}`);
    });
    console.log('\n❌ BAD SEED PROTECTION: FAILED');
    process.exit(1);
  } else {
    console.log('\n✅ BAD SEED PROTECTION: PASSED');
    console.log('   All seed script mistakes are blocked by database constraints.');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
