#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

async function main() {
  console.log('\n===========================================');
  console.log('  UNIT_ID PERSISTENCE REGRESSION TEST');
  console.log('===========================================\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const databaseUrl = process.env.DATABASE_URL;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(`${RED}Missing SUPABASE credentials${RESET}`);
    process.exit(1);
  }

  if (!databaseUrl) {
    console.error(`${RED}Missing DATABASE_URL${RESET}`);
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    console.log('1. Checking recent messages for unit_id...\n');

    const result = await pool.query(`
      SELECT 
        id,
        unit_id,
        user_id,
        development_id,
        created_at,
        metadata->>'unitUid' as metadata_unit_uid
      FROM messages
      ORDER BY created_at DESC
      LIMIT 10
    `);

    if (result.rows.length === 0) {
      console.log(`${YELLOW}No messages found in database${RESET}\n`);
    } else {
      console.log('Most recent 10 messages:\n');
      for (const row of result.rows) {
        const unitIdStatus = row.unit_id 
          ? `${GREEN}✓ unit_id: ${row.unit_id.substring(0, 8)}...${RESET}`
          : `${RED}✗ unit_id: NULL${RESET}`;
        console.log(`  ${row.created_at?.toISOString().substring(0, 19)} | ${unitIdStatus}`);
      }
    }

    console.log('\n2. Counting messages with/without unit_id...\n');

    const countResult = await pool.query(`
      SELECT 
        COUNT(*)::int as total,
        COUNT(unit_id)::int as with_unit_id,
        COUNT(*) - COUNT(unit_id) as without_unit_id
      FROM messages
    `);

    const counts = countResult.rows[0];
    console.log(`  Total messages: ${counts.total}`);
    console.log(`  With unit_id:   ${counts.with_unit_id} (${Math.round(counts.with_unit_id / counts.total * 100)}%)`);
    console.log(`  Without:        ${counts.without_unit_id} (${Math.round(counts.without_unit_id / counts.total * 100)}%)`);

    console.log('\n3. Checking newest message has unit_id...\n');

    const newestResult = await pool.query(`
      SELECT id, unit_id, created_at
      FROM messages
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (newestResult.rows.length > 0) {
      const newest = newestResult.rows[0];
      if (newest.unit_id) {
        console.log(`  ${GREEN}✓ PASS: Newest message has unit_id${RESET}`);
        console.log(`    ID: ${newest.id}`);
        console.log(`    unit_id: ${newest.unit_id}`);
        console.log(`    created_at: ${newest.created_at}`);
      } else {
        console.log(`  ${RED}✗ FAIL: Newest message is missing unit_id${RESET}`);
        console.log(`    ID: ${newest.id}`);
        console.log(`    created_at: ${newest.created_at}`);
      }
    }

    console.log('\n4. Verifying unit_id links to valid Supabase unit...\n');

    if (newestResult.rows.length > 0 && newestResult.rows[0].unit_id) {
      const unitId = newestResult.rows[0].unit_id;
      const { data: unit, error } = await supabase
        .from('units')
        .select('id, address, purchaser_name, project_id')
        .eq('id', unitId)
        .single();

      if (error || !unit) {
        console.log(`  ${YELLOW}⚠ WARNING: unit_id ${unitId} not found in Supabase units table${RESET}`);
        console.log(`    This may indicate a data sync issue`);
      } else {
        console.log(`  ${GREEN}✓ PASS: unit_id links to valid Supabase unit${RESET}`);
        console.log(`    Address: ${unit.address}`);
        console.log(`    Purchaser: ${unit.purchaser_name || 'Unassigned'}`);
        console.log(`    Project: ${unit.project_id}`);
      }
    }

    console.log('\n===========================================');
    console.log(`${GREEN}REGRESSION TEST COMPLETE${RESET}\n`);

  } catch (error) {
    console.error(`${RED}Test failed:${RESET}`, error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
