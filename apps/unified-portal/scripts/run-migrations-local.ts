#!/usr/bin/env tsx
/**
 * Apply all migrations in apps/unified-portal/migrations/ to Supabase.
 * Uses the Supabase client with service role key.
 *
 * Usage: npm run db:migrate
 * Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import * as fs from 'fs';
import * as path from 'path';

// Load .env.local
config({ path: resolve(__dirname, '../.env.local') });

const MIGRATIONS_DIR = path.join(__dirname, '../migrations');

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('\n❌ Missing environment variables.');
    console.error('   Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local\n');
    process.exit(1);
  }

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort((a, b) => {
      const numA = parseInt(a.match(/^(\d+)/)?.[1] || '0');
      const numB = parseInt(b.match(/^(\d+)/)?.[1] || '0');
      return numA - numB;
    });

  console.log(`\n🗄️  OpenHouse AI — Database Migration`);
  console.log(`📦 ${files.length} migration files found\n`);

  let applied = 0;
  let failed = 0;

  for (const file of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
    process.stdout.write(`  ⚡ ${file} ... `);

    // Split by semicolons and execute statements individually
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    let fileOk = true;
    for (const statement of statements) {
      const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ sql: statement + ';' }),
      });

      if (!res.ok) {
        const err = await res.text();
        // IF NOT EXISTS errors are fine
        if (!err.includes('already exists') && !err.includes('does not exist')) {
          console.log(`⚠️`);
          console.log(`     ${err.substring(0, 200)}`);
          fileOk = false;
          failed++;
          break;
        }
      }
    }

    if (fileOk) {
      console.log(`✅`);
      applied++;
    }
  }

  console.log(`\n${failed === 0 ? '✨' : '⚠️ '} Done — ${applied} applied${failed > 0 ? `, ${failed} had warnings` : ''}`);
  console.log(`\nYour database is ready. Start the dev server with: npm run dev\n`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
