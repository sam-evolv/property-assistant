#!/usr/bin/env npx tsx
/**
 * Backfill Unit Types Script
 * 
 * For existing projects with units but no unit_types, this script will:
 * 1. Find all projects where unit_types count is 0 but units exist
 * 2. Generate unit_types from distinct unit type values in units
 * 3. Update units with unit_type_id foreign key
 * 
 * This script is IDEMPOTENT - running it multiple times will not create duplicates.
 * 
 * Usage:
 *   npx tsx scripts/backfill-unit-types.ts
 *   npx tsx scripts/backfill-unit-types.ts --dry-run
 *   npx tsx scripts/backfill-unit-types.ts --project-id=<uuid>
 */

import { createClient } from '@supabase/supabase-js';
import { runBackfill, findProjectsNeedingBackfill, BackfillSummary } from '../lib/backfill-unit-types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
  db: { schema: 'public' },
});

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const projectIdArg = args.find(a => a.startsWith('--project-id='));
  const specificProjectId = projectIdArg ? projectIdArg.split('=')[1] : null;

  console.log('===========================================');
  console.log('  Unit Types Backfill Script');
  console.log('===========================================');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE'}`);
  console.log('');

  if (specificProjectId) {
    console.log(`Target: Single project ${specificProjectId}`);
  } else {
    const projects = await findProjectsNeedingBackfill(supabase);
    console.log(`Found ${projects.length} project(s) needing backfill`);
  }
  console.log('');

  const summary: BackfillSummary = await runBackfill(supabase, {
    dryRun,
    projectId: specificProjectId || undefined,
    allProjects: !specificProjectId,
    executedBy: 'CLI script',
  });

  console.log('===========================================');
  console.log('  Summary');
  console.log('===========================================');

  for (const r of summary.results) {
    console.log(`${r.projectName}:`);
    console.log(`  Unit types created: ${r.unitTypesCreated}`);
    console.log(`  Units updated: ${r.unitsUpdated}`);
    if (r.errors.length > 0) {
      console.log(`  Errors: ${r.errors.length}`);
      for (const e of r.errors) {
        console.log(`    - ${e}`);
      }
    }
  }

  console.log('');
  console.log(`Total: ${summary.totalUnitTypesCreated} unit types created, ${summary.totalUnitsUpdated} units updated`);

  if (dryRun) {
    console.log('');
    console.log('This was a DRY RUN. No changes were made.');
    console.log('Run without --dry-run to apply changes.');
  }
}

main().catch(console.error);
