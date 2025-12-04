import { db } from '../../../db/client';
import { doc_chunks, documents } from '../../../db/schema';
import { EmbeddingResult, IngestResult, TrainingItem } from './types';
import { sql } from 'drizzle-orm';

/**
 * Extracts house type code from filename or title
 * Matches patterns like BD01, BD12, BS03, BT10 (case insensitive)
 */
export function extractHouseTypeCode(fileNameOrTitle: string | null | undefined): string | null {
  if (!fileNameOrTitle) return null;

  // Match codes like BD01, BD12, BS03, BT10 (case insensitive)
  const match = fileNameOrTitle.toUpperCase().match(/\b(BD|BS|BT)\d{2}\b/);
  return match ? match[0] : null;
}

/**
 * Classifies document type based on filename
 * Returns specific types for architectural documents or 'training' as fallback
 */
export function classifyDocumentType(fileName: string): string {
  const upper = fileName.toUpperCase();
  
  // Floor plans
  if (upper.includes('FLOOR') || upper.includes('PLAN') || upper.includes('FP') || upper.includes('FLOORPLAN')) {
    return 'architectural_floor_plan';
  }
  
  // Elevations
  if (upper.includes('ELEVATION') || upper.includes('ELEV')) {
    return 'elevations';
  }
  
  // Site plans
  if ((upper.includes('SITE') && upper.includes('PLAN')) || upper.includes('SITEPLAN') || upper.includes('LAYOUT')) {
    return 'site_plan';
  }
  
  // Specifications
  if (upper.includes('SPEC') || upper.includes('SPECIFICATION')) {
    return 'specification';
  }
  
  // Manuals
  if (upper.includes('MANUAL') || upper.includes('HANDBOOK') || upper.includes('GUIDE')) {
    return 'manual';
  }
  
  // Default to training
  return 'training';
}

