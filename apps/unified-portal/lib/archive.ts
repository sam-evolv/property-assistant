/**
 * Smart Archive Backend Helpers
 * 
 * Provides functions for fetching and organizing documents by discipline
 * for the developer dashboard Smart Archive feature.
 */

import { createServerSupabaseClient } from './supabase-server';

export type DisciplineType = 
  | 'architectural'
  | 'engineering'
  | 'electrical'
  | 'mechanical'
  | 'planning'
  | 'civils'
  | 'as-builts'
  | 'handover'
  | 'important'
  | 'uncategorized';

export interface DisciplineSummary {
  discipline: DisciplineType;
  displayName: string;
  fileCount: number;
  lastUpdated: string | null;
}

export interface ArchiveDocument {
  id: string;
  title: string;
  file_name: string;
  file_url: string | null;
  storage_url: string | null;
  discipline: string | null;
  revision_code: string | null;
  doc_kind: string | null;
  house_type_code: string | null;
  is_important: boolean;
  mime_type: string | null;
  size_kb: number | null;
  created_at: string;
  updated_at: string;
}

export interface FetchDocumentsResult {
  documents: ArchiveDocument[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const DISCIPLINES: Record<DisciplineType, { label: string; description: string }> = {
  architectural: { label: 'Architectural', description: 'Floor plans, elevations, sections' },
  engineering: { label: 'Engineering', description: 'Structural calculations and drawings' },
  electrical: { label: 'Electrical', description: 'Electrical layouts and specifications' },
  mechanical: { label: 'Mechanical', description: 'HVAC and plumbing systems' },
  planning: { label: 'Planning', description: 'Planning permissions and applications' },
  civils: { label: 'Civils', description: 'Site works and civil engineering' },
  'as-builts': { label: 'As-Builts', description: 'As-built drawings and records' },
  handover: { label: 'Handover Docs', description: 'Completion and handover documentation' },
  important: { label: 'Important / Must Read', description: 'Critical documents for residents' },
  uncategorized: { label: 'Uncategorized', description: 'Documents pending categorization' },
};

export function getDisciplineDisplayName(discipline: string | null): string {
  if (!discipline) return 'Uncategorized';
  const key = discipline.toLowerCase() as DisciplineType;
  return DISCIPLINES[key]?.label || discipline;
}

/**
 * Fetches discipline summaries with file counts for the archive grid
 */
export async function fetchArchiveDisciplines({
  tenantId,
  developmentId,
}: {
  tenantId: string;
  developmentId?: string | null;
}): Promise<DisciplineSummary[]> {
  const supabase = await createServerSupabaseClient();
  
  let query = supabase
    .from('documents')
    .select('discipline, created_at')
    .eq('tenant_id', tenantId)
    .eq('status', 'active');
  
  if (developmentId) {
    query = query.eq('development_id', developmentId);
  }
  
  const { data: docs, error } = await query;
  
  if (error) {
    console.error('[Archive] Error fetching disciplines:', error);
    throw error;
  }
  
  // Group documents by discipline
  const disciplineMap = new Map<string, { count: number; lastUpdated: string | null }>();
  
  // Initialize all disciplines with 0 count
  Object.keys(DISCIPLINES).forEach(disc => {
    disciplineMap.set(disc, { count: 0, lastUpdated: null });
  });
  
  // Count documents per discipline
  (docs || []).forEach(doc => {
    const disc = doc.discipline?.toLowerCase() || 'uncategorized';
    const key = Object.keys(DISCIPLINES).includes(disc) ? disc : 'uncategorized';
    
    const current = disciplineMap.get(key) || { count: 0, lastUpdated: null };
    current.count++;
    
    if (!current.lastUpdated || (doc.created_at && doc.created_at > current.lastUpdated)) {
      current.lastUpdated = doc.created_at;
    }
    
    disciplineMap.set(key, current);
  });
  
  // Convert to array and sort by count (descending)
  const summaries: DisciplineSummary[] = [];
  
  disciplineMap.forEach((value, key) => {
    summaries.push({
      discipline: key as DisciplineType,
      displayName: DISCIPLINES[key as DisciplineType]?.label || key,
      fileCount: value.count,
      lastUpdated: value.lastUpdated,
    });
  });
  
  // Sort: important first, then by file count descending
  summaries.sort((a, b) => {
    if (a.discipline === 'important') return -1;
    if (b.discipline === 'important') return 1;
    return b.fileCount - a.fileCount;
  });
  
  return summaries;
}

/**
 * Fetches documents for a specific discipline with pagination
 */
export async function fetchDocumentsByDiscipline({
  tenantId,
  developmentId,
  discipline,
  page = 1,
  pageSize = 20,
}: {
  tenantId: string;
  developmentId?: string | null;
  discipline: string;
  page?: number;
  pageSize?: number;
}): Promise<FetchDocumentsResult> {
  const supabase = await createServerSupabaseClient();
  const offset = (page - 1) * pageSize;
  
  let query = supabase
    .from('documents')
    .select('id, title, file_name, file_url, storage_url, discipline, revision_code, doc_kind, house_type_code, is_important, mime_type, size_kb, created_at, updated_at', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .eq('status', 'active');
  
  if (developmentId) {
    query = query.eq('development_id', developmentId);
  }
  
  // Handle discipline filtering
  if (discipline === 'important') {
    query = query.eq('is_important', true);
  } else if (discipline === 'uncategorized') {
    query = query.is('discipline', null);
  } else {
    query = query.ilike('discipline', discipline);
  }
  
  // Add pagination and ordering
  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1);
  
  const { data: documents, count, error } = await query;
  
  if (error) {
    console.error('[Archive] Error fetching documents:', error);
    throw error;
  }
  
  const totalCount = count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);
  
  return {
    documents: (documents || []) as ArchiveDocument[],
    totalCount,
    page,
    pageSize,
    totalPages,
  };
}

/**
 * Updates a document's discipline
 */
export async function updateDocumentDiscipline({
  documentId,
  discipline,
  tenantId,
}: {
  documentId: string;
  discipline: DisciplineType;
  tenantId: string;
}): Promise<void> {
  const supabase = await createServerSupabaseClient();
  
  const { error } = await supabase
    .from('documents')
    .update({ discipline, updated_at: new Date().toISOString() })
    .eq('id', documentId)
    .eq('tenant_id', tenantId);
  
  if (error) {
    console.error('[Archive] Error updating discipline:', error);
    throw error;
  }
}
