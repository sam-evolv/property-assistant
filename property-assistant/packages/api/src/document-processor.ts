import OpenAI from 'openai';
import { db } from '@openhouse/db/client';
import { documents, doc_chunks, embedding_cache } from '@openhouse/db/schema';
import { eq, sql } from 'drizzle-orm';
import { createHash } from 'crypto';
import { logger } from './logger';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

interface ProcessingResult {
  success: boolean;
  documentId: string;
  chunksCreated: number;
  cacheHits: number;
  error?: string;
}

interface ChunkWithEmbedding {
  text: string;
  index: number;
  embedding: number[];
  metadata: Record<string, any>;
}

export class DocumentProcessor {
  private static readonly CHUNK_SIZE = 1000;
  private static readonly CHUNK_OVERLAP = 200;
  private static readonly EMBEDDING_MODEL = 'text-embedding-3-large';
  private static readonly EMBEDDING_DIMENSIONS = 1536;
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY = 1000;

  static async processDocument(
    documentId: string,
    buffer: Buffer,
    mimeType: string,
    tenantId: string,
    developmentId: string | null
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    
    try {
      logger.info(`[DocumentProcessor] Starting processing for document ${documentId}`);

      // Step 1: Extract text
      const extractedText = await this.extractText(buffer, mimeType);
      if (!extractedText || extractedText.length === 0) {
        throw new Error('No text extracted from document');
      }
      logger.info(`[DocumentProcessor] Extracted ${extractedText.length} characters`);

      // Step 2: Create smart chunks with metadata
      const chunks = this.createSmartChunks(extractedText);
      logger.info(`[DocumentProcessor] Created ${chunks.length} chunks`);

      // Step 3: Generate embeddings with caching
      const { chunksWithEmbeddings, cacheHits } = await this.generateEmbeddings(chunks, tenantId);
      logger.info(`[DocumentProcessor] Generated embeddings (${cacheHits}/${chunks.length} cache hits)`);

      // Step 4: Store chunks in database
      await this.storeChunks(chunksWithEmbeddings, documentId, tenantId, developmentId);
      logger.info(`[DocumentProcessor] Stored ${chunksWithEmbeddings.length} chunks`);

      // Step 5: Update document status
      await db
        .update(documents)
        .set({
          processing_status: 'completed',
          chunks_count: chunksWithEmbeddings.length,
          updated_at: new Date(),
        })
        .where(eq(documents.id, documentId));

      const duration = Date.now() - startTime;
      logger.info(`[DocumentProcessor] Completed in ${duration}ms`, {
        documentId,
        chunksCreated: chunksWithEmbeddings.length,
        cacheHits,
        duration,
      });

      return {
        success: true,
        documentId,
        chunksCreated: chunksWithEmbeddings.length,
        cacheHits,
      };
    } catch (error: any) {
      logger.error(`[DocumentProcessor] Failed to process document ${documentId}:`, error);

      await db
        .update(documents)
        .set({
          processing_status: 'failed',
          updated_at: new Date(),
        })
        .where(eq(documents.id, documentId));

      return {
        success: false,
        documentId,
        chunksCreated: 0,
        cacheHits: 0,
        error: error.message,
      };
    }
  }

