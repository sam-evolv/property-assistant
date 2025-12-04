#!/usr/bin/env npx tsx
/**
 * migrate-from-legacy.ts
 * 
 * Migrates all application data from the legacy Neon Postgres (LEGACY_DATABASE_URL)
 * into Supabase (DATABASE_URL), making Supabase the single source of truth.
 * 
 * Usage:
 *   npx tsx scripts/migrate-from-legacy.ts              # Dry run (shows what would be migrated)
 *   npx tsx scripts/migrate-from-legacy.ts --confirm    # Actually run the migration
 *   npx tsx scripts/migrate-from-legacy.ts --confirm --mode=full  # Include analytics/derived tables
 * 
 * Environment variables required:
 *   LEGACY_DATABASE_URL - Source database (Neon)
 *   DATABASE_URL - Target database (Supabase)
 */

import { Pool } from 'pg';

const LEGACY_DATABASE_URL = process.env.LEGACY_DATABASE_URL;
const DATABASE_URL = process.env.DATABASE_URL;

if (!LEGACY_DATABASE_URL) {
  console.error('❌ LEGACY_DATABASE_URL is not set');
  process.exit(1);
}

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set');
  process.exit(1);
}

function parseHost(url: string): string {
  try {
    const match = url.match(/@([^:/]+)/);
    return match ? match[1] : 'unknown';
  } catch {
    return 'unknown';
  }
}

const sourceHost = parseHost(LEGACY_DATABASE_URL);
const targetHost = parseHost(DATABASE_URL);

console.log('================================================================================');
console.log('DATABASE MIGRATION: Neon → Supabase');
console.log('================================================================================');
console.log(`📤 SOURCE (Neon):    ${sourceHost}`);
console.log(`📥 TARGET (Supabase): ${targetHost}`);
console.log('================================================================================\n');

const args = process.argv.slice(2);
const confirmFlag = args.includes('--confirm');
const modeArg = args.find(a => a.startsWith('--mode='));
const mode: 'core' | 'full' = modeArg?.split('=')[1] === 'full' ? 'full' : 'core';

interface TableConfig {
  tableName: string;
  keyColumns: string[];
  category: 'core' | 'derived';
  description: string;
}

const TABLES_IN_ORDER: TableConfig[] = [
  { tableName: 'tenants', keyColumns: ['id'], category: 'core', description: 'Tenant organizations' },
  { tableName: 'admins', keyColumns: ['id'], category: 'core', description: 'Admin users' },
  { tableName: 'developments', keyColumns: ['id'], category: 'core', description: 'Property developments' },
  { tableName: 'house_types', keyColumns: ['id'], category: 'core', description: 'House type definitions' },
  { tableName: 'units', keyColumns: ['id'], category: 'core', description: 'Individual property units' },
  { tableName: 'homeowners', keyColumns: ['id'], category: 'core', description: 'Homeowner accounts' },
  { tableName: 'qr_tokens', keyColumns: ['id'], category: 'core', description: 'QR code tokens for onboarding' },
  { tableName: 'documents', keyColumns: ['id'], category: 'core', description: 'Uploaded documents' },
  { tableName: 'document_versions', keyColumns: ['id'], category: 'core', description: 'Document version history' },
  { tableName: 'doc_chunks', keyColumns: ['id'], category: 'core', description: 'Document text chunks with embeddings' },
  { tableName: 'rag_chunks', keyColumns: ['id'], category: 'core', description: 'RAG retrieval chunks' },
  { tableName: 'embedding_cache', keyColumns: ['hash'], category: 'core', description: 'OpenAI embedding cache' },
  { tableName: 'floorplan_vision', keyColumns: ['id'], category: 'core', description: 'GPT-4 Vision floorplan extractions' },
  { tableName: 'unit_intelligence_profiles', keyColumns: ['id'], category: 'core', description: 'Unit intelligence profiles' },
  { tableName: 'unit_room_dimensions', keyColumns: ['id'], category: 'core', description: 'Room dimension data' },
  { tableName: 'intel_extractions', keyColumns: ['id'], category: 'core', description: 'Document intelligence extractions' },
  { tableName: 'messages', keyColumns: ['id'], category: 'core', description: 'Chat message history' },
  { tableName: 'noticeboard_posts', keyColumns: ['id'], category: 'core', description: 'Community noticeboard posts' },
  { tableName: 'notice_comments', keyColumns: ['id'], category: 'core', description: 'Comments on noticeboard posts' },
  { tableName: 'pois', keyColumns: ['id'], category: 'core', description: 'Points of interest' },
  { tableName: 'faqs', keyColumns: ['id'], category: 'core', description: 'Frequently asked questions' },
  { tableName: 'contacts', keyColumns: ['id'], category: 'core', description: 'Contact directory' },
  { tableName: 'issue_types', keyColumns: ['id'], category: 'core', description: 'Ticket issue type definitions' },
  { tableName: 'tickets', keyColumns: ['id'], category: 'core', description: 'Support tickets' },
  { tableName: 'feedback', keyColumns: ['id'], category: 'core', description: 'User feedback' },
  { tableName: 'training_jobs', keyColumns: ['id'], category: 'core', description: 'Document training job queue' },
  { tableName: 'theme_config', keyColumns: ['id'], category: 'core', description: 'Tenant theme configuration' },
  { tableName: 'feature_flags', keyColumns: ['id'], category: 'core', description: 'Feature flag settings' },
  { tableName: 'important_docs_agreements', keyColumns: ['id'], category: 'core', description: 'Important document agreements' },
  { tableName: 'audit_log', keyColumns: ['id'], category: 'derived', description: 'Audit log entries' },
  { tableName: 'analytics_daily', keyColumns: ['id'], category: 'derived', description: 'Daily analytics aggregates' },
  { tableName: 'analytics_events', keyColumns: ['id'], category: 'derived', description: 'Raw analytics events' },
  { tableName: 'document_processing_logs', keyColumns: ['id'], category: 'derived', description: 'Document processing logs' },
  { tableName: 'api_cache', keyColumns: ['cache_key'], category: 'derived', description: 'API response cache' },
  { tableName: 'rate_limits', keyColumns: ['key'], category: 'derived', description: 'Rate limiting counters' },
];

