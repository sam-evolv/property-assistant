import { db } from '@openhouse/db/client';
import { ragChunks, developments } from '@openhouse/db/schema';
import { sql, eq, and } from 'drizzle-orm';
import { embedText } from './train/embed';
import { logger } from './logger';

export interface RagChunk {
  id: string;
  content: string;
  documentId: string;
  chunkIndex: number;
  similarity: number;
  houseTypeCode: string | null;
}

export interface RetrieveContextParams {
  developmentCode: string;
  houseTypeCode?: string | null;
  queryEmbedding: number[];
  limit?: number;
  threshold?: number;
}

export async function retrieveContext(params: RetrieveContextParams): Promise<RagChunk[]> {
  const { 
    developmentCode, 
    houseTypeCode, 
    queryEmbedding, 
    limit = 20, 
    threshold = 0.4 
  } = params;

  const startTime = Date.now();
  
  try {
    const development = await db.query.developments.findFirst({
      where: eq(developments.code, developmentCode),
    });

    if (!development) {
      logger.warn('Development not found for RAG retrieval', { developmentCode });
      return [];
    }

    const embeddingVector = `[${queryEmbedding.join(',')}]`;

    let queryConditions = sql`
      tenant_id = ${development.tenant_id}::uuid
      AND development_id = ${development.id}::uuid
      AND embedding IS NOT NULL
    `;

    if (houseTypeCode) {
      queryConditions = sql`${queryConditions} AND house_type_code = ${houseTypeCode}`;
    }

    const result = await db.execute<{
      id: string;
      content: string;
      document_id: string;
      chunk_index: number;
      house_type_code: string | null;
      similarity: number;
    }>(sql`
      SELECT 
        id,
        content,
        document_id,
        chunk_index,
        house_type_code,
        1 - (embedding <=> ${embeddingVector}::vector) as similarity
      FROM ${ragChunks}
      WHERE ${queryConditions}
        AND (1 - (embedding <=> ${embeddingVector}::vector)) > ${threshold}
      ORDER BY embedding <=> ${embeddingVector}::vector
      LIMIT ${limit}
    `);

    const chunks: RagChunk[] = (result.rows || []).map(row => ({
      id: row.id,
      content: row.content,
      documentId: row.document_id,
      chunkIndex: row.chunk_index || 0,
      houseTypeCode: row.house_type_code,
      similarity: parseFloat(String(row.similarity)) || 0,
    }));

    const duration = Date.now() - startTime;
    logger.info('RAG context retrieved', {
      duration,
      developmentCode,
      houseTypeCode,
      chunksFound: chunks.length,
      avgSimilarity: chunks.length > 0 
        ? (chunks.reduce((sum, c) => sum + c.similarity, 0) / chunks.length).toFixed(3)
        : 0,
    });

    return chunks;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('RAG retrieval error', { 
      duration, 
      error: error instanceof Error ? error.message : 'Unknown',
      developmentCode,
      houseTypeCode,
    });
    throw error;
  }
}

export { embedText };
