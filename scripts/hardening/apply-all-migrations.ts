#!/usr/bin/env npx tsx
/**
 * Apply all hardening migrations using direct PostgreSQL connection
 */

import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable required');
  process.exit(1);
}

async function applyMigration(client: Client, migrationPath: string) {
  const migrationName = path.basename(migrationPath);
  console.log(`\n📋 Applying ${migrationName}...`);
  
  const sql = fs.readFileSync(migrationPath, 'utf-8');
  
  try {
    await client.query(sql);
    console.log(`   ✅ ${migrationName} applied successfully`);
    return true;
  } catch (error: any) {
    if (error.message?.includes('already exists')) {
      console.log(`   ⚠️  ${migrationName} already applied (objects exist)`);
      return true;
    }
    console.error(`   ❌ ${migrationName} failed: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║  APPLY ALL HARDENING MIGRATIONS                                      ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();
    console.log('\n✅ Connected to database');
    
    const migrationsDir = 'apps/unified-portal/migrations';
    const migrations = [
      '002_audit_events.sql',
      '003_messages_unit_required.sql',
      '004_developments_rls_and_tenant.sql',
    ];
    
    let allSuccess = true;
    for (const migration of migrations) {
      const migrationPath = path.join(migrationsDir, migration);
      if (fs.existsSync(migrationPath)) {
        const success = await applyMigration(client, migrationPath);
        if (!success) allSuccess = false;
      } else {
        console.log(`   ⚠️  ${migration} not found`);
      }
    }
    
    console.log('\n' + '═'.repeat(70));
    if (allSuccess) {
      console.log('✅ ALL MIGRATIONS APPLIED SUCCESSFULLY');
    } else {
      console.log('⚠️  SOME MIGRATIONS FAILED - Review output above');
    }
    
  } catch (error: any) {
    console.error('Connection error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
