import { SupabaseClient } from '@supabase/supabase-js';

export interface BackfillResult {
  projectId: string;
  projectName: string;
  unitTypesCreated: number;
  unitsUpdated: number;
  errors: string[];
}

export interface BackfillSummary {
  mode: 'dry-run' | 'apply';
  projectsProcessed: number;
  totalUnitTypesCreated: number;
  totalUnitsUpdated: number;
  results: BackfillResult[];
  executedAt: string;
  executedBy: string;
}

export function normalizeTypeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

async function getDistinctUnitTypeNamesFromMetadata(
  supabase: SupabaseClient,
  projectId: string
): Promise<string[]> {
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

export async function backfillProjectUnitTypes(
  supabase: SupabaseClient,
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
      return result;
    }

    const unitsNeedingTypeId = units.filter(u => !u.unit_type_id);

    const distinctTypeNames = await getDistinctUnitTypeNamesFromMetadata(supabase, projectId);

    if (distinctTypeNames.length === 0) {
      return result;
    }

    for (const typeName of distinctTypeNames) {
      if (!typeName) continue;
      
      const normalized = normalizeTypeName(typeName);
      if (existingTypeMap.has(normalized)) {
        continue;
      }

      if (dryRun) {
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
          result.unitsUpdated++;
        }
        continue;
      }

      if (dryRun) {
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

    return result;
  } catch (err) {
    result.errors.push(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
    return result;
  }
}

export async function findProjectsNeedingBackfill(
  supabase: SupabaseClient
): Promise<{ id: string; name: string }[]> {
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

export async function runBackfill(
  supabase: SupabaseClient,
  options: {
    dryRun: boolean;
    projectId?: string;
    allProjects?: boolean;
    executedBy: string;
  }
): Promise<BackfillSummary> {
  const summary: BackfillSummary = {
    mode: options.dryRun ? 'dry-run' : 'apply',
    projectsProcessed: 0,
    totalUnitTypesCreated: 0,
    totalUnitsUpdated: 0,
    results: [],
    executedAt: new Date().toISOString(),
    executedBy: options.executedBy,
  };

  let projects: { id: string; name: string }[] = [];

  if (options.projectId) {
    const { data: project } = await supabase
      .from('projects')
      .select('id, name')
      .eq('id', options.projectId)
      .single();

    if (project) {
      projects = [project];
    }
  } else if (options.allProjects) {
    projects = await findProjectsNeedingBackfill(supabase);
  }

  for (const project of projects) {
    const result = await backfillProjectUnitTypes(supabase, project.id, options.dryRun);
    summary.results.push(result);
    summary.projectsProcessed++;
    summary.totalUnitTypesCreated += result.unitTypesCreated;
    summary.totalUnitsUpdated += result.unitsUpdated;
  }

  return summary;
}