function getTablesToCopy(): TableConfig[] {
  if (mode === 'full') {
    return TABLES_IN_ORDER;
  }
  return TABLES_IN_ORDER.filter(t => t.category === 'core');
}

async function getTableColumns(pool: Pool, tableName: string): Promise<string[]> {
  const result = await pool.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position
  `, [tableName]);
  return result.rows.map(r => r.column_name);
}

async function tableExists(pool: Pool, tableName: string): Promise<boolean> {
  const result = await pool.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = $1
    )
  `, [tableName]);
  return result.rows[0].exists;
}

async function getRowCount(pool: Pool, tableName: string): Promise<number> {
  try {
    const result = await pool.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
    return parseInt(result.rows[0].count, 10);
  } catch {
    return 0;
  }
}

function escapeIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/**
 * Transform row data to handle schema differences between source and target.
 * This handles cases where target has NOT NULL constraints on columns that
 * may be NULL in the source data.
 */
function transformRow(tableName: string, row: Record<string, any>): Record<string, any> {
  const transformed = { ...row };
  
  if (tableName === 'developments') {
    // Generate a code from the name if it's null
    if (!transformed.code && transformed.name) {
      transformed.code = transformed.name
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
        .substring(0, 20);
    }
    // Generate a slug from the name if it's null
    if (!transformed.slug && transformed.name) {
      transformed.slug = transformed.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    }
  }
  
  if (tableName === 'units') {
    // Generate a code from the unit_number if it's null
    if (!transformed.code && transformed.unit_number) {
      transformed.code = `UNIT-${transformed.unit_number}`;
    }
  }
  
  if (tableName === 'house_types') {
    // Generate a code from the name if it's null
    if (!transformed.code && transformed.name) {
      transformed.code = transformed.name
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
        .substring(0, 20);
    }
  }
  
  return transformed;
}

async function copyTable(
  sourcePool: Pool,
  targetPool: Pool,
  config: TableConfig
): Promise<{ copied: number; errors: number }> {
  const { tableName, keyColumns } = config;
  
  const sourceExists = await tableExists(sourcePool, tableName);
  if (!sourceExists) {
    console.log(`  ⚠️  ${tableName}: Table does not exist in source, skipping`);
    return { copied: 0, errors: 0 };
  }

  const targetExists = await tableExists(targetPool, tableName);
  if (!targetExists) {
    console.log(`  ⚠️  ${tableName}: Table does not exist in target, skipping`);
    return { copied: 0, errors: 0 };
  }

  const sourceColumns = await getTableColumns(sourcePool, tableName);
  const targetColumns = await getTableColumns(targetPool, tableName);
  
  const commonColumns = sourceColumns.filter(c => targetColumns.includes(c));
  
  if (commonColumns.length === 0) {
    console.log(`  ⚠️  ${tableName}: No common columns, skipping`);
    return { copied: 0, errors: 0 };
  }

  const sourceResult = await sourcePool.query(`SELECT * FROM "${tableName}"`);
  const rows = sourceResult.rows;

  if (rows.length === 0) {
    console.log(`  ℹ️  ${tableName}: 0 rows in source`);
    return { copied: 0, errors: 0 };
  }

  let copied = 0;
  let errors = 0;

  const columnList = commonColumns.map(escapeIdentifier).join(', ');
  const valuePlaceholders = commonColumns.map((_, i) => `$${i + 1}`).join(', ');
  const keyColumnList = keyColumns.map(escapeIdentifier).join(', ');
  
  const updateSet = commonColumns
    .filter(c => !keyColumns.includes(c))
    .map(c => `${escapeIdentifier(c)} = EXCLUDED.${escapeIdentifier(c)}`)
    .join(', ');

  const upsertQuery = updateSet
    ? `INSERT INTO "${tableName}" (${columnList}) VALUES (${valuePlaceholders})
       ON CONFLICT (${keyColumnList}) DO UPDATE SET ${updateSet}`
    : `INSERT INTO "${tableName}" (${columnList}) VALUES (${valuePlaceholders})
       ON CONFLICT (${keyColumnList}) DO NOTHING`;

  for (const row of rows) {
    // Apply transformations to handle schema differences
    const transformedRow = transformRow(tableName, row);
    const values = commonColumns.map(c => transformedRow[c]);
    try {
      await targetPool.query(upsertQuery, values);
      copied++;
    } catch (error: any) {
      errors++;
      if (errors <= 3) {
        console.log(`    ❌ Error inserting row: ${error.message}`);
      } else if (errors === 4) {
        console.log(`    ... (suppressing further errors for this table)`);
      }
    }
  }

  return { copied, errors };
}

