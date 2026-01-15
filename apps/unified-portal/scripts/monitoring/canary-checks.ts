/**
 * Canary Monitoring Checks
 * 
 * Detects data integrity issues before they become incidents:
 * - Orphaned messages (unit_id = null)
 * - Tenant misalignment (tenant_id mismatch)
 * - Abnormal delete volume
 * - Failed onboarding transactions
 * 
 * Environment Variables:
 *   SLACK_WEBHOOK_URL - Webhook for alerts
 * 
 * Usage:
 *   npx tsx scripts/monitoring/canary-checks.ts
 * 
 * Schedule: Run every 15 minutes via cron/workflow
 */

import { createClient } from '@supabase/supabase-js';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK_URL || '';

// ═══════════════════════════════════════════════════════════════════════════
// THRESHOLDS
// ═══════════════════════════════════════════════════════════════════════════

const THRESHOLDS = {
  orphanedMessages: 0,
  tenantMisalignment: 0,
  abnormalDeletesPerHour: 100,
  failedOnboardingPerDay: 5,
};

interface CanaryResult {
  name: string;
  value: number;
  threshold: number;
  passed: boolean;
  details: string;
}

const results: CanaryResult[] = [];

// ═══════════════════════════════════════════════════════════════════════════
// SLACK ALERTING
// ═══════════════════════════════════════════════════════════════════════════

