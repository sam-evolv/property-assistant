/**
 * Smart Archive Backend Helpers (Server-only)
 * 
 * Provides functions for fetching and organising documents by discipline
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

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('[Archive] Missing Supabase environment variables:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseKey,
    });
    throw new Error('Supabase configuration missing. Please check environment variables.');
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Maps Drizzle development IDs to Supabase project IDs
 * This is needed because the local database uses different UUIDs than Supabase
 */
const DEVELOPMENT_TO_SUPABASE_PROJECT: Record<string, string> = {
  // Longview Park: Drizzle development ID -> Supabase project ID
  '34316432-f1e8-4297-b993-d9b5c88ee2d8': '57dc3919-2725-4575-8046-9179075ac88e',
  // Rathard Park: Drizzle development ID -> Supabase project ID  
  'e0833063-55ac-4201-a50e-f329c090fbd6': '6d3789de-2e46-430c-bf31-22224bd878da',
};

/**
 * Translates a Drizzle development ID to the corresponding Supabase project ID
 * Falls back to the original ID if no mapping exists (for backwards compatibility)
 */
function getSupabaseProjectId(developmentId: string): string {
  const mapped = DEVELOPMENT_TO_SUPABASE_PROJECT[developmentId];
  if (mapped) {
    console.log('[Archive] Mapped developmentId', developmentId, 'to Supabase project_id', mapped);
    return mapped;
  }
  // If not in mapping, assume it's already a valid Supabase project ID
  return developmentId;
}

// REMOVED: No default project ID - schemeId must be passed explicitly or query ALL
const VALID_DISCIPLINES = ['architectural', 'structural', 'mechanical', 'electrical', 'plumbing', 'civil', 'landscape', 'handover', 'other'];

/**
 * Fetches discipline summaries with file counts for the archive grid
 * NOW READS FROM SUPABASE document_sections
 * Filters by developmentId when provided, otherwise returns all for tenant
 */
