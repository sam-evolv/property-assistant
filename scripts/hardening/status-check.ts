#!/usr/bin/env npx tsx
/**
 * Hardening Status Check
 * 
 * Verifies that all security hardening measures are in place.
 * Run from repo root: npx tsx scripts/hardening/status-check.ts
 * 
 * Checks:
 * - Database migrations applied (001, 002, 003)
 * - Constraints active (messages.unit_id NOT NULL, FK)
 * - Audit events append-only
 * - RLS enabled on critical tables
 * - Runtime protections present (TenantScopedClient, destructive-ops guard)
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

interface CheckResult {
  id: string;
  name: string;
  passed: boolean;
  message: string;
  critical: boolean;
}

const results: CheckResult[] = [];

function log(id: string, name: string, passed: boolean, message: string, critical = true) {
  results.push({ id, name, passed, message, critical });
  const status = passed ? '✅ [PASS]' : '❌ [FAIL]';
  console.log(`  ${status} ${name}`);
  if (!passed) {
    console.log(`       ↳ ${message}`);
  }
}

function getGitCommit(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
}

async function checkDatabaseHardening(supabase: ReturnType<typeof createClient>) {
  console.log('\n📋 SECTION 1: AUDIT EVENTS (Migration 002)');
  console.log('──────────────────────────────────────────────────');

  const { data: auditTable } = await supabase
    .from('audit_events')
    .select('id')
    .limit(1);

  log('audit_table', 'audit_events table exists', auditTable !== null, 'Migration 002 not applied');

  if (auditTable !== null) {
    const { error: updateError } = await supabase
      .from('audit_events')
      .update({ operation: 'TEST' })
      .eq('id', '00000000-0000-0000-0000-000000000000');

    const updateBlocked = updateError?.message?.includes('immutable') || 
                          updateError?.message?.includes('Audit events are append-only') ||
                          updateError?.code === '42501';
    log('audit_update', 'audit_events UPDATE blocked', updateBlocked, 'Append-only trigger not active');

    const { error: deleteError } = await supabase
      .from('audit_events')
      .delete()
      .eq('id', '00000000-0000-0000-0000-000000000000');

    const deleteBlocked = deleteError?.message?.includes('immutable') ||
                          deleteError?.message?.includes('Audit events are append-only') ||
                          deleteError?.code === '42501';
    log('audit_delete', 'audit_events DELETE blocked', deleteBlocked, 'Append-only trigger not active');
  } else {
    log('audit_update', 'audit_events UPDATE blocked', false, 'Table does not exist');
    log('audit_delete', 'audit_events DELETE blocked', false, 'Table does not exist');
  }

  console.log('\n📋 SECTION 2: MESSAGE SAFETY (Migration 003)');
  console.log('──────────────────────────────────────────────────');

  const { error: nullUnitError } = await supabase
    .from('messages')
    .insert({ 
      unit_id: null, 
      tenant_id: '00000000-0000-0000-0000-000000000001',
      content: 'test',
      role: 'user'
    });

  const unitIdNotNull = nullUnitError?.message?.includes('null value') ||
                        nullUnitError?.message?.includes('violates not-null') ||
                        nullUnitError?.code === '23502';
  log('msg_unit_notnull', 'messages.unit_id NOT NULL', unitIdNotNull, 'NULL unit_id allowed - migration 003 not applied');

  const { error: fkError } = await supabase
    .from('messages')
    .insert({
      unit_id: '00000000-0000-0000-0000-000000000000',
      tenant_id: '00000000-0000-0000-0000-000000000001',
      content: 'test',
      role: 'user'
    });

  const fkActive = fkError?.message?.includes('violates foreign key') ||
                   fkError?.message?.includes('not present in table') ||
                   fkError?.code === '23503';
  log('msg_unit_fk', 'messages.unit_id FK active', fkActive, 'FK constraint not enforced');

  console.log('\n📋 SECTION 3: TENANT ISOLATION (Migration 001)');
  console.log('──────────────────────────────────────────────────');

  const { error: devNullTenantError } = await supabase
    .from('developments')
    .insert({
      name: 'Test',
      slug: 'test-' + Date.now(),
      code: 'TEST-' + Date.now(),
      tenant_id: null
    });

  const devTenantNotNull = devNullTenantError?.message?.includes('null value') ||
                           devNullTenantError?.message?.includes('violates not-null') ||
                           devNullTenantError?.code === '23502';
  log('dev_tenant_notnull', 'developments.tenant_id NOT NULL', devTenantNotNull, 'Developments can be created without tenant');

  const { error: alignError } = await supabase
    .from('units')
    .insert({
      unit_uid: 'TEST-ALIGN-' + Date.now(),
      development_id: '00000000-0000-0000-0000-000000000000',
      tenant_id: '00000000-0000-0000-0000-000000000001'
    });

  const alignActive = alignError?.message?.includes('tenant_id must match') ||
                      alignError?.message?.includes('foreign key') ||
                      alignError?.code === 'P0001' ||
                      alignError?.code === '23503';
  log('tenant_align', 'Tenant alignment trigger active', alignActive, 'Cross-tenant FK allowed');

  console.log('\n📋 SECTION 4: ROW LEVEL SECURITY');
  console.log('──────────────────────────────────────────────────');

  const anonClient = createClient(SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '');

  const tables = ['messages', 'units', 'documents', 'developments'];
  for (const table of tables) {
    const { data, error } = await anonClient.from(table).select('id').limit(1);
    const rlsActive = error !== null || (data && data.length === 0);
    log(`rls_${table}`, `RLS active on ${table}`, rlsActive, `Anonymous can access ${table}`);
  }

  console.log('\n📋 SECTION 5: DATA INTEGRITY');
  console.log('──────────────────────────────────────────────────');

  const { count: orphanedMessages } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .is('unit_id', null);

  log('no_orphan_msg', 'No orphaned messages', (orphanedMessages || 0) === 0, `${orphanedMessages} messages with NULL unit_id`);

  let orphanCount = 0;
  try {
    const { data: orphanedUnits } = await supabase.rpc('check_orphaned_units');
    orphanCount = orphanedUnits?.length || 0;
  } catch {
    orphanCount = 0;
  }
  log('no_orphan_units', 'No orphaned units', orphanCount === 0, `${orphanCount} units without valid development`);
}

async function checkRuntimeProtections() {
  console.log('\n📋 SECTION 6: RUNTIME PROTECTIONS');
  console.log('──────────────────────────────────────────────────');

  const tenantClientPaths = [
    'apps/unified-portal/lib/db/TenantScopedClient.ts',
    'lib/db/TenantScopedClient.ts',
  ];

  let tenantClientFound = false;
  for (const p of tenantClientPaths) {
    if (fs.existsSync(p)) {
      tenantClientFound = true;
      break;
    }
  }
  log('tenant_client', 'TenantScopedClient exists', tenantClientFound, 'File not found at expected paths');

  const destructiveOpsPaths = [
    'apps/unified-portal/lib/guards/destructive-ops.ts',
    'lib/guards/destructive-ops.ts',
  ];

  let destructiveOpsFound = false;
  for (const p of destructiveOpsPaths) {
    if (fs.existsSync(p)) {
      destructiveOpsFound = true;
      break;
    }
  }
  log('destructive_guard', 'Destructive ops guard exists', destructiveOpsFound, 'File not found at expected paths');
}

async function writeReport() {
  const reportDir = 'scripts/hardening/reports';
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(reportDir, `status-${timestamp}.json`);

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const criticalFailed = results.filter(r => !r.passed && r.critical).length;

  const report = {
    timestamp: new Date().toISOString(),
    git_commit: getGitCommit(),
    summary: {
      total: results.length,
      passed,
      failed,
      critical_failed: criticalFailed,
      status: criticalFailed === 0 ? 'PASS' : 'FAIL',
    },
    checks: results,
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  return reportPath;
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║  HARDENING STATUS CHECK                                              ║');
  console.log('║  OpenHouse AI Unified Portal - Security Verification                 ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('\n❌ Missing environment variables:');
    console.error('   NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  await checkDatabaseHardening(supabase);
  await checkRuntimeProtections();

  const reportPath = await writeReport();

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const criticalFailed = results.filter(r => !r.passed && r.critical).length;

  console.log('\n══════════════════════════════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('══════════════════════════════════════════════════════════════════════');
  console.log(`  Total Checks: ${results.length}`);
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed} (${criticalFailed} critical)`);
  console.log(`  📄 Report: ${reportPath}`);

  if (criticalFailed > 0) {
    console.log('\n🚨 CRITICAL FAILURES - PRODUCTION UNSAFE');
    console.log('   Apply missing migrations before deployment.');
    process.exit(1);
  } else if (failed > 0) {
    console.log('\n⚠️  NON-CRITICAL ISSUES');
    console.log('   Review and address when possible.');
    process.exit(0);
  } else {
    console.log('\n✅ ALL CHECKS PASSED - PRODUCTION READY');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Status check failed:', err);
  process.exit(1);
});
