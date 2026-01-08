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

interface BackfillResult {
  projectId: string;
  projectName: string;
  unitTypesCreated: number;
  unitsUpdated: number;
  errors: string[];
}

function normalizeTypeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

async function getDistinctUnitTypeNames(projectId: string): Promise<string[]> {
  const { data: units, error } = await supabase
    .from('units')
    .select('id, address, unit_type_id')
    .eq('project_id', projectId);

  if (error || !units) {
    console.error(`  Failed to fetch units: ${error?.message}`);
    return [];
  }

  const { data: unitTypesRaw } = await supabase.rpc('sql', {
    query: `
      SELECT DISTINCT 
        COALESCE(
          (metadata->>'unit_type')::text,
          (metadata->>'house_type')::text,
          split_part(address, ' - ', 2)
        ) as type_name
      FROM units 
      WHERE project_id = '${projectId}'
      AND (
        (metadata->>'unit_type') IS NOT NULL 
        OR (metadata->>'house_type') IS NOT NULL
      )
    `
  });

  if (unitTypesRaw && Array.isArray(unitTypesRaw)) {
    return unitTypesRaw
      .map((r: any) => r.type_name)
      .filter((t: string | null) => t && t.trim().length > 0);
  }

  const { data: unitsWithMeta } = await supabase
    .from('units')
    .select('id, address, metadata')
    .eq('project_id', projectId);

  const typeSet = new Set<string>();
  
  for (const u of unitsWithMeta || []) {
    const meta = u.metadata as Record<string, any> | null;
    const typeName = meta?.unit_type || meta?.house_type || meta?.type;
    
    if (typeName && typeof typeName === 'string' && typeName.trim()) {
      typeSet.add(typeName.trim());
    }
  }

  return Array.from(typeSet);
}

async function backfillProjectUnitTypes(
  projectId: string,
  dryRun: boolean
): Promise<BackfillResult> {
  const result: BackfillResult = {
    projectId,
    projectName: '',
    unitTypesCreated: 0,
    unitsUpdated: 0,
    errors: [],
  };

  try {
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      result.errors.push(`Project not found: ${projectId}`);
      return result;
    }
    result.projectName = project.name;

    const { data: existingTypes } = await supabase
      .from('unit_types')
      .select('id, name')
      .eq('project_id', projectId);

    const existingTypeMap = new Map<string, string>();
    for (const ut of existingTypes || []) {
      existingTypeMap.set(normalizeTypeName(ut.name), ut.id);
    }

    const { data: units } = await supabase
      .from('units')
      .select('id, address, unit_type_id, metadata')
      .eq('project_id', projectId);

    if (!units || units.length === 0) {
      console.log(`  [${project.name}] No units found, skipping`);
      return result;
    }

    const unitsNeedingTypeId = units.filter(u => !u.unit_type_id);
    
    console.log(`  [${project.name}] ${units.length} units, ${existingTypes?.length || 0} existing types, ${unitsNeedingTypeId.length} units needing type_id`);

    const distinctTypeNames = await getDistinctUnitTypeNames(projectId);
    
    if (distinctTypeNames.length === 0) {
      const fallbackTypes = new Set<string>();
      for (const u of units) {
        const meta = u.metadata as Record<string, any> | null;
        if (meta?.unit_type) fallbackTypes.add(meta.unit_type);
        else if (meta?.house_type) fallbackTypes.add(meta.house_type);
        else if (meta?.type) fallbackTypes.add(meta.type);
      }
      
      if (fallbackTypes.size === 0) {
        console.log(`  [${project.name}] No unit type information found in units, skipping`);
        return result;
      }
      
      distinctTypeNames.push(...Array.from(fallbackTypes));
    }

    console.log(`  [${project.name}] Found ${distinctTypeNames.length} distinct unit type values`);

    for (const typeName of distinctTypeNames) {
      if (!typeName) continue;
      
      const normalized = normalizeTypeName(typeName);
      if (existingTypeMap.has(normalized)) {
        console.log(`    Unit type "${typeName}" already exists`);
        continue;
      }

      if (dryRun) {
        console.log(`    [DRY-RUN] Would create unit type: ${typeName}`);
        result.unitTypesCreated++;
        existingTypeMap.set(normalized, 'dry-run-id');
        continue;
      }

      const { data: inserted, error: insertError } = await supabase
        .from('unit_types')
        .insert({
          project_id: projectId,
          name: typeName,
          floor_plan_pdf_url: null,
        })
        .select()
        .single();

      if (insertError) {
        if (insertError.code === '23505') {
          console.log(`    Unit type "${typeName}" already exists (concurrent creation)`);
          const { data: existing } = await supabase
            .from('unit_types')
            .select('id, name')
            .eq('project_id', projectId);
          
          for (const ut of existing || []) {
            if (normalizeTypeName(ut.name) === normalized) {
              existingTypeMap.set(normalized, ut.id);
              break;
            }
          }
        } else {
          result.errors.push(`Failed to create unit type "${typeName}": ${insertError.message}`);
        }
      } else if (inserted) {
        console.log(`    Created unit type: ${typeName}`);
        existingTypeMap.set(normalized, inserted.id);
        result.unitTypesCreated++;
      }
    }

    for (const unit of unitsNeedingTypeId) {
      const meta = unit.metadata as Record<string, any> | null;
      const unitTypeName = meta?.unit_type || meta?.house_type || meta?.type;
      
      if (!unitTypeName) {
        continue;
      }

      const normalized = normalizeTypeName(unitTypeName);
      const typeId = existingTypeMap.get(normalized);

      if (!typeId || typeId === 'dry-run-id') {
        if (dryRun && typeId === 'dry-run-id') {
          console.log(`    [DRY-RUN] Would assign unit "${unit.address}" to type "${unitTypeName}"`);
          result.unitsUpdated++;
        }
        continue;
      }

      if (dryRun) {
        console.log(`    [DRY-RUN] Would assign unit "${unit.address}" to type "${unitTypeName}" (${typeId})`);
        result.unitsUpdated++;
        continue;
      }

      const { error: updateError } = await supabase
        .from('units')
        .update({ unit_type_id: typeId })
        .eq('id', unit.id);

      if (updateError) {
        result.errors.push(`Failed to update unit "${unit.address}": ${updateError.message}`);
      } else {
        result.unitsUpdated++;
      }
    }

    console.log(`  [${project.name}] Created ${result.unitTypesCreated} types, updated ${result.unitsUpdated} units`);

    return result;
  } catch (err) {
    result.errors.push(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
    return result;
  }
}