  private static async extractText(buffer: Buffer, mimeType: string): Promise<string> {
    try {
      if (mimeType === 'application/pdf') {
        return await this.extractPdfText(buffer);
      } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        return await this.extractDocxText(buffer);
      } else if (mimeType === 'application/msword') {
        return await this.extractDocText(buffer);
      } else if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                 mimeType === 'application/vnd.ms-excel') {
        return await this.extractExcelText(buffer);
      } else if (mimeType === 'text/csv') {
        return await this.extractCsvText(buffer);
      } else if (mimeType === 'text/plain') {
        return buffer.toString('utf-8').trim();
      } else if (mimeType === 'application/json') {
        return await this.extractJsonText(buffer);
      } else {
        throw new Error(`Unsupported MIME type: ${mimeType}`);
      }
    } catch (error: any) {
      logger.error(`[DocumentProcessor] Text extraction failed`, { error: error.message });
      throw new Error(`Text extraction failed: ${error.message}`);
    }
  }

  private static async extractPdfText(buffer: Buffer): Promise<string> {
    try {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      return data.text.replace(/\s+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    } catch (error: any) {
      throw new Error(`PDF parsing failed: ${error.message}`);
    }
  }

  private static async extractDocxText(buffer: Buffer): Promise<string> {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value.replace(/\s+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }

  private static async extractDocText(buffer: Buffer): Promise<string> {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value.replace(/\s+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }

  private static async extractExcelText(buffer: Buffer): Promise<string> {
    const XLSX = require('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    let text = '';

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const sheetData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      
      text += `\n\n=== Sheet: ${sheetName} ===\n\n`;
      for (const row of sheetData as any[][]) {
        text += row.join(' | ') + '\n';
      }
    }

    return text.replace(/\s+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }

  private static async extractCsvText(buffer: Buffer): Promise<string> {
    const { parse } = require('csv-parse/sync');
    const records = parse(buffer, {
      columns: false,
      skip_empty_lines: true,
    });

    return records
      .map((row: string[]) => row.join(' | '))
      .join('\n')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private static async extractJsonText(buffer: Buffer): Promise<string> {
    const jsonData = JSON.parse(buffer.toString('utf-8'));
    return JSON.stringify(jsonData, null, 2);
  }

  private static createSmartChunks(text: string): Array<{ text: string; index: number; metadata: Record<string, any> }> {
    const chunks: Array<{ text: string; index: number; metadata: Record<string, any> }> = [];
    let position = 0;
    let chunkIndex = 0;

    while (position < text.length) {
      const endPosition = Math.min(position + this.CHUNK_SIZE, text.length);
      let chunkText = text.slice(position, endPosition);

      if (endPosition < text.length) {
        const lastPeriod = chunkText.lastIndexOf('. ');
        const lastNewline = chunkText.lastIndexOf('\n');
        const breakPoint = Math.max(lastPeriod, lastNewline);

        if (breakPoint > this.CHUNK_SIZE * 0.7) {
          chunkText = text.slice(position, position + breakPoint + 1);
        }
      }

      if (chunkText.trim().length > 50) {
        chunks.push({
          text: chunkText.trim(),
          index: chunkIndex,
          metadata: {
            charCount: chunkText.length,
            wordCount: chunkText.split(/\s+/).length,
            position,
          },
        });
        chunkIndex++;
      }

      // FIX: Prevent infinite loop by ensuring position always advances
      // Use the max of (chunk length - overlap) or 1 to guarantee forward progress
      const advancement = Math.max(chunkText.length - this.CHUNK_OVERLAP, 1);
      position += advancement;
      
      if (position >= text.length) break;
    }

    return chunks;
  }

  private static async generateEmbeddings(
    chunks: Array<{ text: string; index: number; metadata: Record<string, any> }>,
    tenantId: string
  ): Promise<{ chunksWithEmbeddings: ChunkWithEmbedding[]; cacheHits: number }> {
    const chunksWithEmbeddings: ChunkWithEmbedding[] = [];
    let cacheHits = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const textHash = createHash('sha256').update(chunk.text).digest('hex');

      const cached = await db.query.embedding_cache.findFirst({
        where: eq(embedding_cache.text_hash, textHash),
      });

      let embedding: number[];

      if (cached) {
        embedding = cached.embedding as number[];
        cacheHits++;
        logger.info(`[DocumentProcessor] Cache hit for chunk ${i + 1}/${chunks.length}`);
      } else {
        embedding = await this.generateEmbeddingWithRetry(chunk.text, i, chunks.length);

        try {
          await db.insert(embedding_cache).values({
            tenant_id: tenantId,
            text_hash: textHash,
            embedding: embedding,
            model: this.EMBEDDING_MODEL,
            dimensions: this.EMBEDDING_DIMENSIONS,
          }).onConflictDoNothing();
        } catch (cacheError: any) {
          logger.warn(`[DocumentProcessor] Failed to cache embedding:`, cacheError);
        }
      }

      chunksWithEmbeddings.push({
        text: chunk.text,
        index: chunk.index,
        embedding,
        metadata: chunk.metadata,
      });
    }

    return { chunksWithEmbeddings, cacheHits };
  }

  private static async generateEmbeddingWithRetry(
    text: string,
    index: number,
    total: number
  ): Promise<number[]> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
        logger.info(`[DocumentProcessor] Generating embedding ${index + 1}/${total} (attempt ${attempt + 1})`);
        
        const response = await openai.embeddings.create({
          model: this.EMBEDDING_MODEL,
          input: text,
          dimensions: this.EMBEDDING_DIMENSIONS,
        });

        if (!response.data?.[0]?.embedding) {
          throw new Error('No embedding data returned from OpenAI');
        }

        return response.data[0].embedding as number[];
      } catch (error: any) {
        lastError = error;
        logger.warn(`[DocumentProcessor] Embedding generation attempt ${attempt + 1} failed:`, error.message);

        if (attempt < this.MAX_RETRIES - 1) {
          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * (attempt + 1)));
        }
      }
    }

    throw new Error(`Failed to generate embedding after ${this.MAX_RETRIES} attempts: ${lastError?.message}`);
  }

  private static async storeChunks(
    chunks: ChunkWithEmbedding[],
    documentId: string,
    tenantId: string,
    developmentId: string | null
  ): Promise<void> {
    for (const chunk of chunks) {
      try {
        const embeddingVector = `[${chunk.embedding.join(',')}]`;
        await db.execute(
          sql`
            INSERT INTO doc_chunks (
              tenant_id, development_id, document_id, chunk_index, 
              content, embedding, source_type, source_id, metadata
            ) VALUES (
              ${tenantId}::uuid,
              ${developmentId || null}::uuid,
              ${documentId}::uuid,
              ${chunk.index},
              ${chunk.text},
              ${embeddingVector}::vector,
              'document',
              ${documentId}::uuid,
              ${JSON.stringify(chunk.metadata)}::jsonb
            )
          `
        );
      } catch (error) {
        logger.error(`[DocumentProcessor] Failed to store chunk ${chunk.index}:`, error);
        throw error;
      }
    }
  }
}