async function runMigration() {
  const tablesToCopy = getTablesToCopy();
  
  console.log(`Mode: ${mode.toUpperCase()}`);
  console.log(`Tables to migrate: ${tablesToCopy.length}\n`);

  if (!confirmFlag) {
    console.log('🔍 DRY RUN MODE (add --confirm to actually migrate)\n');
    console.log('Tables that would be migrated:\n');
    
    const sourcePool = new Pool({
      connectionString: LEGACY_DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });

    try {
      for (const config of tablesToCopy) {
        const exists = await tableExists(sourcePool, config.tableName);
        if (exists) {
          const count = await getRowCount(sourcePool, config.tableName);
          console.log(`  ${config.tableName}: ${count} rows (${config.description})`);
        } else {
          console.log(`  ${config.tableName}: [not in source] (${config.description})`);
        }
      }
    } finally {
      await sourcePool.end();
    }

    console.log('\n================================================================================');
    console.log('To run the actual migration, use:');
    console.log('  npx tsx scripts/migrate-from-legacy.ts --confirm');
    console.log('================================================================================\n');
    return;
  }

  console.log('🚀 RUNNING MIGRATION\n');

  const sourcePool = new Pool({
    connectionString: LEGACY_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const targetPool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  // Add error handlers to prevent unhandled error crashes
  sourcePool.on('error', (err) => {
    console.log(`  ⚠️  Source pool error (non-fatal): ${err.message}`);
  });

  targetPool.on('error', (err) => {
    console.log(`  ⚠️  Target pool error (non-fatal): ${err.message}`);
  });

  const results: { table: string; copied: number; errors: number }[] = [];

  try {
    await sourcePool.query('SELECT 1');
    console.log('✅ Connected to source (Neon)\n');
  } catch (error: any) {
    console.error(`❌ Failed to connect to source: ${error.message}`);
    process.exit(1);
  }

  try {
    await targetPool.query('SELECT 1');
    console.log('✅ Connected to target (Supabase)\n');
  } catch (error: any) {
    console.error(`❌ Failed to connect to target: ${error.message}`);
    process.exit(1);
  }

  console.log('Migrating tables...\n');

  for (const config of tablesToCopy) {
    process.stdout.write(`  ${config.tableName}... `);
    const { copied, errors } = await copyTable(sourcePool, targetPool, config);
    results.push({ table: config.tableName, copied, errors });
    
    if (copied > 0 || errors > 0) {
      console.log(`${copied} rows copied${errors > 0 ? `, ${errors} errors` : ''}`);
    }
  }

  await sourcePool.end();
  await targetPool.end();

  console.log('\n================================================================================');
  console.log('MIGRATION SUMMARY');
  console.log('================================================================================\n');

  let totalCopied = 0;
  let totalErrors = 0;

  for (const r of results) {
    if (r.copied > 0 || r.errors > 0) {
      const status = r.errors > 0 ? '⚠️' : '✅';
      console.log(`  ${status} ${r.table}: ${r.copied} rows${r.errors > 0 ? ` (${r.errors} errors)` : ''}`);
      totalCopied += r.copied;
      totalErrors += r.errors;
    }
  }

  console.log(`\nTotal: ${totalCopied} rows migrated, ${totalErrors} errors\n`);

  if (totalErrors > 0) {
    console.log('⚠️  Some rows failed to migrate. Check the errors above.\n');
  } else {
    console.log('✅ Migration completed successfully!\n');
  }

  console.log('Next steps:');
  console.log('  1. Verify data in Supabase Dashboard');
  console.log('  2. Run: npx tsx scripts/reprocess-all-docs.ts --limit 3');
  console.log('  3. Test the application thoroughly');
  console.log('  4. Once verified, the legacy DB can be decommissioned\n');
}

runMigration().catch(error => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