export async function ingestEmbeddings(
  embeddings: EmbeddingResult[],
  tenantId: string,
  developmentId: string,
  sourceType: string,
  sourceId?: string,
  houseTypeCode?: string | null
): Promise<IngestResult> {
  console.log(`\n🧩 INSERT CHUNKS: ${embeddings.length} chunks to insert`);
  console.log(`   Tenant: ${tenantId}`);
  console.log(`   Development: ${developmentId}`);
  console.log(`   Source Type: ${sourceType}`);
  console.log(`   Document ID: ${sourceId || 'none'}`);
  console.log(`   House Type Code: ${houseTypeCode || 'none (general document)'}`);
  
  if (embeddings.length === 0) {
    console.log('   ⚠️  No embeddings to ingest');
    return { success: true, chunksInserted: 0 };
  }
  
  let isImportant = false;
  
  if (sourceId) {
    try {
      const doc = await db
        .select({ is_important: documents.is_important })
        .from(documents)
        .where(sql`id = ${sourceId}::uuid`)
        .limit(1);
      isImportant = doc[0]?.is_important || false;
      console.log(`   Important Document: ${isImportant ? 'YES' : 'NO'}`);
    } catch (error) {
      console.warn(`   ⚠️  Could not retrieve document importance: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }
  
  const errors: string[] = [];
  let chunksInserted = 0;
  
  try {
    for (const { chunk, embedding } of embeddings) {
      try {
        const embeddingVector = `[${embedding.join(',')}]`;
        
        if (sourceId) {
          await db.execute(sql`
            INSERT INTO doc_chunks (tenant_id, development_id, document_id, content, embedding, source_type, source_id, house_type_code, is_important, metadata)
            VALUES (
              ${tenantId}::uuid,
              ${developmentId}::uuid,
              ${sourceId}::uuid,
              ${chunk.content},
              ${embeddingVector}::vector,
              ${sourceType},
              ${sourceId}::uuid,
              ${houseTypeCode},
              ${isImportant},
              ${JSON.stringify(chunk.metadata || {})}::jsonb
            )
          `);
        } else {
          await db.execute(sql`
            INSERT INTO doc_chunks (tenant_id, development_id, content, embedding, source_type, house_type_code, is_important, metadata)
            VALUES (
              ${tenantId}::uuid,
              ${developmentId}::uuid,
              ${chunk.content},
              ${embeddingVector}::vector,
              ${sourceType},
              ${houseTypeCode},
              ${isImportant},
              ${JSON.stringify(chunk.metadata || {})}::jsonb
            )
          `);
        }
        
        chunksInserted++;
        
        if (chunksInserted % 10 === 0) {
          console.log(`   📊 Progress: ${chunksInserted}/${embeddings.length} chunks inserted`);
        }
      } catch (error) {
        const errorMsg = `Failed to insert chunk ${chunk.index}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`   ❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }
    
    console.log(`✅ CHUNKS INSERTED successfully`);
    console.log(`   Total: ${chunksInserted}/${embeddings.length} chunks`);
    
    return {
      success: errors.length === 0,
      chunksInserted,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('❌ CHUNK INSERT FAILED:', error);
    throw new Error(`Failed to ingest embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function deleteDocumentChunks(tenantId: string, sourceId: string): Promise<number> {
  console.log(`\n🗑️  Deleting chunks for document: ${sourceId} (tenant: ${tenantId})`);
  
  try {
    const result = await db
      .delete(doc_chunks)
      .where(sql`tenant_id = ${tenantId} AND source_id = ${sourceId}`);
    
    console.log(`✅ Deleted existing chunks`);
    return 0;
  } catch (error) {
    console.error('❌ Delete failed:', error);
    throw new Error(`Failed to delete chunks: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getTenantChunkCount(tenantId: string): Promise<number> {
  try {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(doc_chunks)
      .where(sql`tenant_id = ${tenantId}`);
    
    return Number(result[0]?.count || 0);
  } catch (error) {
    console.error('❌ Count query failed:', error);
    return 0;
  }
}

export async function searchSimilarChunks(
  tenantId: string,
  queryEmbedding: number[],
  limit: number = 5
): Promise<Array<{ content: string; similarity: number; metadata: any }>> {
  try {
    const embeddingStr = `[${queryEmbedding.join(',')}]`;
    
    const results = await db.execute<{
      content: string;
      similarity: number;
      metadata: any;
    }>(sql`
      SELECT
        content,
        1 - (embedding <=> ${embeddingStr}::vector) as similarity,
        metadata
      FROM doc_chunks
      WHERE tenant_id = ${tenantId}
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${embeddingStr}::vector
      LIMIT ${limit}
    `);
    
    return results.rows || [];
  } catch (error) {
    console.error('❌ Similarity search failed:', error);
    return [];
  }
}

export async function createDocument(
  tenantId: string,
  developmentId: string,
  fileName: string,
  fileUrl: string = ''
): Promise<{ id: string; houseTypeCode: string | null; documentType: string; houseTypeId: string | null }> {
  console.log(`\n📁 INSERT DOCUMENT: ${fileName}`);
  console.log(`   Tenant: ${tenantId}`);
  console.log(`   Development: ${developmentId}`);
  
  // Extract house type code from filename
  const houseTypeCode = extractHouseTypeCode(fileName);
  console.log(`   House Type Code: ${houseTypeCode || 'none (general document)'}`);
  
  // Classify document type based on filename
  const documentType = classifyDocumentType(fileName);
  console.log(`   Document Type: ${documentType}`);
  
  let houseTypeId: string | null = null;
  if (houseTypeCode) {
    try {
      const houseTypeResult = await db.execute<{ id: string }>(sql`
        SELECT id FROM house_types
        WHERE development_id = ${developmentId}::uuid
        AND house_type_code = ${houseTypeCode}
        LIMIT 1
      `);
      if (houseTypeResult.rows && houseTypeResult.rows.length > 0) {
        houseTypeId = houseTypeResult.rows[0].id;
      }
    } catch (e) {
      console.warn(`⚠️  Could not find house_type_id for ${houseTypeCode}`);
    }
  }
  
  try {
    const result = await db.insert(documents).values({
      tenant_id: tenantId,
      development_id: developmentId,
      house_type_id: houseTypeId,
      house_type_code: houseTypeCode,
      document_type: documentType,
      title: fileName,
      file_name: fileName,
      relative_path: `/uploads/${fileName}`,
      file_url: fileUrl || `/uploads/${fileName}`,
      version: 1,
      status: 'active',
      chunks_count: 0,
      metadata: {},
    }).returning({ id: documents.id });
    
    const documentId = result[0].id;
    console.log(`✅ DOCUMENT INSERTED successfully`);
    console.log(`   Document ID: ${documentId}`);
    return { id: documentId, houseTypeCode, documentType, houseTypeId };
  } catch (error) {
    console.error('❌ DOCUMENT INSERT FAILED:', error);
    throw new Error(`Failed to create document: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getTenantDocumentCount(tenantId: string): Promise<number> {
  try {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(documents)
      .where(sql`tenant_id = ${tenantId}`);
    
    return Number(result[0]?.count || 0);
  } catch (error) {
    console.error('❌ Document count query failed:', error);
    return 0;
  }
}

export async function markDocumentFailed(documentId: string): Promise<void> {
  try {
    await db.execute(sql`
      UPDATE documents 
      SET status = 'failed', updated_at = NOW()
      WHERE id = ${documentId}::uuid
    `);
    console.log(`✅ Marked document ${documentId} as failed`);
  } catch (error) {
    console.error(`❌ Failed to mark document as failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function updateDocumentChunkCount(documentId: string, chunkCount: number): Promise<void> {
  try {
    await db.execute(sql`
      UPDATE documents 
      SET chunks_count = ${chunkCount}, updated_at = NOW()
      WHERE id = ${documentId}::uuid
    `);
    console.log(`✅ Updated document ${documentId} with ${chunkCount} chunks`);
  } catch (error) {
    console.error(`❌ Failed to update document chunk count: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