async function findProjectsNeedingBackfill(): Promise<{ id: string; name: string }[]> {
  const { data: projects, error } = await supabase
    .from('projects')
    .select('id, name');

  if (error || !projects) {
    console.error('Failed to fetch projects:', error);
    return [];
  }

  const needsBackfill: { id: string; name: string }[] = [];

  for (const project of projects) {
    const { count: unitCount } = await supabase
      .from('units')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', project.id);

    const { count: typeCount } = await supabase
      .from('unit_types')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', project.id);

    const { count: unlinkedCount } = await supabase
      .from('units')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', project.id)
      .is('unit_type_id', null);

    if ((unitCount || 0) > 0 && ((typeCount || 0) === 0 || (unlinkedCount || 0) > 0)) {
      needsBackfill.push(project);
    }
  }

  return needsBackfill;
}

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

  let projects: { id: string; name: string }[] = [];

  if (specificProjectId) {
    const { data: project } = await supabase
      .from('projects')
      .select('id, name')
      .eq('id', specificProjectId)
      .single();

    if (project) {
      projects = [project];
    } else {
      console.error(`Project not found: ${specificProjectId}`);
      process.exit(1);
    }
  } else {
    projects = await findProjectsNeedingBackfill();
  }

  console.log(`Found ${projects.length} project(s) needing backfill:`);
  for (const p of projects) {
    console.log(`  - ${p.name} (${p.id})`);
  }
  console.log('');

  const results: BackfillResult[] = [];

  for (const project of projects) {
    console.log(`Processing: ${project.name}`);
    const result = await backfillProjectUnitTypes(project.id, dryRun);
    results.push(result);
    console.log('');
  }

  console.log('===========================================');
  console.log('  Summary');
  console.log('===========================================');

  let totalCreated = 0;
  let totalUpdated = 0;
  let totalErrors = 0;

  for (const r of results) {
    console.log(`${r.projectName}:`);
    console.log(`  Unit types created: ${r.unitTypesCreated}`);
    console.log(`  Units updated: ${r.unitsUpdated}`);
    if (r.errors.length > 0) {
      console.log(`  Errors: ${r.errors.length}`);
      for (const e of r.errors) {
        console.log(`    - ${e}`);
      }
    }
    totalCreated += r.unitTypesCreated;
    totalUpdated += r.unitsUpdated;
    totalErrors += r.errors.length;
  }

  console.log('');
  console.log(`Total: ${totalCreated} unit types created, ${totalUpdated} units updated, ${totalErrors} errors`);

  if (dryRun) {
    console.log('');
    console.log('This was a DRY RUN. No changes were made.');
    console.log('Run without --dry-run to apply changes.');
  }
}

main().catch(console.error);