export async function fetchArchiveDisciplines({
  tenantId,
  developmentId,
}: {
  tenantId: string;
  developmentId?: string | null;
}): Promise<DisciplineSummary[]> {
  try {
    const supabase = getSupabaseClient();
    
    let query = supabase.from('document_sections').select('id, metadata, project_id');
    
    if (developmentId) {
      const supabaseProjectId = getSupabaseProjectId(developmentId);
      console.log('[Archive] Fetching disciplines for SCHEME:', developmentId, '-> project_id:', supabaseProjectId);
      query = query.eq('project_id', supabaseProjectId);
    } else {
      console.log('[Archive] Fetching disciplines for ALL_SCHEMES (no filter)');
    }
    
    const { data: sections, error } = await query;

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

/**
 * Fetches documents for a specific discipline
 * NOW READS FROM SUPABASE document_sections
 */
export async function fetchDocumentsByDiscipline({
  tenantId,
  developmentId,
  discipline,
  folderId,
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
  discipline?: DisciplineType | string;
  folderId?: string;
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
    console.log('📂 Fetching documents for scheme:', developmentId || 'ALL');
    const supabase = getSupabaseClient();
    
    let query = supabase
      .from('document_sections')
      .select('id, metadata, content, project_id');
    
    if (developmentId) {
      const supabaseProjectId = getSupabaseProjectId(developmentId);
      query = query.eq('project_id', supabaseProjectId);
    }
    
    const { data: sections, error } = await query;

    if (error) {
      console.error('[Archive] Supabase error:', error.message);
      return { documents: [], totalCount: 0, page, pageSize: effectiveLimit, totalPages: 0 };
    }

    // Group by unique source documents
    const documentMap = new Map<string, ArchiveDocument>();
    
    for (const section of sections || []) {
      const source = section.metadata?.source || section.metadata?.file_name || 'Unknown';
      
      if (!documentMap.has(source)) {
        documentMap.set(source, createArchiveDocument(section, section.project_id || developmentId || 'unknown'));
      }
    }

    // Filter by discipline or folderId
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
    console.log('[Archive] Counting documents for scheme:', developmentId || 'ALL');
    const supabase = getSupabaseClient();
    
    let query = supabase
      .from('document_sections')
      .select('id, metadata');
    
    if (developmentId) {
      const supabaseProjectId = getSupabaseProjectId(developmentId);
      query = query.eq('project_id', supabaseProjectId);
    }
    
    const { data: sections, error } = await query;

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
    const supabase = getSupabaseClient();
    const { data: section, error } = await supabase
      .from('document_sections')
      .select('id, metadata, content, project_id')
      .eq('id', documentId)
      .single();

    if (error || !section) {
      console.error('[Archive] Document not found:', documentId);
      return null;
    }

    return createArchiveDocument(section, section.project_id || 'unknown');
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
    console.log('[Archive] Searching documents for scheme:', developmentId || 'ALL');
    const supabase = getSupabaseClient();
    
    let dbQuery = supabase
      .from('document_sections')
      .select('id, metadata, content, project_id');
    
    if (developmentId) {
      const supabaseProjectId = getSupabaseProjectId(developmentId);
      dbQuery = dbQuery.eq('project_id', supabaseProjectId);
    }
    
    const { data: sections, error } = await dbQuery;

    if (error) {
      console.error('[Archive] Supabase error:', error.message);
      return { documents: [], totalCount: 0, page, pageSize: limit, totalPages: 0 };
    }

    // Group by unique source documents
    const documentMap = new Map<string, ArchiveDocument>();
    
    for (const section of sections || []) {
      const source = section.metadata?.source || section.metadata?.file_name || 'Unknown';
      
      if (!documentMap.has(source)) {
        documentMap.set(source, createArchiveDocument(section, section.project_id || 'unknown'));
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
  schemeId,
}: {
  documentId?: string;
  fileName?: string;
  schemeId?: string;
}): Promise<{ success: boolean; deletedCount: number; error?: string }> {
  try {
    const supabase = getSupabaseClient();
    console.log('[Archive] Deleting document:', { documentId, fileName, schemeId });

    if (!documentId && !fileName) {
      return { success: false, deletedCount: 0, error: 'Either documentId or fileName is required' };
    }

    let query = supabase
      .from('document_sections')
      .delete();
    
    if (schemeId) {
      query = query.eq('project_id', schemeId);
    }

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

/**
 * Updates document metadata (important, must_read flags)
 * Updates all sections with matching source filename
 */
export async function updateDocumentFlags({
  fileName,
  isImportant,
  mustRead,
  schemeId,
}: {
  fileName: string;
  isImportant?: boolean;
  mustRead?: boolean;
  schemeId?: string;
}): Promise<{ success: boolean; updatedCount: number; error?: string }> {
  try {
    const supabase = getSupabaseClient();
    console.log('[Archive] Updating document flags:', { fileName, isImportant, mustRead, schemeId });

    // Fetch sections then filter in JS (handles special characters)
    let fetchQuery = supabase
      .from('document_sections')
      .select('id, metadata');
    
    if (schemeId) {
      fetchQuery = fetchQuery.eq('project_id', schemeId);
    }
    
    const { data: allSections, error: fetchError } = await fetchQuery;

    if (fetchError) {
      console.error('[Archive] Supabase fetch error:', fetchError.message);
      return { success: false, updatedCount: 0, error: fetchError.message };
    }

    // Filter matching sections in JavaScript to handle special characters
    const sections = (allSections || []).filter(section => {
      const source = section.metadata?.source;
      const file_name = section.metadata?.file_name;
      return source === fileName || file_name === fileName;
    });

    if (sections.length === 0) {
      console.log('[Archive] No matching sections found for:', fileName);
      return { success: false, updatedCount: 0, error: 'Document not found' };
    }

    let updatedCount = 0;
    for (const section of sections) {
      const newMetadata = {
        ...section.metadata,
        is_important: isImportant !== undefined ? isImportant : section.metadata?.is_important,
        must_read: mustRead !== undefined ? mustRead : section.metadata?.must_read,
      };

      const { error: updateError } = await supabase
        .from('document_sections')
        .update({ metadata: newMetadata })
        .eq('id', section.id);

      if (!updateError) {
        updatedCount++;
      }
    }

    console.log('[Archive] Updated', updatedCount, 'document sections');
    return { success: true, updatedCount };
  } catch (error) {
    console.error('[Archive] Error updating document:', error);
    return { success: false, updatedCount: 0, error: 'Failed to update document' };
  }
}

/**
 * Assigns a document to a folder by updating metadata
 */
export async function assignDocumentToFolder({
  fileName,
  folderId,
  schemeId,
}: {
  fileName: string;
  folderId: string | null;
  schemeId?: string;
}): Promise<{ success: boolean; updatedCount: number; error?: string }> {
  try {
    const supabase = getSupabaseClient();
    console.log('[Archive] Assigning document to folder:', { fileName, folderId, schemeId });

    let fetchQuery = supabase
      .from('document_sections')
      .select('id, metadata');
    
    if (schemeId) {
      fetchQuery = fetchQuery.eq('project_id', schemeId);
    }
    
    const { data: allSections, error: fetchError } = await fetchQuery;

    if (fetchError) {
      console.error('[Archive] Supabase fetch error:', fetchError.message);
      return { success: false, updatedCount: 0, error: fetchError.message };
    }

    const sections = (allSections || []).filter(section => {
      const source = section.metadata?.source;
      const file_name = section.metadata?.file_name;
      return source === fileName || file_name === fileName;
    });

    if (sections.length === 0) {
      console.log('[Archive] No matching sections found for:', fileName);
      return { success: false, updatedCount: 0, error: 'Document not found' };
    }

    let updatedCount = 0;
    for (const section of sections) {
      const newMetadata = {
        ...section.metadata,
        folder_id: folderId,
      };

      const { error: updateError } = await supabase
        .from('document_sections')
        .update({ metadata: newMetadata })
        .eq('id', section.id);

      if (!updateError) {
        updatedCount++;
      }
    }

    console.log('[Archive] Updated', updatedCount, 'document sections');
    return { success: true, updatedCount };
  } catch (error) {
    console.error('[Archive] Error assigning document to folder:', error);
    return { success: false, updatedCount: 0, error: 'Failed to assign document to folder' };
  }
}