async function sendAlert(message: string, severity: 'warning' | 'critical'): Promise<void> {
  if (!SLACK_WEBHOOK) {
    console.log(`[ALERT:${severity}] ${message}`);
    return;
  }

  const emoji = severity === 'critical' ? '🚨' : '⚠️';
  const color = severity === 'critical' ? '#FF0000' : '#FFA500';

  const payload = JSON.stringify({
    attachments: [{
      color,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${emoji} *Canary Alert: ${severity.toUpperCase()}*\n${message}`,
          },
        },
        {
          type: 'context',
          elements: [{
            type: 'mrkdwn',
            text: `*System:* OpenHouse AI | *Time:* ${new Date().toISOString()}`,
          }],
        },
      ],
    }],
  });

  return new Promise((resolve) => {
    try {
      const url = new URL(SLACK_WEBHOOK);
      const req = https.request({
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }, () => resolve());
      
      req.on('error', () => resolve());
      req.write(payload);
      req.end();
    } catch {
      resolve();
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// CANARY CHECKS
// ═══════════════════════════════════════════════════════════════════════════

async function checkOrphanedMessages(): Promise<void> {
  console.log('\n📋 Check 1: Orphaned Messages');
  
  const { count, error } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .is('unit_id', null);

  const value = count || 0;
  const passed = value <= THRESHOLDS.orphanedMessages;

  results.push({
    name: 'Orphaned Messages',
    value,
    threshold: THRESHOLDS.orphanedMessages,
    passed,
    details: passed ? 'No orphaned messages' : `${value} messages without unit_id`,
  });

  const icon = passed ? '✅' : '❌';
  console.log(`  ${icon} Count: ${value} (threshold: ${THRESHOLDS.orphanedMessages})`);

  if (!passed) {
    await sendAlert(`Found ${value} orphaned messages (unit_id = NULL)`, 'critical');
  }
}

async function checkTenantMisalignment(): Promise<void> {
  console.log('\n📋 Check 2: Tenant Misalignment');
  
  // Check units where tenant_id doesn't match development's tenant_id
  const { data: misaligned, error } = await supabase.rpc('count_misaligned_units');
  
  // Fallback if function doesn't exist
  let value = 0;
  if (error || misaligned === null) {
    const { data: units } = await supabase
      .from('units')
      .select(`
        id,
        tenant_id,
        project_id,
        developments!inner(tenant_id)
      `)
      .limit(1000);
    
    value = units?.filter((u: any) => u.tenant_id !== u.developments.tenant_id).length || 0;
  } else {
    value = misaligned;
  }

  const passed = value <= THRESHOLDS.tenantMisalignment;

  results.push({
    name: 'Tenant Misalignment',
    value,
    threshold: THRESHOLDS.tenantMisalignment,
    passed,
    details: passed ? 'All records aligned' : `${value} misaligned records`,
  });

  const icon = passed ? '✅' : '❌';
  console.log(`  ${icon} Count: ${value} (threshold: ${THRESHOLDS.tenantMisalignment})`);

  if (!passed) {
    await sendAlert(`Found ${value} records with tenant misalignment`, 'critical');
  }
}

async function checkAbnormalDeletes(): Promise<void> {
  console.log('\n📋 Check 3: Abnormal Delete Volume');
  
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  const { count, error } = await supabase
    .from('audit_events')
    .select('*', { count: 'exact', head: true })
    .eq('operation', 'DELETE')
    .gte('created_at', oneHourAgo);

  const value = count || 0;
  const passed = value <= THRESHOLDS.abnormalDeletesPerHour;

  results.push({
    name: 'Abnormal Deletes (1h)',
    value,
    threshold: THRESHOLDS.abnormalDeletesPerHour,
    passed,
    details: passed ? 'Delete volume normal' : `${value} deletes in last hour`,
  });

  const icon = passed ? '✅' : '❌';
  console.log(`  ${icon} Count: ${value} (threshold: ${THRESHOLDS.abnormalDeletesPerHour})`);

  if (!passed) {
    await sendAlert(`Abnormal delete volume: ${value} deletes in the last hour`, 'warning');
  }
}

async function checkFailedOnboarding(): Promise<void> {
  console.log('\n📋 Check 4: Failed Onboarding Transactions');
  
  // This checks for tenants or developments created without associated data
  // Indicates partial transaction failures
  
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  // Find tenants with no developments (potential partial failure)
  const { data: emptyTenants } = await supabase
    .from('tenants')
    .select('id, developments(id)')
    .gte('created_at', oneDayAgo);

  const value = emptyTenants?.filter((t: any) => 
    !t.developments || t.developments.length === 0
  ).length || 0;

  const passed = value <= THRESHOLDS.failedOnboardingPerDay;

  results.push({
    name: 'Failed Onboarding (24h)',
    value,
    threshold: THRESHOLDS.failedOnboardingPerDay,
    passed,
    details: passed ? 'Onboarding normal' : `${value} tenants without developments`,
  });

  const icon = passed ? '✅' : '❌';
  console.log(`  ${icon} Count: ${value} (threshold: ${THRESHOLDS.failedOnboardingPerDay})`);

  if (!passed) {
    await sendAlert(`${value} failed onboarding transactions in the last 24 hours`, 'warning');
  }
}

async function checkDataIntegrity(): Promise<void> {
  console.log('\n📋 Check 5: Data Integrity (NULL tenant_id)');
  
  const tables = ['units', 'developments', 'documents', 'house_types'];
  let totalNull = 0;

  for (const table of tables) {
    const { count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .is('tenant_id', null);
    
    totalNull += count || 0;
  }

  const passed = totalNull === 0;

  results.push({
    name: 'NULL tenant_id Records',
    value: totalNull,
    threshold: 0,
    passed,
    details: passed ? 'All records have tenant_id' : `${totalNull} records missing tenant_id`,
  });

  const icon = passed ? '✅' : '❌';
  console.log(`  ${icon} Count: ${totalNull} (threshold: 0)`);

  if (!passed) {
    await sendAlert(`Found ${totalNull} records with NULL tenant_id across tables`, 'critical');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('╔' + '═'.repeat(60) + '╗');
  console.log('║' + '  CANARY MONITORING CHECKS'.padEnd(60) + '║');
  console.log('╚' + '═'.repeat(60) + '╝');
  console.log(`\nTimestamp: ${new Date().toISOString()}`);

  await checkOrphanedMessages();
  await checkTenantMisalignment();
  await checkAbnormalDeletes();
  await checkFailedOnboarding();
  await checkDataIntegrity();

  // Summary
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log('\n' + '═'.repeat(60));
  console.log('SUMMARY');
  console.log('═'.repeat(60));
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);

  // Save report
  const reportsDir = path.join(process.cwd(), 'scripts', 'monitoring', 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const report = {
    timestamp: new Date().toISOString(),
    results,
    summary: { passed, failed, total: results.length },
    status: failed > 0 ? 'ALERT' : 'OK',
  };
  
  const reportPath = path.join(reportsDir, `canary-${timestamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`  📄 Report: ${reportPath}`);

  if (failed > 0) {
    console.log('\n🚨 CANARY ALERTS TRIGGERED');
    process.exit(1);
  } else {
    console.log('\n✅ ALL CANARIES GREEN');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Canary check error:', err);
  process.exit(1);
});
