#!/usr/bin/env tsx
/**
 * OpenHouse AI migration runner.
 *
 * Applies apps/unified-portal/migrations/*.sql in numeric order using one
 * PostgreSQL connection. Each migration and its tracking insert commit in the
 * same transaction.
 *
 * Required env: SUPABASE_DB_URL or DATABASE_URL
 */

import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';

const MIGRATIONS_DIR = path.join(__dirname, '../apps/unified-portal/migrations');

function migrationBody(sql: string): string {
  return sql
    .replace(/^\s*(?:BEGIN|START\s+TRANSACTION)\s*;\s*$/gim, '')
    .replace(/^\s*(?:COMMIT|ROLLBACK)\s*;\s*$/gim, '')
    .trim();
}

export async function runMigrations(): Promise<void> {
  const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Missing SUPABASE_DB_URL or DATABASE_URL');
  }

  const client = new Client({ connectionString });
  await client.connect();
  let lockAcquired = false;

  try {
    // Serialize all migration runners for this database. The session lock is
    // held through migration execution and tracking so two processes cannot
    // both observe and run the same pending file.
    await client.query("SELECT pg_advisory_lock(hashtext('openhouse_migrations'))");
    lockAcquired = true;

    const schemaStateResult = await client.query<{ baseline_exists: boolean; tracking_exists: boolean }>(
      `SELECT
         to_regclass('public.units') IS NOT NULL AS baseline_exists,
         to_regclass('public._migrations') IS NOT NULL AS tracking_exists`
    );
    const schemaState = schemaStateResult.rows[0];
    const missingBaselineSchema = schemaState?.baseline_exists !== true;
    if (missingBaselineSchema) {
      throw new Error(
        'OpenHouse baseline schema is missing. This runner applies incremental migrations only; provision the canonical baseline before running it.'
      );
    }

    const existingSchemaWithoutTracking = schemaState?.tracking_exists !== true;
    if (existingSchemaWithoutTracking) {
      throw new Error(
        'Existing OpenHouse schema has no migration history. Refusing to replay all migrations; baseline _migrations explicitly before running.'
      );
    }

    let appliedRows: Array<{ filename: string }>;
    try {
      const result = await client.query<{ filename: string }>(
        'SELECT filename FROM _migrations'
      );
      appliedRows = result.rows;
    } catch (appliedQueryError) {
      throw new Error(
        `Unable to read migration tracking state: ${
          appliedQueryError instanceof Error ? appliedQueryError.message : String(appliedQueryError)
        }`
      );
    }

    if (appliedRows.length === 0) {
      throw new Error(
        'Existing OpenHouse schema has an empty migration history. Refusing to replay all migrations; baseline _migrations explicitly before running.'
      );
    }

    const appliedSet = new Set(appliedRows.map(row => row.filename));
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(file => /^\d+_[a-z0-9_]+\.sql$/i.test(file))
      .sort((a, b) => {
        const numA = parseInt(a.match(/^(\d+)/)?.[1] || '0', 10);
        const numB = parseInt(b.match(/^(\d+)/)?.[1] || '0', 10);
        return numA - numB;
      });

    let ran = 0;
    let skipped = 0;
    console.log(`\n📦 Found ${files.length} migration files\n`);

    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`  ⏭️  ${file} (already applied)`);
        skipped++;
        continue;
      }

      const rawSql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      const sql_with_tracking = migrationBody(rawSql);
      console.log(`  ⚡ Applying ${file}...`);

      await client.query('BEGIN');
      try {
        await client.query(sql_with_tracking);
        await client.query(
          'INSERT INTO _migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
          [file]
        );
        await client.query('COMMIT');
      } catch (migrationError) {
        await client.query('ROLLBACK');
        throw new Error(
          `Migration ${file} failed: ${
            migrationError instanceof Error ? migrationError.message : String(migrationError)
          }`
        );
      }

      ran++;
      console.log(`  ✅ ${file}`);
    }

    console.log(`\n✨ Done: ${ran} applied, ${skipped} skipped\n`);
  } finally {
    try {
      if (lockAcquired) {
        await client.query("SELECT pg_advisory_unlock(hashtext('openhouse_migrations'))");
      }
    } finally {
      await client.end();
    }
  }
}

if (require.main === module) {
  runMigrations().catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
}
