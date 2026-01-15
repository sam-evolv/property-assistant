#!/usr/bin/env npx tsx
/**
 * Hardening Status Check
 * 
 * Verifies that all security hardening measures are in place.
 * Run from repo root: npx tsx scripts/hardening/status-check.ts
 */

import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const DATABASE_URL = process.env.DATABASE_URL;

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

async function checkDatabaseHardening(client: Client) {
  console.log('\n📋 SECTION 1: AUDIT EVENTS (Migration 002)');
  console.log('──────────────────────────────────────────────────');

  // Check audit_events table exists
  const auditTableResult = await client.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'audit_events'
    ) as exists
  `);
  const auditExists = auditTableResult.rows[0].exists;
  log('audit_table', 'audit_events table exists', auditExists, 'Migration 002 not applied');

  // Check UPDATE trigger exists
  const updateTriggerResult = await client.query(`
    SELECT EXISTS (
      SELECT 1 FROM pg_trigger 
      WHERE tgname = 'audit_events_no_update'
    ) as exists
  `);
  log('audit_update', 'audit_events UPDATE blocked', updateTriggerResult.rows[0].exists, 'Append-only trigger not active');

  // Check DELETE trigger exists
  const deleteTriggerResult = await client.query(`
    SELECT EXISTS (
      SELECT 1 FROM pg_trigger 
      WHERE tgname = 'audit_events_no_delete'
    ) as exists
  `);
  log('audit_delete', 'audit_events DELETE blocked', deleteTriggerResult.rows[0].exists, 'Append-only trigger not active');

  console.log('\n📋 SECTION 2: MESSAGE SAFETY (Migration 003)');
  console.log('──────────────────────────────────────────────────');

  // Check messages.unit_id NOT NULL
  const unitIdResult = await client.query(`
    SELECT is_nullable FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'unit_id'
  `);
  const unitIdNotNull = unitIdResult.rows.length > 0 && unitIdResult.rows[0].is_nullable === 'NO';
  log('msg_unit_notnull', 'messages.unit_id NOT NULL', unitIdNotNull, 'NULL unit_id allowed');

  // Check FK constraint exists
  const fkResult = await client.query(`
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conrelid = 'messages'::regclass 
      AND contype = 'f' 
      AND conname LIKE '%unit%'
    ) as exists
  `);
  log('msg_unit_fk', 'messages.unit_id FK active', fkResult.rows[0].exists, 'FK constraint not enforced');

  console.log('\n📋 SECTION 3: TENANT ISOLATION (Migration 001/004)');
  console.log('──────────────────────────────────────────────────');

  // Check developments.tenant_id NOT NULL
  const devTenantResult = await client.query(`
    SELECT is_nullable FROM information_schema.columns 
    WHERE table_name = 'developments' AND column_name = 'tenant_id'
  `);
  const devTenantNotNull = devTenantResult.rows.length > 0 && devTenantResult.rows[0].is_nullable === 'NO';
  log('dev_tenant_notnull', 'developments.tenant_id NOT NULL', devTenantNotNull, 'Developments can be created without tenant');

  // Check tenant alignment trigger exists
  const alignTriggerResult = await client.query(`
    SELECT EXISTS (
      SELECT 1 FROM pg_trigger 
      WHERE tgname = 'enforce_tenant_alignment_units'
    ) as exists
  `);
  log('tenant_align', 'Tenant alignment trigger active', alignTriggerResult.rows[0].exists, 'Cross-tenant FK allowed');

  console.log('\n📋 SECTION 4: ROW LEVEL SECURITY');
  console.log('──────────────────────────────────────────────────');

  const tables = ['messages', 'units', 'documents', 'developments'];
  for (const table of tables) {
    const rlsResult = await client.query(`
      SELECT relrowsecurity FROM pg_class 
      WHERE relname = $1
    `, [table]);
    const rlsEnabled = rlsResult.rows.length > 0 && rlsResult.rows[0].relrowsecurity === true;
    log(`rls_${table}`, `RLS active on ${table}`, rlsEnabled, `RLS not enabled on ${table}`);
  }

  console.log('\n📋 SECTION 5: DATA INTEGRITY');
  console.log('──────────────────────────────────────────────────');

  // Check for orphaned messages (with unit_id column check)
  const unitIdExists = await client.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'messages' AND column_name = 'unit_id'
    ) as exists
  `);
  
  if (unitIdExists.rows[0].exists) {
    const orphanMsgResult = await client.query(`
      SELECT COUNT(*) as cnt FROM messages WHERE unit_id IS NULL
    `);
    const noOrphanMsgs = parseInt(orphanMsgResult.rows[0].cnt) === 0;
    log('no_orphan_msg', 'No orphaned messages', noOrphanMsgs, `${orphanMsgResult.rows[0].cnt} messages with NULL unit_id`);
  } else {
    log('no_orphan_msg', 'No orphaned messages', true, 'unit_id column not present (legacy schema)');
  }

  // Check for orphaned units
  const orphanUnitResult = await client.query(`
    SELECT COUNT(*) as cnt FROM units u 
    WHERE NOT EXISTS (SELECT 1 FROM developments d WHERE d.id = u.development_id)
  `);
  const noOrphanUnits = parseInt(orphanUnitResult.rows[0].cnt) === 0;
  log('no_orphan_units', 'No orphaned units', noOrphanUnits, `${orphanUnitResult.rows[0].cnt} units without valid development`);
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

  console.log('\n📋 SECTION 7: MANUAL CONFIRMATIONS');
  console.log('──────────────────────────────────────────────────');

  const mapsKeyRotated = process.env.MAPS_KEY_ROTATION_CONFIRMED === 'true';
  log('maps_key_rotated', 'Google Maps API key rotation confirmed', mapsKeyRotated, 
      'Set MAPS_KEY_ROTATION_CONFIRMED=true after completing key rotation checklist', false);
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

  if (!DATABASE_URL) {
    console.error('\n❌ Missing DATABASE_URL environment variable');
    process.exit(1);
  }

  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();
    await checkDatabaseHardening(client);
    await checkRuntimeProtections();
  } finally {
    await client.end();
  }

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
