/**
 * Smart Archive Backend Helpers (Server-only)
 * 
 * Provides functions for fetching and organizing documents by discipline
 * for the developer dashboard Smart Archive feature.
 * 
 * NOTE: This file uses server-only dependencies (next/headers).
 * For client components, import from './archive-constants' instead.
 */

import { createServerSupabaseClient } from './supabase-server';
import { 
  DISCIPLINES, 
  type DisciplineType, 
  type DisciplineSummary, 
  type ArchiveDocument, 
  type FetchDocumentsResult 
} from './archive-constants';

export { 
  DISCIPLINES, 
  getDisciplineDisplayName, 
  getDisciplineInfo,
  type DisciplineType, 
  type DisciplineSummary, 
  type ArchiveDocument, 
  type FetchDocumentsResult 
} from './archive-constants';

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
 * Fetches documents for a specific discipline with pagination and filters
 */
export async function fetchDocumentsByDiscipline({
  tenantId,
  developmentId,
  discipline,
  page = 1,
  pageSize = 20,
  houseTypeCode,
  important,
  mustRead,
  aiClassified,
}: {
  tenantId: string;
  developmentId?: string | null;
  discipline: string;
  page?: number;
  pageSize?: number;
  houseTypeCode?: string | null;
  important?: boolean;
  mustRead?: boolean;
  aiClassified?: boolean;
}): Promise<FetchDocumentsResult> {
  const supabase = await createServerSupabaseClient();
  const offset = (page - 1) * pageSize;
  
  let query = supabase
    .from('documents')
    .select('id, title, file_name, file_url, storage_url, discipline, revision_code, doc_kind, house_type_code, is_important, must_read, ai_classified, mime_type, size_kb, created_at, updated_at', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .eq('status', 'active');
  
  if (developmentId) {
    query = query.eq('development_id', developmentId);
  }
  
  // Handle discipline filtering
  if (discipline === 'other') {
    query = query.or('discipline.is.null,discipline.not.in.(architectural,structural,mechanical,electrical,plumbing,civil,landscape)');
  } else {
    query = query.ilike('discipline', discipline);
  }

  // Apply additional filters
  if (houseTypeCode) {
    query = query.eq('house_type_code', houseTypeCode);
  }
  if (important) {
    query = query.eq('is_important', true);
  }
  if (mustRead) {
    query = query.eq('must_read', true);
  }
  if (aiClassified) {
    query = query.eq('ai_classified', true);
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

  const processedDocs = await Promise.all((documents || []).map(async (doc: Record<string, unknown>) => {
    let resolvedUrl = doc.file_url as string | null;
    
    if (!resolvedUrl && doc.storage_url) {
      const storagePath = doc.storage_url as string;
      if (storagePath.startsWith('tenant/')) {
        const { data } = await supabase.storage
          .from('documents')
          .createSignedUrl(storagePath, 3600);
        resolvedUrl = data?.signedUrl || null;
      } else {
        resolvedUrl = storagePath;
      }
    }
    
    return {
      ...doc,
      file_url: resolvedUrl,
      storage_url: doc.storage_url,
    } as ArchiveDocument;
  }));
  
  return {
    documents: processedDocs,
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
