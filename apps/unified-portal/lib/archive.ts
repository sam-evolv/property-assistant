/**
 * Smart Archive Backend Helpers (Server-only)
 * 
 * Provides functions for fetching and organizing documents by discipline
 * for the developer dashboard Smart Archive feature.
 * 
 * MIGRATED TO SUPABASE - Now reads from document_sections table
 */

import { createClient } from '@supabase/supabase-js';
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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// SINGLE SOURCE OF TRUTH - hardcoded Launch project ID
const PROJECT_ID = '57dc3919-2725-4575-8046-9179075ac88e';
const VALID_DISCIPLINES = ['architectural', 'structural', 'mechanical', 'electrical', 'plumbing', 'civil', 'landscape', 'handover', 'other'];

/**
 * Fetches discipline summaries with file counts for the archive grid
 * NOW READS FROM SUPABASE document_sections
 * ALWAYS uses hardcoded Launch ID - ignores developmentId param
 */
export async function fetchArchiveDisciplines({
  tenantId,
  developmentId,
}: {
  tenantId: string;
  developmentId?: string | null;
}): Promise<DisciplineSummary[]> {
  try {
    // ALWAYS use hardcoded Launch project ID for Supabase
    const projectId = PROJECT_ID;
    console.log('🔥 [Archive] Fetching disciplines for PROJECT_ID:', projectId);
    
    const { data: sections, error } = await supabase
      .from('document_sections')
      .select('id, metadata')
      .eq('project_id', projectId);

    if (error) {
      console.error('[Archive] Supabase error:', error.message);
      return [];
    }

    // Group by unique source documents
    const documentMap = new Map<string, { source: string; discipline: string }>();
    
    for (const section of sections || []) {
      const source = section.metadata?.source || section.metadata?.file_name || 'Unknown';
      if (!documentMap.has(source)) {
        // Try to infer discipline from metadata or default to 'other'
        const discipline = section.metadata?.discipline?.toLowerCase() || 'other';
        documentMap.set(source, { source, discipline });
      }
    }

    console.log('[Archive] Found', documentMap.size, 'unique documents from Supabase');

    // Initialize all disciplines with 0 count
    const disciplineMap = new Map<string, { count: number; lastUpdated: Date | null }>();
    Object.keys(DISCIPLINES).forEach(disc => {
      disciplineMap.set(disc, { count: 0, lastUpdated: null });
    });
    
    // Count documents per discipline
    documentMap.forEach(doc => {
      const key = VALID_DISCIPLINES.includes(doc.discipline) ? doc.discipline : 'other';
      const current = disciplineMap.get(key) || { count: 0, lastUpdated: null };
      current.count++;
      disciplineMap.set(key, current);
    });
    
    // Convert to array and sort by count (descending)
    const summaries: DisciplineSummary[] = [];
    
    disciplineMap.forEach((value, key) => {
      summaries.push({
        discipline: key as DisciplineType,
        displayName: DISCIPLINES[key as DisciplineType]?.label || key,
        fileCount: value.count,
        lastUpdated: value.lastUpdated?.toISOString() || null,
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
  } catch (error) {
    console.error('[Archive] Error fetching disciplines:', error);
    return [];
  }
}

function createArchiveDocument(section: any, projectId: string): ArchiveDocument {
  const source = section.metadata?.source || section.metadata?.file_name || 'Unknown';
  return {
    id: section.id,
    title: source,
    file_name: section.metadata?.file_name || source,
    file_url: section.metadata?.file_url || null,
    storage_url: section.metadata?.file_url || null,
    discipline: section.metadata?.discipline || 'other',
    revision_code: null,
    doc_kind: section.metadata?.doc_kind || 'specification',
    house_type_code: null,
    is_important: false,
    must_read: false,
    ai_classified: false,
    mime_type: 'application/pdf',
    size_kb: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Fetches documents for a specific discipline
 * NOW READS FROM SUPABASE document_sections
 */
export async function fetchDocumentsByDiscipline({
  tenantId,
  developmentId,
  discipline,
  page = 1,
  pageSize,
  limit,
  searchQuery,
  houseTypeCode,
  important,
  mustRead,
  aiClassified,
}: {
  tenantId: string;
  developmentId?: string | null;
  discipline: DisciplineType | string;
  page?: number;
  pageSize?: number;
  limit?: number;
  searchQuery?: string;
  houseTypeCode?: string | null;
  important?: boolean;
  mustRead?: boolean;
  aiClassified?: boolean;
}): Promise<FetchDocumentsResult> {
  // Use pageSize if provided, otherwise fall back to limit, otherwise default to 50
  const effectiveLimit = pageSize || limit || 50;
  
  try {
    // ALWAYS use hardcoded Launch project ID
    const projectId = PROJECT_ID;
    console.log('📂 Fetching documents for:', projectId);
    
    const { data: sections, error } = await supabase
      .from('document_sections')
      .select('id, metadata, content')
      .eq('project_id', projectId);

    if (error) {
      console.error('[Archive] Supabase error:', error.message);
      return { documents: [], totalCount: 0, page, pageSize: effectiveLimit, totalPages: 0 };
    }

    // Group by unique source documents
    const documentMap = new Map<string, ArchiveDocument>();
    
    for (const section of sections || []) {
      const source = section.metadata?.source || section.metadata?.file_name || 'Unknown';
      
      if (!documentMap.has(source)) {
        documentMap.set(source, createArchiveDocument(section, projectId));
      }
    }

    // Filter by discipline
    const targetDiscipline = discipline === 'other' ? 'other' : discipline;
    let filteredDocs = Array.from(documentMap.values()).filter(doc => {
      const docDisc = doc.discipline ? 
        (VALID_DISCIPLINES.includes(doc.discipline) ? doc.discipline : 'other') : 'other';
      return docDisc === targetDiscipline;
    });

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredDocs = filteredDocs.filter(doc => 
        doc.title.toLowerCase().includes(query) ||
        doc.file_name.toLowerCase().includes(query)
      );
    }

    // Pagination
    const totalCount = filteredDocs.length;
    const totalPages = Math.ceil(totalCount / effectiveLimit);
    const offset = (page - 1) * effectiveLimit;
    const paginatedDocs = filteredDocs.slice(offset, offset + effectiveLimit);
    
    console.log('✅ Found:', filteredDocs.length, 'documents, returning', paginatedDocs.length);

    return {
      documents: paginatedDocs,
      totalCount,
      page,
      pageSize: effectiveLimit,
      totalPages,
    };
  } catch (error) {
    console.error('[Archive] Error fetching documents:', error);
    return { documents: [], totalCount: 0, page, pageSize: effectiveLimit, totalPages: 0 };
  }
}

/**
 * Counts total documents in the archive
 * NOW READS FROM SUPABASE document_sections
 */
export async function countArchiveDocuments({
  tenantId,
  developmentId,
}: {
  tenantId: string;
  developmentId?: string | null;
}): Promise<{ total: number; indexed: number; errors: number }> {
  try {
    // ALWAYS use hardcoded Launch project ID
    const projectId = PROJECT_ID;
    
    const { data: sections, error } = await supabase
      .from('document_sections')
      .select('id, metadata')
      .eq('project_id', projectId);

    if (error) {
      console.error('[Archive] Supabase error:', error.message);
      return { total: 0, indexed: 0, errors: 0 };
    }

    // Count unique documents
    const uniqueDocs = new Set<string>();
    for (const section of sections || []) {
      const source = section.metadata?.source || section.metadata?.file_name;
      if (source) uniqueDocs.add(source);
    }

    const total = uniqueDocs.size;
    
    console.log('[Archive] Count from Supabase:', total, 'documents');
    
    return { 
      total, 
      indexed: total,  // All documents in Supabase are indexed
      errors: 0 
    };
  } catch (error) {
    console.error('[Archive] Error counting documents:', error);
    return { total: 0, indexed: 0, errors: 0 };
  }
}

/**
 * Fetches a single document by ID
 */
export async function fetchDocumentById({
  tenantId,
  documentId,
}: {
  tenantId: string;
  documentId: string;
}): Promise<ArchiveDocument | null> {
  try {
    const { data: section, error } = await supabase
      .from('document_sections')
      .select('id, metadata, content')
      .eq('id', documentId)
      .single();

    if (error || !section) {
      console.error('[Archive] Document not found:', documentId);
      return null;
    }

    return createArchiveDocument(section, PROJECT_ID);
  } catch (error) {
    console.error('[Archive] Error fetching document:', error);
    return null;
  }
}

/**
 * Updates document metadata (discipline, tags, etc.)
 */
export async function updateDocumentMetadata({
  tenantId,
  documentId,
  updates,
}: {
  tenantId: string;
  documentId: string;
  updates: {
    discipline?: DisciplineType;
    doc_kind?: string;
    tags?: string[];
    needs_review?: boolean;
  };
}): Promise<boolean> {
  // For now, Supabase document_sections don't have editable metadata
  // This would need to update all sections with matching source
  console.log('[Archive] Update metadata not yet implemented for Supabase');
  return false;
}

/**
 * Searches documents across all disciplines
 */
export async function searchArchiveDocuments({
  tenantId,
  developmentId,
  query,
  page = 1,
  limit = 50,
}: {
  tenantId: string;
  developmentId?: string | null;
  query: string;
  page?: number;
  limit?: number;
}): Promise<FetchDocumentsResult> {
  try {
    // ALWAYS use hardcoded Launch project ID
    const projectId = PROJECT_ID;
    
    const { data: sections, error } = await supabase
      .from('document_sections')
      .select('id, metadata, content')
      .eq('project_id', projectId);

    if (error) {
      console.error('[Archive] Supabase error:', error.message);
      return { documents: [], totalCount: 0, page, pageSize: limit, totalPages: 0 };
    }

    // Group by unique source documents
    const documentMap = new Map<string, ArchiveDocument>();
    
    for (const section of sections || []) {
      const source = section.metadata?.source || section.metadata?.file_name || 'Unknown';
      
      if (!documentMap.has(source)) {
        documentMap.set(source, createArchiveDocument(section, projectId));
      }
    }

    // Filter by search query
    const searchLower = query.toLowerCase();
    let filteredDocs = Array.from(documentMap.values()).filter(doc => 
      doc.title.toLowerCase().includes(searchLower) ||
      doc.file_name.toLowerCase().includes(searchLower)
    );

    // Pagination
    const totalCount = filteredDocs.length;
    const totalPages = Math.ceil(totalCount / limit);
    const offset = (page - 1) * limit;
    const paginatedDocs = filteredDocs.slice(offset, offset + limit);

    return {
      documents: paginatedDocs,
      totalCount,
      page,
      pageSize: limit,
      totalPages,
    };
  } catch (error) {
    console.error('[Archive] Error searching documents:', error);
    return { documents: [], totalCount: 0, page, pageSize: limit, totalPages: 0 };
  }
}

/**
 * Deletes a document and all its sections from the archive
 * Removes from Supabase document_sections table
 */
export async function deleteDocument({
  documentId,
  fileName,
}: {
  documentId?: string;
  fileName?: string;
}): Promise<{ success: boolean; deletedCount: number; error?: string }> {
  try {
    const projectId = PROJECT_ID;
    console.log('[Archive] Deleting document:', { documentId, fileName, projectId });

    if (!documentId && !fileName) {
      return { success: false, deletedCount: 0, error: 'Either documentId or fileName is required' };
    }

    let query = supabase
      .from('document_sections')
      .delete()
      .eq('project_id', projectId);

    if (fileName) {
      query = query.or(`metadata->>source.eq.${fileName},metadata->>file_name.eq.${fileName}`);
    }

    const { data, error } = await query.select('id');

    if (error) {
      console.error('[Archive] Supabase delete error:', error.message);
      return { success: false, deletedCount: 0, error: error.message };
    }

    const deletedCount = data?.length || 0;
    console.log('[Archive] Deleted', deletedCount, 'document sections');

    return { success: true, deletedCount };
  } catch (error) {
    console.error('[Archive] Error deleting document:', error);
    return { success: false, deletedCount: 0, error: 'Failed to delete document' };
  }
}
