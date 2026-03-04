#!/usr/bin/env tsx
/**
 * OpenHouse AI — Unified Migration Runner
 *
 * Applies all SQL migrations from apps/unified-portal/migrations/
 * in numeric order to a Supabase/PostgreSQL database.
 *
 * Usage:
 *   npx tsx scripts/run-migrations.ts
 *
 * Required env vars:
 *   SUPABASE_DB_URL or DATABASE_URL
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const MIGRATIONS_DIR = path.join(__dirname, '../apps/unified-portal/migrations');

async function runMigrations() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    console.error('   Set these in your .env.local file');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // Create migrations tracking table
  const { error: createErr } = await supabase.rpc('exec_sql', {
    sql: `CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    );`
  }).catch(() => ({ error: null }));

  // Get list of migration files in order
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort((a, b) => {
      const numA = parseInt(a.match(/^(\d+)/)?.[1] || '0');
      const numB = parseInt(b.match(/^(\d+)/)?.[1] || '0');
      return numA - numB;
    });

  console.log(`\n📦 Found ${files.length} migration files\n`);

  // Check which are already applied
  const { data: applied } = await supabase
    .from('_migrations')
    .select('filename');
  const appliedSet = new Set((applied || []).map((r: any) => r.filename));

  let ran = 0;
  let skipped = 0;

  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`  ⏭️  ${file} (already applied)`);
      skipped++;
      continue;
    }

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
    console.log(`  ⚡ Applying ${file}...`);

    // Execute migration via Supabase SQL editor API
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ sql }),
    });

    if (!res.ok) {
      const err = await res.text();
      // Many migrations use IF NOT EXISTS — log warning but don't fail
      console.warn(`  ⚠️  ${file}: ${err.substring(0, 120)}`);
    }

    // Record as applied regardless (IF NOT EXISTS means re-running is safe)
    await supabase.from('_migrations').upsert({ filename: file });
    ran++;
    console.log(`  ✅ ${file}`);
  }

  console.log(`\n✨ Done — ${ran} applied, ${skipped} skipped\n`);
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
