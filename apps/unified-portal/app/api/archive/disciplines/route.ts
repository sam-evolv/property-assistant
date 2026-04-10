export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface ArchiveDocument {
  id: string;
  title: string;
  file_name: string;
  file_url: string | null;
  storage_url: string | null;
  discipline: string;
  revision_code: string | null;
  doc_kind: string | null;
  house_type_code: string | null;
  is_important: boolean;
  must_read: boolean;
  ai_classified: boolean;
  folder_id: string | null;
  mime_type: string;
  size_kb: number | null;
  created_at: string;
  updated_at: string;
}

interface DisciplineSummary {
  discipline: string;
  displayName: string;
  fileCount: number;
  lastUpdated: string | null;
}

const DISCIPLINES: Record<string, { label: string; description: string }> = {
  architectural: { label: 'Architectural', description: 'Floor plans, elevations, sections, details' },
  structural: { label: 'Structural', description: 'Structural drawings and calculations' },
  mechanical: { label: 'Mechanical', description: 'HVAC and mechanical systems' },
  electrical: { label: 'Electrical', description: 'Electrical layouts and specifications' },
  plumbing: { label: 'Plumbing', description: 'Plumbing and drainage systems' },
  civil: { label: 'Civil', description: 'Site plans and civil engineering' },
  landscape: { label: 'Landscape', description: 'Landscape and external works' },
  handover: { label: 'Handover Documentation', description: 'Warranties, manuals, certificates' },
  other: { label: 'Other', description: 'Miscellaneous documents' },
};

const VALID_DISCIPLINES = ['architectural', 'structural', 'mechanical', 'electrical', 'plumbing', 'civil', 'landscape', 'handover', 'other'];

const DEVELOPMENT_TO_SUPABASE_PROJECT: Record<string, string> = {
  // Longview Park: development_id -> project_id (1,132 chunks)
  '34316432-f1e8-4297-b993-d9b5c88ee2d8': '57dc3919-2725-4575-8046-9179075ac88e',
  // Rathard Park: development_id -> project_id (864 chunks)
  'e0833063-55ac-4201-a50e-f329c090fbd6': '6d3789de-2e46-430c-bf31-22224bd878da',
  // Rathard Lawn: development_id -> project_id (814 chunks)
  '39c49eeb-54a6-4b04-a16a-119012c531cb': '9598cf36-3e3f-4b7d-be6d-d1e80f708f46',
  // Árdan View: development_id = project_id (946 chunks)
  '84a559d1-89f1-4eb6-a48b-7ca068bcc164': '84a559d1-89f1-4eb6-a48b-7ca068bcc164',
};

function getSupabaseProjectId(developmentId: string): string {
  const mapped = DEVELOPMENT_TO_SUPABASE_PROJECT[developmentId];
  if (mapped) {
    return mapped;
  }
  return developmentId;
}

/**
 * Resolves a Drizzle development ID to the corresponding Supabase project ID.
 * Strategy: name-based lookup FIRST (most reliable), then hardcoded mapping fallback.
 */
async function resolveProjectId(
  supabase: ReturnType<typeof getSupabaseClient>,
  developmentId: string,
  tenantId: string,
): Promise<string> {
  // Step 1: Get the development name
  const { data: dev } = await supabase
    .from('developments')
    .select('id, name')
    .eq('id', developmentId)
    .eq('tenant_id', tenantId)
    .single();

  // Step 2: Look up project by name (most reliable since names are human-readable)
  if (dev?.name) {
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('name', dev.name)
      .maybeSingle();

    if (project?.id) {
      return project.id;
    }
  }

  // Step 3: Fall back to hardcoded mapping
  const mapped = DEVELOPMENT_TO_SUPABASE_PROJECT[developmentId];
  if (mapped) {
    return mapped;
  }

  // Step 4: Identity fallback
  return developmentId;
}

/**
 * Resolves all Supabase project IDs for a tenant (used for "All Schemes").
 */
async function resolveAllProjectIds(
  supabase: ReturnType<typeof getSupabaseClient>,
  tenantId: string,
): Promise<string[]> {
  const projectIds = new Set<string>();

  // Get all developments for this tenant and resolve each
  const { data: tenantDevs } = await supabase
    .from('developments')
    .select('id, name')
    .eq('tenant_id', tenantId);

  if (tenantDevs) {
    for (const dev of tenantDevs) {
      // Try name-based lookup first
      if (dev.name) {
        const { data: project } = await supabase
          .from('projects')
          .select('id')
          .eq('name', dev.name)
          .maybeSingle();
        if (project?.id) {
          projectIds.add(project.id);
          continue;
        }
      }
      // Fall back to hardcoded mapping
      projectIds.add(getSupabaseProjectId(dev.id));
    }
  }

  return Array.from(projectIds);
}

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase configuration missing. Please check environment variables.');
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

