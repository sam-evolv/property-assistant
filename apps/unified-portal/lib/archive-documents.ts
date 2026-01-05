/**
 * Smart Archive Documents Helper (Isolated for Vercel compatibility)
 * 
 * This module contains ONLY the document-fetching logic needed by /api/archive/documents
 * It is deliberately isolated to avoid pulling in optional native dependencies
 * that cause Vercel to prune the route during build.
 */

import { createClient } from '@supabase/supabase-js';

export interface ArchiveDocument {
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

export interface FetchDocumentsResult {
  documents: ArchiveDocument[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('[Archive Documents] Missing Supabase environment variables:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseKey,
    });
    throw new Error('Supabase configuration missing. Please check environment variables.');
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

const DEVELOPMENT_TO_SUPABASE_PROJECT: Record<string, string> = {
  '34316432-f1e8-4297-b993-d9b5c88ee2d8': '57dc3919-2725-4575-8046-9179075ac88e',
  'e0833063-55ac-4201-a50e-f329c090fbd6': '6d3789de-2e46-430c-bf31-22224bd878da',
};

function getSupabaseProjectId(developmentId: string): string {
  const mapped = DEVELOPMENT_TO_SUPABASE_PROJECT[developmentId];
  if (mapped) {
    console.log('[Archive Documents] Mapped developmentId', developmentId, 'to Supabase project_id', mapped);
    return mapped;
  }
  return developmentId;
}

const VALID_DISCIPLINES = ['architectural', 'structural', 'mechanical', 'electrical', 'plumbing', 'civil', 'landscape', 'handover', 'other'];

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
  discipline?: string;
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
  const effectiveLimit = pageSize || limit || 50;
  
  try {
    console.log('[Archive Documents] Fetching documents for scheme:', developmentId || 'ALL');
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
      console.error('[Archive Documents] Supabase error:', error.message);
      return { documents: [], totalCount: 0, page, pageSize: effectiveLimit, totalPages: 0 };
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
    const totalPages = Math.ceil(totalCount / effectiveLimit);
    const offset = (page - 1) * effectiveLimit;
    const paginatedDocs = filteredDocs.slice(offset, offset + effectiveLimit);
    
    console.log('[Archive Documents] Found:', filteredDocs.length, 'documents, returning', paginatedDocs.length);

    return {
      documents: paginatedDocs,
      totalCount,
      page,
      pageSize: effectiveLimit,
      totalPages,
    };
  } catch (error) {
    console.error('[Archive Documents] Error fetching documents:', error);
    return { documents: [], totalCount: 0, page, pageSize: effectiveLimit, totalPages: 0 };
  }
}

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
    console.log('[Archive Documents] Deleting document:', { documentId, fileName, schemeId });

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
      console.error('[Archive Documents] Supabase delete error:', error.message);
      return { success: false, deletedCount: 0, error: error.message };
    }

    const deletedCount = data?.length || 0;
    console.log('[Archive Documents] Deleted', deletedCount, 'document sections');

    return { success: true, deletedCount };
  } catch (error) {
    console.error('[Archive Documents] Error deleting document:', error);
    return { success: false, deletedCount: 0, error: 'Failed to delete document' };
  }
}

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
    console.log('[Archive Documents] Updating document flags:', { fileName, isImportant, mustRead, schemeId });

    let fetchQuery = supabase
      .from('document_sections')
      .select('id, metadata');
    
    if (schemeId) {
      fetchQuery = fetchQuery.eq('project_id', schemeId);
    }
    
    const { data: allSections, error: fetchError } = await fetchQuery;

    if (fetchError) {
      console.error('[Archive Documents] Supabase fetch error:', fetchError.message);
      return { success: false, updatedCount: 0, error: fetchError.message };
    }

    const sections = (allSections || []).filter(section => {
      const source = section.metadata?.source;
      const file_name = section.metadata?.file_name;
      return source === fileName || file_name === fileName;
    });

    if (sections.length === 0) {
      console.log('[Archive Documents] No matching sections found for:', fileName);
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

    console.log('[Archive Documents] Updated', updatedCount, 'document sections');
    return { success: true, updatedCount };
  } catch (error) {
    console.error('[Archive Documents] Error updating document:', error);
    return { success: false, updatedCount: 0, error: 'Failed to update document' };
  }
}

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
    console.log('[Archive Documents] Assigning document to folder:', { fileName, folderId, schemeId });

    let fetchQuery = supabase
      .from('document_sections')
      .select('id, metadata');
    
    if (schemeId) {
      fetchQuery = fetchQuery.eq('project_id', schemeId);
    }
    
    const { data: allSections, error: fetchError } = await fetchQuery;

    if (fetchError) {
      console.error('[Archive Documents] Supabase fetch error:', fetchError.message);
      return { success: false, updatedCount: 0, error: fetchError.message };
    }

    const sections = (allSections || []).filter(section => {
      const source = section.metadata?.source;
      const file_name = section.metadata?.file_name;
      return source === fileName || file_name === fileName;
    });

    if (sections.length === 0) {
      console.log('[Archive Documents] No matching sections found for:', fileName);
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

    console.log('[Archive Documents] Updated', updatedCount, 'document sections');
    return { success: true, updatedCount };
  } catch (error) {
    console.error('[Archive Documents] Error assigning document to folder:', error);
    return { success: false, updatedCount: 0, error: 'Failed to assign document to folder' };
  }
}
