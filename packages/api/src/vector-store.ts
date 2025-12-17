import { db } from '@openhouse/db/client';
import { sql } from 'drizzle-orm';
import OpenAI from 'openai';

function getOpenAI() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
  });
}

export interface MatchedChunk {
  id: string;
  content: string;
  similarity: number;
  [key: string]: any;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const embeddingResponse = await getOpenAI().embeddings.create({
    model: 'text-embedding-3-large',
    input: text,
    dimensions: 1536,
  });
  
  return embeddingResponse.data[0].embedding;
}

export async function searchSimilarChunks(
  query: string,
  tenantId: string,
  developmentId: string,
  options: {
    threshold?: number;
    limit?: number;
  } = {}
): Promise<MatchedChunk[]> {
  const { threshold = 0.45, limit = 8 } = options;
  
  console.log('STEP 1: GENERATING QUERY EMBEDDING');
  console.log('-'.repeat(80));
  const queryEmbedding = await generateEmbedding(query);
  console.log(`✅ Generated embedding (${queryEmbedding.length} dimensions)\n`);

  console.log('STEP 2: VECTOR SIMILARITY SEARCH');
  console.log('-'.repeat(80));
  const embeddingVector = `[${queryEmbedding.join(',')}]`;
  
  const result = await db.execute<MatchedChunk>(sql`
    SELECT
      id,
      content,
      1 - (embedding <=> ${embeddingVector}::vector) as similarity
    FROM doc_chunks
    WHERE tenant_id = ${tenantId}::uuid
      AND development_id = ${developmentId}::uuid
      AND (1 - (embedding <=> ${embeddingVector}::vector)) > ${threshold}
    ORDER BY embedding <=> ${embeddingVector}::vector
    LIMIT ${limit}
  `);

  const chunks = result.rows || [];
  console.log(`✅ Found ${chunks.length} matching chunks (threshold: ${threshold})`);
  
  if (chunks.length > 0) {
    console.log(`   Similarity scores: ${chunks.map(c => c.similarity.toFixed(3)).join(', ')}`);
  }
  console.log('');
  
  return chunks;
}

export async function storeChunkEmbedding(
  tenantId: string,
  developmentId: string,
  documentId: string,
  content: string,
  metadata: any = {}
): Promise<string> {
  const embedding = await generateEmbedding(content);
  const embeddingVector = `[${embedding.join(',')}]`;
  
  const result = await db.execute<{ id: string }>(sql`
    INSERT INTO doc_chunks (tenant_id, development_id, document_id, content, embedding, metadata)
    VALUES (
      ${tenantId}::uuid,
      ${developmentId}::uuid,
      ${documentId}::uuid,
      ${content},
      ${embeddingVector}::vector,
      ${JSON.stringify(metadata)}::jsonb
    )
    RETURNING id
  `);
  
  return result.rows[0].id;
}
