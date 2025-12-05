/**
 * Smart Archive Backend Helpers
 * 
 * Provides functions for fetching and organizing documents by discipline
 * for the developer dashboard Smart Archive feature.
 */

import { createServerSupabaseClient } from './supabase-server';

export type DisciplineType = 
  | 'architectural'
  | 'structural'
  | 'mechanical'
  | 'electrical'
  | 'plumbing'
  | 'civil'
  | 'landscape'
  | 'other';

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

export const DISCIPLINES: Record<DisciplineType, { label: string; description: string; icon: string; color: string }> = {
  architectural: { label: 'Architectural', description: 'Floor plans, elevations, sections, details', icon: 'Building2', color: 'blue' },
  structural: { label: 'Structural', description: 'Structural drawings, calculations, foundations', icon: 'Hammer', color: 'orange' },
  mechanical: { label: 'Mechanical', description: 'HVAC systems, ventilation, heating', icon: 'Cog', color: 'green' },
  electrical: { label: 'Electrical', description: 'Electrical layouts, lighting, power systems', icon: 'Zap', color: 'yellow' },
  plumbing: { label: 'Plumbing', description: 'Water supply, drainage, sanitary systems', icon: 'Droplet', color: 'cyan' },
  civil: { label: 'Civil', description: 'Site works, roads, drainage, earthworks', icon: 'Mountain', color: 'brown' },
  landscape: { label: 'Landscape', description: 'Landscaping plans, planting, hardscape', icon: 'Trees', color: 'emerald' },
  other: { label: 'Other', description: 'Other documents and uncategorized files', icon: 'Files', color: 'gray' },
};

export function getDisciplineDisplayName(discipline: string | null): string {
  if (!discipline) return 'Other';
  const key = discipline.toLowerCase() as DisciplineType;
  return DISCIPLINES[key]?.label || discipline;
}

export function getDisciplineInfo(discipline: string | null): { label: string; description: string; icon: string; color: string } {
  if (!discipline) return DISCIPLINES.other;
  const key = discipline.toLowerCase() as DisciplineType;
  return DISCIPLINES[key] || DISCIPLINES.other;
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
    const disc = doc.discipline?.toLowerCase() || 'other';
    const key = Object.keys(DISCIPLINES).includes(disc) ? disc : 'other';
    
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
  
  // Sort by file count descending, then alphabetically
  summaries.sort((a, b) => {
    if (b.fileCount !== a.fileCount) {
      return b.fileCount - a.fileCount;
    }
    return a.displayName.localeCompare(b.displayName);
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
  if (discipline === 'other') {
    // 'other' includes null/empty disciplines and any non-standard disciplines
    query = query.or('discipline.is.null,discipline.not.in.(architectural,structural,mechanical,electrical,plumbing,civil,landscape)');
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
