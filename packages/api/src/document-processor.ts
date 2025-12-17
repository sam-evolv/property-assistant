import OpenAI from 'openai';
import { db } from '@openhouse/db/client';
import { documents, doc_chunks, embedding_cache } from '@openhouse/db/schema';
import { eq, sql } from 'drizzle-orm';
import { createHash } from 'crypto';
import { logger } from './logger';
import { extractTextWithOCR, cleanOCRText } from './train/ocr';
import { extractRoomDimensionsFromFloorplan, FloorplanVisionInput } from './train/floorplan-vision';
import { resolveUploadUrl } from './resolve-upload-url';
import { getDocumentProxy } from 'unpdf';

function getOpenAI() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
  });
}

async function extractPDFTextWithUnpdf(buffer: Buffer): Promise<string> {
  const uint8Array = new Uint8Array(buffer);
  const pdf = await getDocumentProxy(uint8Array);
  const numPages = pdf.numPages;
  
  const textParts: string[] = [];
  
  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    const pageText = textContent.items
      .filter((item: any) => 'str' in item)
      .map((item: any) => item.str)
      .join(' ');
    
    if (pageText.trim()) {
      textParts.push(pageText);
    }
  }
  
  return textParts.join('\n\n');
}

export type ProcessingStatus = 'pending' | 'processing' | 'complete' | 'error';
export type DocKind = 'floorplan' | 'specification' | 'warranty' | 'brochure' | 'legal' | 'other' | 'floorplan_summary';

interface ProcessingResult {
  success: boolean;
  documentId: string;
  chunksCreated: number;
  cacheHits: number;
  processingStatus: ProcessingStatus;
  error?: string;
  docKind?: DocKind;
  visionExtracted?: boolean;
}

interface ChunkWithEmbedding {
  text: string;
  index: number;
  embedding: number[];
  metadata: Record<string, any>;
  pageNumber?: number;
}

interface DocumentInfo {
  id: string;
  tenant_id: string;
  development_id: string | null;
  house_type_id: string | null;
  house_type_code: string | null;
  doc_kind: DocKind | null;
  file_name: string;
  mime_type: string | null;
}

