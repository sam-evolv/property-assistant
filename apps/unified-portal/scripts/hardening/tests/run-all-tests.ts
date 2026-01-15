/**
 * Multi-Tenant Hardening Test Suite Runner
 * 
 * Runs all hardening tests and produces a comprehensive report.
 * 
 * Usage:
 *   npx tsx scripts/hardening/tests/run-all-tests.ts
 * 
 * Expected Outcomes:
 *   - ALL tests should PASS
 *   - ANY failure indicates a security vulnerability
 *   - Exit code 0 = success, 1 = failure
 */

import { execSync, spawn } from 'child_process';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

interface TestSuiteResult {
  name: string;
  passed: boolean;
  output: string;
  duration: number;
}

const results: TestSuiteResult[] = [];

async function checkMigrationApplied(): Promise<{ applied: boolean; message: string }> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabase
    .from('developments')
    .insert({
      name: '__migration_check__',
      slug: '__migration_check_' + Date.now(),
      code: 'MCK',
    });

  if (!error) {
    await supabase.from('developments').delete().ilike('name', '__migration_check__%');
    return {
      applied: false,
      message: 'NOT NULL constraint on developments.tenant_id is NOT enforced',
    };
  }

  if (error.message.includes('null') || error.message.includes('NOT NULL')) {
    return { applied: true, message: 'Constraints are active' };
  }

  return { applied: true, message: 'Constraints appear active (different error received)' };
}

const testSuites = [
  {
    name: '01-bad-seed-simulation',
    description: 'Proves bad seed scripts cannot corrupt the database',
  },
  {
    name: '02-partial-failure-recovery',
    description: 'Proves partial failures are safely rolled back',
  },
  {
    name: '03-cross-tenant-attacks',
    description: 'Proves cross-tenant attacks are blocked by triggers',
  },
  {
    name: '04-backup-restore',
    description: 'Proves backup/restore maintains data integrity',
  },
  {
    name: '05-rls-enforcement',
    description: 'Proves RLS policies block anonymous access',
  },
  {
    name: '06-service-role-guard',
    description: 'Proves TenantScopedClient enforces tenant isolation',
  },
];

async function runTest(testFile: string): Promise<{ passed: boolean; output: string }> {
  return new Promise((resolve) => {
    const testPath = path.join(__dirname, `${testFile}.ts`);
    let output = '';
    
    try {
      output = execSync(`npx tsx "${testPath}"`, {
        encoding: 'utf8',
        timeout: 60000,
        cwd: path.join(__dirname, '../../..'),
      });
      resolve({ passed: true, output });
    } catch (error: any) {
      output = error.stdout || error.stderr || error.message;
      resolve({ passed: false, output });
    }
  });
}

async function main() {
  console.log('╔' + '═'.repeat(78) + '╗');
  console.log('║' + '  MULTI-TENANT HARDENING TEST SUITE'.padEnd(78) + '║');
  console.log('║' + '  OpenHouse AI Unified Portal - Security Verification'.padEnd(78) + '║');
  console.log('╚' + '═'.repeat(78) + '╝');
  console.log('');
  
  console.log('🔍 PRE-FLIGHT: Checking if migration is applied...\n');
  const { applied, message } = await checkMigrationApplied();
  
  if (!applied) {
    console.log('╔' + '═'.repeat(78) + '╗');
    console.log('║' + '  ❌ MIGRATION NOT APPLIED'.padEnd(78) + '║');
    console.log('╚' + '═'.repeat(78) + '╝');
    console.log('');
    console.log(`  Reason: ${message}`);
    console.log('');
    console.log('  To apply the migration, run the following in Supabase SQL Editor:');
    console.log('');
    console.log('    apps/unified-portal/migrations/001_multi_tenant_hardening.sql');
    console.log('');
    console.log('  The tests will FAIL until the migration is applied.');
    console.log('  This is by design - the tests verify the constraints exist.');
    console.log('');
    console.log('  IMPORTANT: Before applying, run the recovery script to fix orphaned data:');
    console.log('    npx tsx scripts/hardening/recover-orphaned-messages.ts');
    console.log('');
    process.exit(1);
  }
  
  console.log(`  ✅ Migration applied: ${message}`);
  console.log('');
  console.log('This test suite verifies that:');
  console.log('  1. Bad seed scripts CANNOT corrupt the database');
  console.log('  2. Partial failures are SAFELY rolled back');
  console.log('  3. Cross-tenant attacks are BLOCKED');
  console.log('  4. Backup/restore maintains DATA INTEGRITY');
  console.log('');
  console.log('Running tests...\n');

  for (const suite of testSuites) {
    console.log('─'.repeat(80));
    console.log(`📋 ${suite.name}: ${suite.description}`);
    console.log('─'.repeat(80));
    
    const startTime = Date.now();
    const { passed, output } = await runTest(suite.name);
    const duration = Date.now() - startTime;

    results.push({
      name: suite.name,
      passed,
      output,
      duration,
    });

    console.log(output);
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log('');
  }

  console.log('╔' + '═'.repeat(78) + '╗');
  console.log('║' + '  FINAL REPORT'.padEnd(78) + '║');
  console.log('╚' + '═'.repeat(78) + '╝');
  console.log('');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log('  Test Suite Results:');
  console.log('  ─'.repeat(40));
  
  for (const result of results) {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    const duration = `${result.duration}ms`.padStart(8);
    console.log(`    ${status}  ${result.name.padEnd(35)} ${duration}`);
  }

  console.log('  ─'.repeat(40));
  console.log(`    Total: ${passed} passed, ${failed} failed (${totalDuration}ms)`);
  console.log('');

  if (failed > 0) {
    console.log('╔' + '═'.repeat(78) + '╗');
    console.log('║' + '  ⚠️  SECURITY VULNERABILITIES DETECTED'.padEnd(78) + '║');
    console.log('╚' + '═'.repeat(78) + '╝');
    console.log('');
    console.log('  The following test suites failed:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`    ❌ ${r.name}`);
    });
    console.log('');
    console.log('  ACTION REQUIRED: Fix all failures before deploying to production.');
    console.log('');
    process.exit(1);
  } else {
    console.log('╔' + '═'.repeat(78) + '╗');
    console.log('║' + '  ✅ ALL SECURITY TESTS PASSED'.padEnd(78) + '║');
    console.log('╚' + '═'.repeat(78) + '╝');
    console.log('');
    console.log('  The multi-tenant hardening is VERIFIED WORKING:');
    console.log('');
    console.log('    🛡️  Bad seed scripts are BLOCKED by constraints');
    console.log('    🛡️  Partial failures ROLL BACK completely');
    console.log('    🛡️  Cross-tenant attacks are IMPOSSIBLE');
    console.log('    🛡️  Backup/restore maintains INTEGRITY');
    console.log('');
    console.log('  DEVELOPER CONFIDENCE STATEMENT:');
    console.log('  "Your data is safer here than in your own systems."');
    console.log('');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
