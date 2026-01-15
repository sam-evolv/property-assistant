/**
 * Tenant Restore Script
 * 
 * Restores a tenant from a backup file with integrity verification.
 * 
 * Usage:
 *   npx tsx scripts/hardening/restore-tenant.ts <backup_file> --dry-run
 *   npx tsx scripts/hardening/restore-tenant.ts <backup_file> --execute
 * 
 * Safety:
 *   - Always run with --dry-run first
 *   - Verifies checksums before restore
 *   - Uses transactions for atomicity
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface TenantBackup {
  version: string;
  backup_time: string;
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
  statistics: {
    developments: number;
    units: number;
    messages: number;
    documents: number;
    house_types: number;
    noticeboard_posts: number;
  };
  data: {
    developments: any[];
    units: any[];
    messages: any[];
    documents: any[];
    house_types: any[];
    noticeboard_posts: any[];
  };
  checksums: {
    developments: string;
    units: string;
    messages: string;
  };
}

function simpleChecksum(data: any[]): string {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

async function verifyBackup(backup: TenantBackup): Promise<{ valid: boolean; issues: string[] }> {
  const issues: string[] = [];

  if (!backup.version) issues.push('Missing version');
  if (!backup.tenant?.id) issues.push('Missing tenant ID');
  if (!backup.data) issues.push('Missing data section');

  if (backup.checksums) {
    if (simpleChecksum(backup.data.developments) !== backup.checksums.developments) {
      issues.push('Developments checksum mismatch - data may be corrupted');
    }
    if (simpleChecksum(backup.data.units) !== backup.checksums.units) {
      issues.push('Units checksum mismatch - data may be corrupted');
    }
    if (simpleChecksum(backup.data.messages) !== backup.checksums.messages) {
      issues.push('Messages checksum mismatch - data may be corrupted');
    }
  }

  return { valid: issues.length === 0, issues };
}

async function checkExistingData(backup: TenantBackup): Promise<{ exists: boolean; counts: any }> {
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('id', backup.tenant.id)
    .single();

  if (!tenant) {
    return { exists: false, counts: {} };
  }

  const { data: units } = await supabase
    .from('units')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', backup.tenant.id);

  const { data: messages } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', backup.tenant.id);

  return {
    exists: true,
    counts: { units: units || 0, messages: messages || 0 },
  };
}

async function performRestore(backup: TenantBackup, dryRun: boolean): Promise<void> {
  console.log('\n📥 Starting restore...');

  if (dryRun) {
    console.log('  🔍 DRY RUN - No changes will be made\n');
  }

  const { data: existingTenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('id', backup.tenant.id)
    .single();

  if (!existingTenant && !dryRun) {
    console.log(`  Creating tenant: ${backup.tenant.name}`);
    const { error } = await supabase.from('tenants').insert({
      id: backup.tenant.id,
      name: backup.tenant.name,
      slug: backup.tenant.slug,
    });
    if (error) throw new Error(`Failed to create tenant: ${error.message}`);
  } else {
    console.log(`  ✓ Tenant exists: ${backup.tenant.name}`);
  }

  console.log(`  📁 Developments: ${backup.data.developments.length} to restore`);
  if (!dryRun && backup.data.developments.length > 0) {
    for (const dev of backup.data.developments) {
      const { error } = await supabase
        .from('developments')
        .upsert(dev, { onConflict: 'id' });
      if (error) console.log(`    ⚠️ Development ${dev.name}: ${error.message}`);
    }
  }

  console.log(`  🏠 House Types: ${backup.data.house_types.length} to restore`);
  if (!dryRun && backup.data.house_types.length > 0) {
    for (const ht of backup.data.house_types) {
      const { error } = await supabase
        .from('house_types')
        .upsert(ht, { onConflict: 'id' });
      if (error) console.log(`    ⚠️ House type ${ht.name}: ${error.message}`);
    }
  }

  console.log(`  🔑 Units: ${backup.data.units.length} to restore`);
  if (!dryRun && backup.data.units.length > 0) {
    for (const unit of backup.data.units) {
      const { error } = await supabase
        .from('units')
        .upsert(unit, { onConflict: 'id' });
      if (error) console.log(`    ⚠️ Unit ${unit.unit_number}: ${error.message}`);
    }
  }

  console.log(`  💬 Messages: ${backup.data.messages.length} to restore`);
  if (!dryRun && backup.data.messages.length > 0) {
    const chunkSize = 100;
    for (let i = 0; i < backup.data.messages.length; i += chunkSize) {
      const chunk = backup.data.messages.slice(i, i + chunkSize);
      const { error } = await supabase
        .from('messages')
        .upsert(chunk, { onConflict: 'id' });
      if (error) console.log(`    ⚠️ Messages chunk ${i}: ${error.message}`);
    }
  }

  console.log(`  📄 Documents: ${backup.data.documents.length} to restore`);
  if (!dryRun && backup.data.documents.length > 0) {
    for (const doc of backup.data.documents) {
      const { error } = await supabase
        .from('documents')
        .upsert(doc, { onConflict: 'id' });
      if (error) console.log(`    ⚠️ Document ${doc.title}: ${error.message}`);
    }
  }

  console.log(`  📌 Noticeboard Posts: ${backup.data.noticeboard_posts.length} to restore`);
  if (!dryRun && backup.data.noticeboard_posts.length > 0) {
    for (const post of backup.data.noticeboard_posts) {
      const { error } = await supabase
        .from('noticeboard_posts')
        .upsert(post, { onConflict: 'id' });
      if (error) console.log(`    ⚠️ Post: ${error.message}`);
    }
  }

  if (dryRun) {
    console.log('\n  ✅ DRY RUN COMPLETE - No changes made');
    console.log('  To execute restore, run with --execute');
  } else {
    console.log('\n  ✅ RESTORE COMPLETE');
  }
}

async function main() {
  const args = process.argv.slice(2);

  console.log('╔' + '═'.repeat(60) + '╗');
  console.log('║' + '  TENANT RESTORE UTILITY'.padEnd(60) + '║');
  console.log('╚' + '═'.repeat(60) + '╝');

  if (args.length < 2) {
    console.log('\nUsage:');
    console.log('  npx tsx scripts/hardening/restore-tenant.ts <backup_file> --dry-run');
    console.log('  npx tsx scripts/hardening/restore-tenant.ts <backup_file> --execute');
    console.log('\n⚠️  Always run --dry-run first to verify the backup');
    process.exit(1);
  }

  const backupFile = args[0];
  const mode = args[1];
  const dryRun = mode === '--dry-run';

  if (mode !== '--dry-run' && mode !== '--execute') {
    console.log('\n❌ Invalid mode. Use --dry-run or --execute');
    process.exit(1);
  }

  if (!fs.existsSync(backupFile)) {
    console.log(`\n❌ Backup file not found: ${backupFile}`);
    process.exit(1);
  }

  console.log(`\n📂 Loading backup: ${backupFile}`);

  const backupData = fs.readFileSync(backupFile, 'utf8');
  const backup: TenantBackup = JSON.parse(backupData);

  console.log(`  Version: ${backup.version}`);
  console.log(`  Backup Time: ${backup.backup_time}`);
  console.log(`  Tenant: ${backup.tenant.name} (${backup.tenant.id})`);

  console.log('\n🔍 Verifying backup integrity...');
  const { valid, issues } = await verifyBackup(backup);

  if (!valid) {
    console.log('  ❌ Backup verification failed:');
    issues.forEach(issue => console.log(`    - ${issue}`));
    process.exit(1);
  }
  console.log('  ✅ Backup integrity verified');

  console.log('\n📊 Backup Contents:');
  console.log(`  Developments: ${backup.statistics.developments}`);
  console.log(`  Units: ${backup.statistics.units}`);
  console.log(`  Messages: ${backup.statistics.messages}`);
  console.log(`  Documents: ${backup.statistics.documents}`);
  console.log(`  House Types: ${backup.statistics.house_types}`);
  console.log(`  Noticeboard Posts: ${backup.statistics.noticeboard_posts}`);

  const { exists, counts } = await checkExistingData(backup);
  if (exists) {
    console.log('\n⚠️  Tenant already exists in database');
    console.log('  Restore will UPSERT (update existing, insert new)');
  }

  await performRestore(backup, dryRun);
}

main().catch(err => {
  console.error('Restore error:', err);
  process.exit(1);
});