const MIN_TEXT_FOR_OCR_SKIP = 200;

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
    developmentId: string | null,
    options: {
      houseTypeId?: string | null;
      houseTypeCode?: string | null;
      docKind?: DocKind | null;
      fileName?: string;
    } = {}
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    const { houseTypeId, houseTypeCode, docKind, fileName } = options;

    try {
      await this.updateProcessingStatus(documentId, 'processing');
      logger.info(`[DocumentProcessor] Starting processing for document ${documentId}`, {
        docKind,
        mimeType,
        fileName,
      });

      if (docKind === 'floorplan') {
        return await this.processFloorplanDocument({
          documentId,
          buffer,
          mimeType,
          tenantId,
          developmentId,
          houseTypeId: houseTypeId || null,
          houseTypeCode: houseTypeCode || null,
          fileName: fileName || 'unknown.pdf',
        });
      } else {
        return await this.processStandardDocument({
          documentId,
          buffer,
          mimeType,
          tenantId,
          developmentId,
          houseTypeId: houseTypeId || null,
          houseTypeCode: houseTypeCode || null,
          docKind: docKind || 'other',
          fileName: fileName || 'document',
        });
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error(`[DocumentProcessor] Failed to process document ${documentId}:`, error);

      await this.updateProcessingStatus(documentId, 'error', error.message);

      return {
        success: false,
        documentId,
        chunksCreated: 0,
        cacheHits: 0,
        processingStatus: 'error',
        error: error.message,
        docKind: docKind || undefined,
      };
    }
  }

  private static async processFloorplanDocument(params: {
    documentId: string;
    buffer: Buffer;
    mimeType: string;
    tenantId: string;
    developmentId: string | null;
    houseTypeId: string | null;
    houseTypeCode: string | null;
    fileName: string;
  }): Promise<ProcessingResult> {
    const { documentId, buffer, mimeType, tenantId, developmentId, houseTypeId, houseTypeCode, fileName } = params;
    const startTime = Date.now();

    logger.info(`[DocumentProcessor] Processing floorplan document: ${fileName}`);

    let visionExtracted = false;
    let roomsExtracted = 0;

    if (developmentId && houseTypeId && houseTypeCode) {
      try {
        const visionInput: FloorplanVisionInput = {
          tenant_id: tenantId,
          development_id: developmentId,
          house_type_id: houseTypeId,
          unit_type_code: houseTypeCode,
          document_id: documentId,
          buffer,
          fileName,
        };

        const visionResult = await extractRoomDimensionsFromFloorplan(visionInput);

        if (visionResult.success) {
          visionExtracted = true;
          roomsExtracted = visionResult.roomsExtracted;
          logger.info(`[DocumentProcessor] Vision extraction successful: ${roomsExtracted} rooms`);

          const summaryChunks = await this.generateFloorplanSummaries(
            visionResult.rawPayload,
            houseTypeCode,
            fileName
          );

          const { chunksWithEmbeddings, cacheHits } = await this.generateEmbeddings(summaryChunks, tenantId);

          await this.deleteExistingChunks(documentId);

          await this.storeChunks(chunksWithEmbeddings, documentId, tenantId, developmentId, {
            houseTypeId,
            houseTypeCode,
            docKind: 'floorplan_summary',
          });

          await this.updateProcessingStatus(documentId, 'complete');

          const duration = Date.now() - startTime;
          logger.info(`[DocumentProcessor] Floorplan processing complete in ${duration}ms`, {
            documentId,
            chunksCreated: chunksWithEmbeddings.length,
            roomsExtracted,
          });

          return {
            success: true,
            documentId,
            chunksCreated: chunksWithEmbeddings.length,
            cacheHits,
            processingStatus: 'complete',
            docKind: 'floorplan',
            visionExtracted: true,
          };
        } else {
          logger.warn(`[DocumentProcessor] Vision extraction failed, falling back to standard processing: ${visionResult.error}`);
        }
      } catch (visionError: any) {
        logger.error(`[DocumentProcessor] Vision extraction error, falling back to standard processing:`, visionError);
      }
    } else {
      logger.warn(`[DocumentProcessor] Missing house type info for floorplan, using standard processing`);
    }

    return await this.processStandardDocument({
      documentId,
      buffer,
      mimeType,
      tenantId,
      developmentId,
      houseTypeId,
      houseTypeCode,
      docKind: 'floorplan',
      fileName,
    });
  }

  private static async generateFloorplanSummaries(
    visionPayload: any,
    houseTypeCode: string,
    fileName: string
  ): Promise<Array<{ text: string; index: number; metadata: Record<string, any> }>> {
    const chunks: Array<{ text: string; index: number; metadata: Record<string, any> }> = [];

    if (!visionPayload?.levels) {
      return chunks;
    }

    let totalArea = 0;
    const allRooms: string[] = [];

    for (const level of visionPayload.levels) {
      const levelRooms: string[] = [];

      for (const room of level.rooms || []) {
        const roomDesc = room.length_m && room.width_m
          ? `${room.room_name} (${room.length_m}m × ${room.width_m}m = ${room.area_m2}m²)`
          : `${room.room_name} (${room.area_m2}m²)`;

        levelRooms.push(roomDesc);
        allRooms.push(`${level.level_name}: ${roomDesc}`);
        totalArea += room.area_m2 || 0;
      }

      if (levelRooms.length > 0) {
        const levelSummary = `${level.level_name} of house type ${houseTypeCode} contains: ${levelRooms.join(', ')}.`;
        chunks.push({
          text: levelSummary,
          index: chunks.length,
          metadata: {
            type: 'floorplan_summary',
            level: level.level_name,
            houseTypeCode,
            roomCount: levelRooms.length,
            fileName,
          },
        });
      }
    }

    if (allRooms.length > 0) {
      const houseSummary = `House type ${houseTypeCode} has a total floor area of approximately ${totalArea.toFixed(1)}m². ` +
        `The property includes: ${allRooms.join('; ')}.`;

      chunks.push({
        text: houseSummary,
        index: chunks.length,
        metadata: {
          type: 'floorplan_house_summary',
          houseTypeCode,
          totalArea,
          roomCount: allRooms.length,
          fileName,
        },
      });
    }

    return chunks;
  }

  private static async processStandardDocument(params: {
    documentId: string;
    buffer: Buffer;
    mimeType: string;
    tenantId: string;
    developmentId: string | null;
    houseTypeId: string | null;
    houseTypeCode: string | null;
    docKind: DocKind;
    fileName: string;
  }): Promise<ProcessingResult> {
    const { documentId, buffer, mimeType, tenantId, developmentId, houseTypeId, houseTypeCode, docKind, fileName } = params;
    const startTime = Date.now();

    logger.info(`[DocumentProcessor] Processing standard document: ${fileName} (${docKind})`);

    let extractedText = await this.extractText(buffer, mimeType);
    let usedOCR = false;

    if ((!extractedText || extractedText.length < MIN_TEXT_FOR_OCR_SKIP) && this.isImageOrPDF(mimeType)) {
      logger.info(`[DocumentProcessor] Text too short (${extractedText?.length || 0} chars), attempting OCR`);
      try {
        const ocrResult = await extractTextWithOCR(buffer, fileName);
        if (ocrResult.text && ocrResult.text.length > (extractedText?.length || 0)) {
          extractedText = cleanOCRText(ocrResult.text);
          usedOCR = true;
          logger.info(`[DocumentProcessor] OCR extracted ${extractedText.length} characters (confidence: ${ocrResult.confidence}%)`);
        }
      } catch (ocrError: any) {
        logger.warn(`[DocumentProcessor] OCR failed, using original text:`, { error: ocrError.message });
      }
    }

    if (!extractedText || extractedText.length === 0) {
      throw new Error('No text could be extracted from document');
    }

    logger.info(`[DocumentProcessor] Extracted ${extractedText.length} characters (OCR: ${usedOCR})`);

    const chunks = this.createSmartChunks(extractedText);
    logger.info(`[DocumentProcessor] Created ${chunks.length} chunks`);

    const { chunksWithEmbeddings, cacheHits } = await this.generateEmbeddings(chunks, tenantId);
    logger.info(`[DocumentProcessor] Generated embeddings (${cacheHits}/${chunks.length} cache hits)`);

    await this.deleteExistingChunks(documentId);

    await this.storeChunks(chunksWithEmbeddings, documentId, tenantId, developmentId, {
      houseTypeId,
      houseTypeCode,
      docKind,
    });

    await this.updateProcessingStatus(documentId, 'complete');

    const duration = Date.now() - startTime;
    logger.info(`[DocumentProcessor] Completed in ${duration}ms`, {
      documentId,
      chunksCreated: chunksWithEmbeddings.length,
      cacheHits,
      usedOCR,
    });

    return {
      success: true,
      documentId,
      chunksCreated: chunksWithEmbeddings.length,
      cacheHits,
      processingStatus: 'complete',
      docKind,
    };
  }

  private static async updateProcessingStatus(
    documentId: string,
    status: ProcessingStatus,
    error?: string
  ): Promise<void> {
    try {
      await db
        .update(documents)
        .set({
          processing_status: status,
          processing_error: error || null,
          updated_at: new Date(),
        })
        .where(eq(documents.id, documentId));
    } catch (dbError: any) {
      logger.error(`[DocumentProcessor] Failed to update processing status:`, { error: dbError?.message });
    }
  }

  private static async deleteExistingChunks(documentId: string): Promise<void> {
    try {
      await db.execute(sql`DELETE FROM doc_chunks WHERE document_id = ${documentId}::uuid`);
    } catch (error: any) {
      logger.warn(`[DocumentProcessor] Failed to delete existing chunks:`, { error: error?.message });
    }
  }

  private static isImageOrPDF(mimeType: string): boolean {
    return mimeType === 'application/pdf' ||
           mimeType.startsWith('image/');
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
      } else if (mimeType.startsWith('image/')) {
        return '';
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
      const text = await extractPDFTextWithUnpdf(buffer);
      return text.replace(/\s+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
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
        where: eq(embedding_cache.hash, textHash),
      });

      let embedding: number[];

      if (cached && cached.embedding) {
        embedding = cached.embedding as number[];
        cacheHits++;
        logger.info(`[DocumentProcessor] Cache hit for chunk ${i + 1}/${chunks.length}`);

        try {
          await db.execute(sql`
            UPDATE embedding_cache 
            SET last_accessed = NOW(), access_count = access_count + 1 
            WHERE hash = ${textHash}
          `);
        } catch {}
      } else {
        embedding = await this.generateEmbeddingWithRetry(chunk.text, i, chunks.length);

        try {
          await db.insert(embedding_cache).values({
            hash: textHash,
            embedding: embedding,
            model: this.EMBEDDING_MODEL,
          }).onConflictDoNothing();
        } catch (cacheError: any) {
          logger.warn(`[DocumentProcessor] Failed to cache embedding:`, cacheError.message);
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
        
        const response = await getOpenAI().embeddings.create({
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
    developmentId: string | null,
    options: {
      houseTypeId?: string | null;
      houseTypeCode?: string | null;
      docKind?: DocKind | null;
    } = {}
  ): Promise<void> {
    const { houseTypeCode, docKind } = options;

    for (const chunk of chunks) {
      try {
        const embeddingVector = `[${chunk.embedding.join(',')}]`;
        const metadata = {
          ...chunk.metadata,
          docKind: docKind || 'other',
        };

        await db.execute(
          sql`
            INSERT INTO doc_chunks (
              tenant_id, development_id, document_id, chunk_index, 
              content, embedding, source_type, source_id, house_type_code, doc_kind, metadata
            ) VALUES (
              ${tenantId}::uuid,
              ${developmentId || null}::uuid,
              ${documentId}::uuid,
              ${chunk.index},
              ${chunk.text},
              ${embeddingVector}::vector,
              ${docKind || 'document'},
              ${documentId}::uuid,
              ${houseTypeCode || null},
              ${docKind || null},
              ${JSON.stringify(metadata)}::jsonb
            )
          `
        );
      } catch (error: any) {
        logger.error(`[DocumentProcessor] Failed to store chunk ${chunk.index}:`, { error: error?.message });
        throw error;
      }
    }
  }

  static async reprocessDocument(documentId: string): Promise<ProcessingResult> {
    logger.info(`[DocumentProcessor] Reprocessing document ${documentId}`);

    const doc = await db.query.documents.findFirst({
      where: eq(documents.id, documentId),
    });

    if (!doc) {
      throw new Error(`Document not found: ${documentId}`);
    }

    if (!doc.file_url && !doc.storage_url) {
      throw new Error(`Document has no file URL: ${documentId}`);
    }

    const rawUrl = doc.file_url || doc.storage_url;
    const fileUrl = resolveUploadUrl(rawUrl!);
    logger.info(`[DocumentProcessor] Resolved URL: ${rawUrl} -> ${fileUrl}`);
    
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to download document: ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    return this.processDocument(
      documentId,
      buffer,
      doc.mime_type || 'application/octet-stream',
      doc.tenant_id,
      doc.development_id || null,
      {
        houseTypeId: doc.house_type_id || null,
        houseTypeCode: doc.house_type_code || null,
        docKind: (doc.doc_kind as DocKind) || null,
        fileName: doc.file_name || doc.original_file_name || 'document',
      }
    );
  }
}

export async function processDocumentById(documentId: string): Promise<ProcessingResult> {
  return DocumentProcessor.reprocessDocument(documentId);
}
