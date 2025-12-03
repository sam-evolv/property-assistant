import OpenAI from 'openai';
import { TextChunk, EmbeddingResult } from './types';
import crypto from 'crypto';
import { db } from '@openhouse/db/client';
import { sql } from 'drizzle-orm';
import { logger } from '../logger';

const EMBEDDING_MODEL = 'text-embedding-3-large';
const EMBEDDING_DIMENSIONS = 1536;
const BATCH_SIZE = 100;
const RATE_LIMIT_DELAY = 1000;
const MAX_RETRIES = 2;

function hashText(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }
  
  return new OpenAI({ apiKey });
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function embedChunk(chunk: TextChunk, retries: number = 0): Promise<EmbeddingResult> {
  const openai = getOpenAIClient();
  
  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: chunk.content,
      dimensions: EMBEDDING_DIMENSIONS,
    });
    
    return {
      chunk,
      embedding: response.data[0].embedding,
    };
  } catch (error: any) {
    if (error?.status === 429 && retries < MAX_RETRIES) {
      const retryDelay = RATE_LIMIT_DELAY * Math.pow(2, retries);
      console.log(`  ⏳ Rate limit hit, retrying in ${retryDelay}ms (attempt ${retries + 1}/${MAX_RETRIES})`);
      await delay(retryDelay);
      return embedChunk(chunk, retries + 1);
    }
    
    console.error(`❌ Embedding error for chunk ${chunk.index}:`, error);
    throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function embedChunks(chunks: TextChunk[]): Promise<EmbeddingResult[]> {
  console.log(`\n🧠 Generating embeddings for ${chunks.length} chunks using ${EMBEDDING_MODEL}...`);
  
  const results: EmbeddingResult[] = [];
  const batches = [];
  
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    batches.push(chunks.slice(i, i + BATCH_SIZE));
  }
  
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    console.log(`  📦 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} chunks)`);
    
    const batchResults = await Promise.all(
      batch.map(chunk => embedChunk(chunk))
    );
    
    results.push(...batchResults);
    
    if (batchIndex < batches.length - 1) {
      await delay(RATE_LIMIT_DELAY);
    }
  }
  
  console.log(`✅ Generated ${results.length} embeddings`);
  return results;
}

export async function embedText(text: string): Promise<number[]> {
  const startTime = Date.now();
  const hash = hashText(text);
  
  try {
    const cached = await db.execute<{embedding: string}>(sql`
      SELECT embedding FROM embedding_cache WHERE hash = ${hash} LIMIT 1
    `);
    
    if (cached.rows && cached.rows.length > 0) {
      await db.execute(sql`
        UPDATE embedding_cache 
        SET last_accessed = CURRENT_TIMESTAMP, access_count = access_count + 1
        WHERE hash = ${hash}
      `);
      
      const duration = Date.now() - startTime;
      logger.info('Embedding cache hit', { duration, hash: hash.substring(0, 8) });
      
      return JSON.parse(cached.rows[0].embedding);
    }
    
    const openai = getOpenAIClient();
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
      dimensions: EMBEDDING_DIMENSIONS,
    });
    
    const embedding = response.data[0].embedding;
    
    await db.execute(sql`
      INSERT INTO embedding_cache (hash, embedding, model)
      VALUES (${hash}, ${JSON.stringify(embedding)}::vector(1536), ${EMBEDDING_MODEL})
      ON CONFLICT (hash) DO NOTHING
    `);
    
    const duration = Date.now() - startTime;
    logger.aiCall('embedText', duration, undefined, undefined, { 
      model: EMBEDDING_MODEL,
      dimensions: EMBEDDING_DIMENSIONS,
      textLength: text.length 
    });
    
    return embedding;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Embedding error', { duration, error: error instanceof Error ? error.message : 'Unknown' });
    throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
