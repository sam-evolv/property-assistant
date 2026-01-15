/**
 * Tenant Backup Script
 * 
 * Creates a complete backup of a tenant's data for disaster recovery.
 * 
 * Usage:
 *   npx tsx scripts/hardening/backup-tenant.ts <tenant_id>
 *   npx tsx scripts/hardening/backup-tenant.ts --all
 * 
 * Output:
 *   Creates JSON backup file in ./backups/<tenant_slug>_<timestamp>.json
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

async function backupTenant(tenantId: string): Promise<TenantBackup | null> {
  console.log(`\n📦 Backing up tenant: ${tenantId}`);

  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .single();

  if (tenantError || !tenant) {
    console.error(`  ❌ Tenant not found: ${tenantId}`);
    return null;
  }

  console.log(`  📋 Tenant: ${tenant.name}`);

  const { data: developments } = await supabase
    .from('developments')
    .select('*')
    .eq('tenant_id', tenantId);

  const { data: units } = await supabase
    .from('units')
    .select('*')
    .eq('tenant_id', tenantId);

  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('tenant_id', tenantId);

  const { data: documents } = await supabase
    .from('documents')
    .select('*')
    .eq('tenant_id', tenantId);

  const { data: houseTypes } = await supabase
    .from('house_types')
    .select('*')
    .eq('tenant_id', tenantId);

  const { data: noticeboardPosts } = await supabase
    .from('noticeboard_posts')
    .select('*')
    .eq('tenant_id', tenantId);

  const backup: TenantBackup = {
    version: '1.0.0',
    backup_time: new Date().toISOString(),
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
    },
    statistics: {
      developments: developments?.length || 0,
      units: units?.length || 0,
      messages: messages?.length || 0,
      documents: documents?.length || 0,
      house_types: houseTypes?.length || 0,
      noticeboard_posts: noticeboardPosts?.length || 0,
    },
    data: {
      developments: developments || [],
      units: units || [],
      messages: messages || [],
      documents: documents || [],
      house_types: houseTypes || [],
      noticeboard_posts: noticeboardPosts || [],
    },
    checksums: {
      developments: simpleChecksum(developments || []),
      units: simpleChecksum(units || []),
      messages: simpleChecksum(messages || []),
    },
  };

  console.log(`  ✅ Captured: ${backup.statistics.developments} developments, ${backup.statistics.units} units, ${backup.statistics.messages} messages`);

  return backup;
}

async function saveBackup(backup: TenantBackup): Promise<string> {
  const backupDir = path.join(process.cwd(), 'backups');
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${backup.tenant.slug}_${timestamp}.json`;
  const filepath = path.join(backupDir, filename);

  fs.writeFileSync(filepath, JSON.stringify(backup, null, 2));
  
  console.log(`  💾 Saved: ${filepath}`);
  return filepath;
}

async function main() {
  const args = process.argv.slice(2);

  console.log('╔' + '═'.repeat(60) + '╗');
  console.log('║' + '  TENANT BACKUP UTILITY'.padEnd(60) + '║');
  console.log('╚' + '═'.repeat(60) + '╝');

  if (args.length === 0) {
    console.log('\nUsage:');
    console.log('  npx tsx scripts/hardening/backup-tenant.ts <tenant_id>');
    console.log('  npx tsx scripts/hardening/backup-tenant.ts --all');
    process.exit(1);
  }

  if (args[0] === '--all') {
    console.log('\n🔄 Backing up all tenants...');
    
    const { data: tenants } = await supabase
      .from('tenants')
      .select('id, name');

    if (!tenants || tenants.length === 0) {
      console.log('  No tenants found.');
      process.exit(0);
    }

    console.log(`  Found ${tenants.length} tenants`);

    const backups: string[] = [];
    for (const tenant of tenants) {
      const backup = await backupTenant(tenant.id);
      if (backup) {
        const filepath = await saveBackup(backup);
        backups.push(filepath);
      }
    }

    console.log('\n' + '═'.repeat(60));
    console.log('BACKUP COMPLETE');
    console.log('═'.repeat(60));
    console.log(`  ✅ ${backups.length} tenant backups created`);
    console.log(`  📁 Location: ./backups/`);
  } else {
    const tenantId = args[0];
    const backup = await backupTenant(tenantId);
    
    if (backup) {
      await saveBackup(backup);
      console.log('\n' + '═'.repeat(60));
      console.log('BACKUP COMPLETE');
      console.log('═'.repeat(60));
    }
  }
}

main().catch(err => {
  console.error('Backup error:', err);
  process.exit(1);
});
