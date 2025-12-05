/**
 * Smart Archive Backend Helpers (Server-only)
 * 
 * Provides functions for fetching and organizing documents by discipline
 * for the developer dashboard Smart Archive feature.
 * 
 * NOTE: This file uses server-only dependencies.
 * For client components, import from './archive-constants' instead.
 */

import { db } from '@openhouse/db/client';
import { documents } from '@openhouse/db/schema';
import { eq, and, desc, sql, or, isNull, notInArray, ilike, count } from 'drizzle-orm';
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

const VALID_DISCIPLINES = ['architectural', 'structural', 'mechanical', 'electrical', 'plumbing', 'civil', 'landscape'];

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
  try {
    const conditions = [
      eq(documents.tenant_id, tenantId),
      eq(documents.status, 'active')
    ];
    
    if (developmentId) {
      conditions.push(eq(documents.development_id, developmentId));
    }
    
    const docs = await db
      .select({
        discipline: documents.discipline,
        created_at: documents.created_at
      })
      .from(documents)
      .where(and(...conditions));
    
    console.log('[Archive] Fetched docs count:', docs.length, 'for tenant:', tenantId, 'development:', developmentId);
    
    // Group documents by discipline
    const disciplineMap = new Map<string, { count: number; lastUpdated: Date | null }>();
    
    // Initialize all disciplines with 0 count
    Object.keys(DISCIPLINES).forEach(disc => {
      disciplineMap.set(disc, { count: 0, lastUpdated: null });
    });
    
    // Count documents per discipline
    docs.forEach(doc => {
      const disc = doc.discipline?.toLowerCase() || 'other';
      const key = VALID_DISCIPLINES.includes(disc) ? disc : 'other';
      
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
    throw error;
  }
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
  try {
    const offset = (page - 1) * pageSize;
    
    const conditions = [
      eq(documents.tenant_id, tenantId),
      eq(documents.status, 'active')
    ];
    
    if (developmentId) {
      conditions.push(eq(documents.development_id, developmentId));
    }
    
    // Handle discipline filtering
    if (discipline === 'other') {
      conditions.push(
        or(
          isNull(documents.discipline),
          notInArray(sql`lower(${documents.discipline})`, VALID_DISCIPLINES)
        )!
      );
    } else {
      conditions.push(ilike(documents.discipline, discipline));
    }
    
    // Apply additional filters
    if (houseTypeCode) {
      conditions.push(eq(documents.house_type_code, houseTypeCode));
    }
    if (important) {
      conditions.push(eq(documents.is_important, true));
    }
    if (mustRead) {
      conditions.push(eq(documents.must_read, true));
    }
    if (aiClassified) {
      conditions.push(eq(documents.ai_classified, true));
    }
    
    // Get count first
    const [countResult] = await db
      .select({ count: count() })
      .from(documents)
      .where(and(...conditions));
    
    const totalCount = countResult?.count || 0;
    const totalPages = Math.ceil(totalCount / pageSize);
    
    // Get documents
    const docs = await db
      .select({
        id: documents.id,
        title: documents.title,
        file_name: documents.file_name,
        file_url: documents.file_url,
        storage_url: documents.storage_url,
        discipline: documents.discipline,
        revision_code: documents.revision_code,
        doc_kind: documents.doc_kind,
        house_type_code: documents.house_type_code,
        is_important: documents.is_important,
        must_read: documents.must_read,
        ai_classified: documents.ai_classified,
        mime_type: documents.mime_type,
        size_kb: documents.size_kb,
        created_at: documents.created_at,
        updated_at: documents.updated_at
      })
      .from(documents)
      .where(and(...conditions))
      .orderBy(desc(documents.created_at))
      .limit(pageSize)
      .offset(offset);
    
    const processedDocs: ArchiveDocument[] = docs.map(doc => ({
      id: doc.id,
      title: doc.title || '',
      file_name: doc.file_name || '',
      file_url: doc.file_url || doc.storage_url || null,
      storage_url: doc.storage_url || null,
      discipline: doc.discipline || null,
      revision_code: doc.revision_code || null,
      doc_kind: doc.doc_kind || null,
      house_type_code: doc.house_type_code || null,
      is_important: doc.is_important || false,
      must_read: doc.must_read || false,
      ai_classified: doc.ai_classified || false,
      mime_type: doc.mime_type || null,
      size_kb: doc.size_kb || null,
      created_at: doc.created_at?.toISOString() || null,
      updated_at: doc.updated_at?.toISOString() || null
    }));
    
    return {
      documents: processedDocs,
      totalCount,
      page,
      pageSize,
      totalPages,
    };
  } catch (error) {
    console.error('[Archive] Error fetching documents:', error);
    throw error;
  }
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
  try {
    await db
      .update(documents)
      .set({ 
        discipline, 
        updated_at: new Date() 
      })
      .where(
        and(
          eq(documents.id, documentId),
          eq(documents.tenant_id, tenantId)
        )
      );
  } catch (error) {
    console.error('[Archive] Error updating discipline:', error);
    throw error;
  }
}
