import { db } from '@openhouse/db/client';
import { doc_chunks } from '@openhouse/db/schema';
import { sql, and, eq } from 'drizzle-orm';
import OpenAI from 'openai';

export interface RelevantChunk {
  id: string;
  content: string;
  documentId: string | null;
  chunkIndex: number;
  similarity: number;
  metadata: Record<string, any>;
}

export interface RetrievalParams {
  developmentId: string;
  tenantId: string;
  query: string;
  houseTypeCode?: string | null;
  limit?: number;
}

export async function getRelevantChunks(
  params: RetrievalParams
): Promise<RelevantChunk[]> {
  const { developmentId, tenantId, query, houseTypeCode, limit = 10 } = params;

  console.log(`[RETRIEVAL] Searching chunks for development: ${developmentId}`);
  console.log(`[RETRIEVAL] Tenant ID: ${tenantId}`);
  if (houseTypeCode) {
    console.log(`[RETRIEVAL] Filtering by house_type_code: ${houseTypeCode}`);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const openai = new OpenAI({ apiKey });

  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-large',
    input: query,
    dimensions: 1536,
  });

  const queryEmbedding = embeddingResponse.data[0].embedding;

  const embeddingString = `[${queryEmbedding.join(',')}]`;

  const results = houseTypeCode
    ? await db.execute(sql`
        SELECT 
          id,
          content,
          document_id,
          chunk_index,
          metadata,
          house_type_code,
          is_important,
          1 - (embedding <=> ${embeddingString}::vector) as similarity,
          CASE 
            WHEN is_important = true THEN (1 - (embedding <=> ${embeddingString}::vector)) * 1.25
            ELSE 1 - (embedding <=> ${embeddingString}::vector)
          END as weighted_similarity
        FROM ${doc_chunks}
        WHERE 
          tenant_id = ${tenantId}
          AND development_id = ${developmentId}
          AND (house_type_code = ${houseTypeCode} OR house_type_code IS NULL)
          AND embedding IS NOT NULL
        ORDER BY 
          CASE WHEN house_type_code = ${houseTypeCode} THEN 0 ELSE 1 END,
          weighted_similarity DESC
        LIMIT ${limit}
      `)
    : await db.execute(sql`
        SELECT 
          id,
          content,
          document_id,
          chunk_index,
          metadata,
          is_important,
          1 - (embedding <=> ${embeddingString}::vector) as similarity,
          CASE 
            WHEN is_important = true THEN (1 - (embedding <=> ${embeddingString}::vector)) * 1.25
            ELSE 1 - (embedding <=> ${embeddingString}::vector)
          END as weighted_similarity
        FROM ${doc_chunks}
        WHERE 
          tenant_id = ${tenantId}
          AND development_id = ${developmentId}
          AND embedding IS NOT NULL
        ORDER BY weighted_similarity DESC
        LIMIT ${limit}
      `);

  console.log(`[RETRIEVAL] Found ${results.rows.length} relevant chunks`);

  return results.rows.map((row: any) => ({
    id: row.id,
    content: row.content,
    documentId: row.document_id,
    chunkIndex: row.chunk_index || 0,
    similarity: parseFloat(row.similarity) || 0,
    metadata: row.metadata || {},
  }));
}

export async function embedQuery(query: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const openai = new OpenAI({ apiKey });

  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-large',
    input: query,
    dimensions: 1536,
  });

  return embeddingResponse.data[0].embedding;
}