function createArchiveDocument(section: any, projectId: string): ArchiveDocument {
  const source = section.metadata?.source || section.metadata?.file_name || 'Unknown';
  const rawDiscipline = section.metadata?.discipline?.toLowerCase() || 'other';
  return {
    id: section.id,
    title: source,
    file_name: section.metadata?.file_name || source,
    file_url: section.metadata?.file_url || null,
    storage_url: section.metadata?.file_url || null,
    discipline: rawDiscipline,
    revision_code: null,
    doc_kind: section.metadata?.doc_kind || 'specification',
    house_type_code: section.metadata?.house_type_code || null,
    is_important: section.metadata?.is_important === true,
    must_read: section.metadata?.must_read === true,
    ai_classified: section.metadata?.ai_classified === true,
    folder_id: section.metadata?.folder_id || null,
    mime_type: 'application/pdf',
    size_kb: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

async function fetchDocuments(params: {
  tenantId: string;
  developmentId?: string | null;
  discipline?: string;
  folderId?: string;
  page?: number;
  pageSize?: number;
  searchQuery?: string;
}) {
  const { tenantId, developmentId, discipline, folderId, page = 1, pageSize = 50, searchQuery } = params;
  
  // SECURITY: Tenant filtering is mandatory
  if (!tenantId) {
    return { documents: [], totalCount: 0, page, pageSize, totalPages: 0 };
  }
  
  try {
    const supabase = getSupabaseClient();
    
    // SECURITY: Get allowed project IDs for this tenant
    let allowedProjectIds: string[] = [];
    
    if (developmentId) {
      const projectId = await resolveProjectId(supabase, developmentId, tenantId);
      allowedProjectIds = [projectId];
    } else {
      allowedProjectIds = await resolveAllProjectIds(supabase, tenantId);
      if (allowedProjectIds.length === 0) {
        return { documents: [], totalCount: 0, page, pageSize, totalPages: 0 };
      }
    }

    // Query documents with server-side filtering
    // Use .eq() for single project (fixes Supabase .in() bug with single-element arrays)
    let query = supabase.from('document_sections').select('id, metadata, content, project_id');
    if (allowedProjectIds.length === 1) {
      query = query.eq('project_id', allowedProjectIds[0]);
    } else {
      query = query.in('project_id', allowedProjectIds);
    }
    
    const { data: sections, error } = await query;
    
    if (error) {
      return { documents: [], totalCount: 0, page, pageSize, totalPages: 0 };
    }

    const documentMap = new Map<string, ArchiveDocument>();
    
    for (const section of sections || []) {
      const source = section.metadata?.source || section.metadata?.file_name || 'Unknown';
      
      if (!documentMap.has(source)) {
        documentMap.set(source, createArchiveDocument(section, section.project_id || developmentId || 'unknown'));
      }
    }

    let filteredDocs: ArchiveDocument[];
    
    if (folderId) {
      filteredDocs = Array.from(documentMap.values()).filter(doc => doc.folder_id === folderId);
    } else if (discipline) {
      const targetDiscipline = discipline === 'other' ? 'other' : discipline;
      filteredDocs = Array.from(documentMap.values()).filter(doc => {
        const docDisc = doc.discipline ? 
          (VALID_DISCIPLINES.includes(doc.discipline) ? doc.discipline : 'other') : 'other';
        return docDisc === targetDiscipline;
      });
    } else {
      filteredDocs = Array.from(documentMap.values());
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filteredDocs = filteredDocs.filter(doc => 
        doc.title.toLowerCase().includes(q) ||
        doc.file_name.toLowerCase().includes(q)
      );
    }

    const totalCount = filteredDocs.length;
    const totalPages = Math.ceil(totalCount / pageSize);
    const offset = (page - 1) * pageSize;
    const paginatedDocs = filteredDocs.slice(offset, offset + pageSize);
    
    return {
      documents: paginatedDocs,
      totalCount,
      page,
      pageSize,
      totalPages,
    };
  } catch (error) {
    return { documents: [], totalCount: 0, page, pageSize, totalPages: 0 };
  }
}

async function fetchDisciplines(params: {
  tenantId: string;
  developmentId?: string | null;
}): Promise<DisciplineSummary[]> {
  const { tenantId, developmentId } = params;
  
  // SECURITY: Tenant filtering is mandatory
  if (!tenantId) {
    return [];
  }
  
  try {
    const supabase = getSupabaseClient();
    
    // SECURITY: Get allowed project IDs for this tenant
    let allowedProjectIds: string[] = [];
    
    if (developmentId) {
      const projectId = await resolveProjectId(supabase, developmentId, tenantId);
      allowedProjectIds = [projectId];
    } else {
      allowedProjectIds = await resolveAllProjectIds(supabase, tenantId);
      if (allowedProjectIds.length === 0) {
        return [];
      }
    }

    // Query documents with server-side filtering
    // Use .eq() for single project (fixes Supabase .in() bug with single-element arrays)

    let query = supabase.from('document_sections').select('id, metadata, project_id');
    if (allowedProjectIds.length === 1) {
      query = query.eq('project_id', allowedProjectIds[0]);
    } else {
      query = query.in('project_id', allowedProjectIds);
    }
    
    const { data: sections, error } = await query;

    if (error) {
      return [];
    }

    const documentMap = new Map<string, { source: string; discipline: string }>();
    
    for (const section of sections || []) {
      const source = section.metadata?.source || section.metadata?.file_name || 'Unknown';
      if (!documentMap.has(source)) {
        const discipline = section.metadata?.discipline?.toLowerCase() || 'other';
        documentMap.set(source, { source, discipline });
      }
    }

    const disciplineMap = new Map<string, { count: number; lastUpdated: Date | null }>();
    Object.keys(DISCIPLINES).forEach(disc => {
      disciplineMap.set(disc, { count: 0, lastUpdated: null });
    });
    
    documentMap.forEach(doc => {
      const key = VALID_DISCIPLINES.includes(doc.discipline) ? doc.discipline : 'other';
      const current = disciplineMap.get(key) || { count: 0, lastUpdated: null };
      current.count++;
      disciplineMap.set(key, current);
    });
    
    const summaries: DisciplineSummary[] = [];
    
    disciplineMap.forEach((value, key) => {
      summaries.push({
        discipline: key,
        displayName: DISCIPLINES[key]?.label || key,
        fileCount: value.count,
        lastUpdated: value.lastUpdated?.toISOString() || null,
      });
    });
    
    summaries.sort((a, b) => {
      if (b.fileCount !== a.fileCount) {
        return b.fileCount - a.fileCount;
      }
      return a.displayName.localeCompare(b.displayName);
    });
    
    return summaries;
  } catch (error) {
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const tenantId = searchParams.get('tenantId');
    
    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

    if (action === 'documents') {
      const developmentId = searchParams.get('developmentId');
      const discipline = searchParams.get('discipline');
      const folderId = searchParams.get('folderId');
      const page = parseInt(searchParams.get('page') || '1', 10);
      const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
      const searchQuery = searchParams.get('searchQuery') || undefined;

      if (!discipline && !folderId) {
        return NextResponse.json(
          { error: 'discipline or folderId is required when action=documents' },
          { status: 400 }
        );
      }

      const result = await fetchDocuments({
        tenantId,
        developmentId,
        discipline: discipline || undefined,
        folderId: folderId || undefined,
        page,
        pageSize,
        searchQuery,
      });

      return NextResponse.json(result);
    }

    const mode = searchParams.get('mode');
    const schemeId = searchParams.get('schemeId');
    const legacyDevelopmentId = searchParams.get('developmentId');

    if (!mode) {
      return NextResponse.json(
        { error: 'mode is required. Must be "ALL_SCHEMES" or "SCHEME"' },
        { status: 400 }
      );
    }

    if (mode && mode !== 'ALL_SCHEMES' && mode !== 'SCHEME') {
      return NextResponse.json(
        { error: 'Invalid mode. Must be "ALL_SCHEMES" or "SCHEME"' },
        { status: 400 }
      );
    }

    if (mode === 'SCHEME' && !schemeId) {
      return NextResponse.json(
        { error: 'schemeId is required when mode is SCHEME' },
        { status: 400 }
      );
    }

    const developmentId = mode === 'SCHEME' ? schemeId : (legacyDevelopmentId || null);

    const disciplines = await fetchDisciplines({
      tenantId,
      developmentId,
    });

    return NextResponse.json({ disciplines });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch data' },
      { status: 500 }
    );
  }
}
