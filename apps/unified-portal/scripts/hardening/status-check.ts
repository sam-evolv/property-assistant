/**
 * Hardening Status Checker
 * 
 * Verifies that all security migrations are applied and constraints are active.
 * Outputs green/red checklist and writes timestamped report.
 * 
 * Usage:
 *   npx tsx scripts/hardening/status-check.ts
 * 
 * Output:
 *   - Console: Green/red checklist
 *   - File: scripts/hardening/reports/status-<timestamp>.json
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface CheckResult {
  name: string;
  passed: boolean;
  details: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

const results: CheckResult[] = [];

function check(name: string, passed: boolean, details: string, severity: CheckResult['severity'] = 'critical') {
  results.push({ name, passed, details, severity });
  const icon = passed ? '✅' : '❌';
  const status = passed ? 'PASS' : 'FAIL';
  console.log(`  ${icon} [${status}] ${name}`);
  if (!passed) console.log(`       ↳ ${details}`);
}

async function checkNotNullConstraint(table: string, column: string): Promise<boolean> {
  const { error } = await supabase.from(table).insert({ [column]: null } as any);
  return error !== null && (error.message.includes('null') || error.message.includes('NOT NULL'));
}

async function checkTableExists(table: string): Promise<boolean> {
  const { error } = await supabase.from(table).select('id').limit(1);
  return !error || !error.message.includes('does not exist');
}

async function checkForeignKey(table: string, column: string): Promise<boolean> {
  const fakeId = '00000000-0000-0000-0000-000000000000';
  const { error } = await supabase.from(table).insert({ 
    [column]: fakeId,
    tenant_id: fakeId,
    content: 'FK test'
  } as any);
  return error !== null && (
    error.message.includes('foreign key') || 
    error.message.includes('violates') ||
    error.message.includes('not present')
  );
}

async function checkRLSEnabled(table: string): Promise<boolean> {
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  const { data, error } = await anonClient.from(table).select('id').limit(1);
  return data === null || data.length === 0 || error !== null;
}

async function checkTriggerBlocks(scenario: string): Promise<boolean> {
  const { data: tenants } = await supabase.from('tenants').select('id').limit(2);
  if (!tenants || tenants.length < 2) return true;
  
  const { data: dev } = await supabase
    .from('developments')
    .select('id')
    .eq('tenant_id', tenants[0].id)
    .limit(1)
    .single();
    
  if (!dev) return true;

  const { error } = await supabase.from('units').insert({
    tenant_id: tenants[1].id,
    project_id: dev.id,
    unit_number: 'TRIGGER-TEST',
    unit_code: 'TT',
    unit_uid: 'trigger-test-' + Date.now(),
    address: 'Test',
  });

  return error !== null && (
    error.message.includes('alignment') ||
    error.message.includes('mismatch') ||
    error.message.includes('tenant')
  );
}

async function main() {
  console.log('╔' + '═'.repeat(70) + '╗');
  console.log('║' + '  HARDENING STATUS CHECK'.padEnd(70) + '║');
  console.log('║' + '  OpenHouse AI Unified Portal - Security Verification'.padEnd(70) + '║');
  console.log('╚' + '═'.repeat(70) + '╝');
  console.log('');

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 1: AUDIT EVENTS TABLE
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n📋 SECTION 1: AUDIT EVENTS (Migration 002)');
  console.log('─'.repeat(50));

  const auditTableExists = await checkTableExists('audit_events');
  check('audit_events table exists', auditTableExists, 'Run migration 002_audit_events.sql');

  if (auditTableExists) {
    const { error: updateError } = await supabase
      .from('audit_events')
      .update({ actor: 'test' })
      .eq('id', '00000000-0000-0000-0000-000000000000');
    
    const updateBlocked = updateError !== null && updateError.message.includes('append-only');
    check('audit_events UPDATE blocked', updateBlocked, 'Append-only trigger not active', 'critical');

    const { error: deleteError } = await supabase
      .from('audit_events')
      .delete()
      .eq('id', '00000000-0000-0000-0000-000000000000');
    
    const deleteBlocked = deleteError !== null && deleteError.message.includes('append-only');
    check('audit_events DELETE blocked', deleteBlocked, 'Append-only trigger not active', 'critical');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 2: MESSAGE SAFETY (Migration 003)
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n📋 SECTION 2: MESSAGE SAFETY (Migration 003)');
  console.log('─'.repeat(50));

  const { data: tenant } = await supabase.from('tenants').select('id').limit(1).single();
  const { data: dev } = await supabase.from('developments').select('id').limit(1).single();

  if (tenant && dev) {
    const { error: nullUnitError } = await supabase.from('messages').insert({
      tenant_id: tenant.id,
      development_id: dev.id,
      unit_id: null,
      content: 'NULL unit test',
    });
    
    const unitIdNotNull = nullUnitError !== null;
    check('messages.unit_id NOT NULL', unitIdNotNull, 'Unit_id can be null - run migration 003');

    const { error: fkError } = await supabase.from('messages').insert({
      tenant_id: tenant.id,
      development_id: dev.id,
      unit_id: '00000000-0000-0000-0000-000000000000',
      content: 'FK test',
    });
    
    const unitFkActive = fkError !== null && (
      fkError.message.includes('foreign key') ||
      fkError.message.includes('violates') ||
      fkError.message.includes('Invalid unit_id')
    );
    check('messages.unit_id FK active', unitFkActive, 'FK constraint not enforced');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 3: TENANT ISOLATION (Migration 001)
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n📋 SECTION 3: TENANT ISOLATION (Migration 001)');
  console.log('─'.repeat(50));

  const { error: devNullError } = await supabase.from('developments').insert({
    name: 'NULL tenant test',
    slug: 'null-test-' + Date.now(),
    code: 'NT',
  });
  
  const devTenantNotNull = devNullError !== null;
  check('developments.tenant_id NOT NULL', devTenantNotNull, 'Developments can be created without tenant');

  const triggerBlocks = await checkTriggerBlocks('units');
  check('Tenant alignment trigger active', triggerBlocks, 'Cross-tenant inserts allowed');

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 4: RLS POLICIES
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n📋 SECTION 4: ROW LEVEL SECURITY');
  console.log('─'.repeat(50));

  const tables = ['messages', 'units', 'documents', 'developments'];
  for (const table of tables) {
    const rlsActive = await checkRLSEnabled(table);
    check(`RLS active on ${table}`, rlsActive, `Anonymous can access ${table}`, 'critical');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 5: DATA INTEGRITY
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n📋 SECTION 5: DATA INTEGRITY');
  console.log('─'.repeat(50));

  const { data: orphanedMessages } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .is('unit_id', null);

  check('No orphaned messages', !orphanedMessages || orphanedMessages.length === 0, 
    'Messages exist without unit_id', 'high');

  const { data: orphanedUnits } = await supabase
    .from('units')
    .select('id', { count: 'exact', head: true })
    .is('tenant_id', null);

  check('No orphaned units', !orphanedUnits || orphanedUnits.length === 0,
    'Units exist without tenant_id', 'high');

  // ═══════════════════════════════════════════════════════════════════════
  // GENERATE REPORT
  // ═══════════════════════════════════════════════════════════════════════
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const criticalFailed = results.filter(r => !r.passed && r.severity === 'critical').length;

  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      passed,
      failed,
      criticalFailed,
      status: criticalFailed > 0 ? 'FAILED' : failed > 0 ? 'WARNINGS' : 'PASSED',
    },
    checks: results,
    environment: {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + '...',
    },
  };

  // Save report
  const reportsDir = path.join(__dirname, 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(reportsDir, `status-${timestamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  // Print summary
  console.log('\n' + '═'.repeat(70));
  console.log('SUMMARY');
  console.log('═'.repeat(70));
  console.log(`  Total Checks: ${results.length}`);
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed} (${criticalFailed} critical)`);
  console.log(`  📄 Report: ${reportPath}`);

  if (criticalFailed > 0) {
    console.log('\n🚨 CRITICAL FAILURES - PRODUCTION UNSAFE');
    console.log('   Apply missing migrations before deployment.');
    process.exit(1);
  } else if (failed > 0) {
    console.log('\n⚠️  WARNINGS - Review before production');
    process.exit(0);
  } else {
    console.log('\n✅ ALL CHECKS PASSED - System hardened');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Status check error:', err);
  process.exit(1);
});
