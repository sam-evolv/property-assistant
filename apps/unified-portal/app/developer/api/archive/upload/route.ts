import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { classifyDrawing, DrawingClassification } from '@/lib/drawing-classifier';
import { createUploadLogger, FileUploadResult } from '@/lib/logging/upload-logger';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// pdf-parse is a CommonJS module - use dynamic require for Node.js runtime
let pdfParse: (buffer: Buffer) => Promise<{ text: string; numpages: number }>;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  pdfParse = require('pdf-parse');
} catch (e) {
  console.error('[Upload] pdf-parse module not available:', e);
  pdfParse = async () => ({ text: '', numpages: 0 });
}

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// Scheme ID is now passed dynamically - no hardcoded default

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await getOpenAI().embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000),
    dimensions: 1536,
  });
  return response.data[0].embedding;
}

function chunkText(text: string, chunkSize = 1000, overlap = 100): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk.length > 50) {
      chunks.push(chunk);
    }
    start += chunkSize - overlap;
  }
  return chunks;
}

async function verifyDocumentIndexed(
  supabase: ReturnType<typeof getSupabaseClient>,
  fileName: string,
  expectedMinChunks: number,
  schemeId: string
): Promise<{ verified: boolean; sectionsCount: number; error?: string }> {
  try {
    const { data: sections, error: sectionsError } = await supabase
      .from('document_sections')
      .select('id')
      .eq('project_id', schemeId)
      .contains('metadata', { file_name: fileName });

    if (sectionsError) {
      return { verified: false, sectionsCount: 0, error: 'Sections query failed: ' + sectionsError.message };
    }

    const sectionsCount = sections?.length || 0;
    
    if (sectionsCount < expectedMinChunks) {
      return { 
        verified: false, 
        sectionsCount, 
        error: `Expected ${expectedMinChunks} sections, found ${sectionsCount}` 
      };
    }

    return { verified: true, sectionsCount };
  } catch (err) {
    return { verified: false, sectionsCount: 0, error: err instanceof Error ? err.message : 'Verification failed' };
  }
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseClient();
  
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const developmentId = formData.get('developmentId') as string;
    
    if (!developmentId) {
      console.error('[Upload] Missing developmentId - upload rejected');
      return NextResponse.json({ 
        success: false, 
        error: 'schemeId is required',
        files: [] 
      }, { status: 400 });
    }
    
    console.log('[Upload] Uploading to scheme:', developmentId);
    
    let discipline = (formData.get('discipline') as string) || (formData.get('category') as string) || '';
    const metadataStr = formData.get('metadata') as string;
    if (!discipline && metadataStr) {
      try {
        const metadata = JSON.parse(metadataStr);
        discipline = metadata.discipline || metadata.category || '';
      } catch (e) {}
    }
    discipline = discipline || 'other';

    if (!files || files.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'No files provided',
        files: [] 
      }, { status: 400 });
    }

    const results: FileUploadResult[] = [];

    for (const file of files) {
      if (!file || !(file instanceof File)) continue;
      const result = await processFile(supabase, file, discipline, developmentId);
      results.push(result);
    }

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;
    const overallSuccess = failedCount === 0 && successCount > 0;

    return NextResponse.json({
      success: overallSuccess,
      summary: {
        total: results.length,
        succeeded: successCount,
        failed: failedCount,
      },
      files: results,
      uploaded: results.map(r => ({
        fileName: r.fileName,
        status: r.success ? 'indexed' : 'failed',
        chunks: r.chunksIndexed || 0,
        error: r.error,
        discipline: discipline,
      })),
      message: overallSuccess 
        ? `All ${successCount} file(s) uploaded and indexed successfully`
        : `${successCount} succeeded, ${failedCount} failed`,
    });

  } catch (error) {
    console.error('[Upload] Fatal error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
      files: [],
    }, { status: 500 });
  }
}

async function processFile(
  supabase: ReturnType<typeof getSupabaseClient>,
  file: File,
  discipline: string,
  schemeId: string
): Promise<FileUploadResult> {
  const fileName = file.name;
  const logger = createUploadLogger(fileName);
  
  const mimeType = file.type || 'application/octet-stream';
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const docName = fileName.replace(/\.[^/.]+$/, '');

  logger.logStart({
    size: fileBuffer.length,
    mimeType,
    projectId: schemeId,
    discipline,
  });

  let storagePath: string | undefined;
  let fileUrl: string | undefined;

  try {
    storagePath = `${schemeId}/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    
    const { error: uploadError } = await supabase.storage
      .from('development_docs')
      .upload(storagePath, fileBuffer, { contentType: mimeType, upsert: true });

    if (uploadError) {
      logger.logStorageFailure(uploadError.message);
      return logger.logComplete(false, undefined, 0, 0, 'Storage upload failed: ' + uploadError.message);
    }

    const { data: urlData } = supabase.storage.from('development_docs').getPublicUrl(storagePath);
    fileUrl = urlData?.publicUrl || '';
    logger.logStorageSuccess(storagePath, fileUrl);

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Storage upload exception';
    logger.logStorageFailure(errorMsg);
    return logger.logComplete(false, undefined, 0, 0, errorMsg);
  }

  let extractedText = '';
  let pageCount: number | undefined;

  try {
    if (mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
      try {
        const parsed = await pdfParse(fileBuffer);
        extractedText = parsed.text ?? '';
        pageCount = parsed.numpages;
        logger.logTextExtraction(extractedText.length, pageCount);
      } catch (pdfErr) {
        console.error('[Upload] PDF extraction failed:', pdfErr);
        extractedText = '';
        logger.logTextExtractionFailure('PDF extraction failed - continuing upload');
      }
    } else {
      extractedText = fileBuffer.toString('utf-8');
      logger.logTextExtraction(extractedText.length);
    }
  } catch (parseError) {
    const errorMsg = parseError instanceof Error ? parseError.message : 'Parse error';
    console.error('[Upload] Text extraction failed:', errorMsg);
    extractedText = '';
    logger.logTextExtractionFailure(errorMsg);
  }

  const skipIndexing = extractedText.length < 50;
  if (skipIndexing) {
    logger.logTextExtractionFailure('No readable text - skipping indexing');
  }

  let drawingClassification: DrawingClassification | null = null;
  if (discipline === 'architectural' || discipline === 'other') {
    try {
      drawingClassification = await classifyDrawing(fileName, docName, extractedText);
    } catch (classifyError) {
      console.error('[Upload] Classification error:', classifyError);
    }
  }

  // Even if no readable text, create a minimal record so document appears in archive
  if (skipIndexing) {
    console.log('[Upload] Creating minimal record - no readable text for embeddings');
    try {
      const { error: insertError } = await supabase
        .from('document_sections')
        .insert({
          project_id: schemeId,
          content: `[Document: ${fileName}]`,
          embedding: null,
          metadata: {
            source: docName,
            file_name: fileName,
            storage_path: storagePath,
            file_url: fileUrl,
            discipline: discipline,
            chunk_index: 0,
            total_chunks: 1,
            upload_date: new Date().toISOString(),
            mime_type: mimeType,
            page_count: pageCount,
            has_text: false,
            drawing_classification: drawingClassification,
          },
        });

      if (insertError) {
        console.error('[Upload] Failed to insert minimal record:', insertError);
        return logger.logComplete(false, undefined, 0, 0, 'Failed to save document record: ' + insertError.message);
      }
      
      console.log('[Upload] Minimal record created for:', fileName);
      return logger.logComplete(true, undefined, 1, 1, 'Document saved (no AI indexing - no readable text)');
    } catch (err) {
      console.error('[Upload] Exception creating minimal record:', err);
      return logger.logComplete(false, undefined, 0, 0, 'Document saved to storage but database insert failed');
    }
  }

  const chunks = chunkText(extractedText);
  const totalChunks = chunks.length;
  let successCount = 0;
  const indexingErrors: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    try {
      const embedding = await generateEmbedding(chunks[i]);

      const { error: insertError } = await supabase
        .from('document_sections')
        .insert({
          project_id: schemeId,
          content: chunks[i],
          embedding: embedding,
          metadata: {
            source: docName,
            file_name: fileName,
            file_url: fileUrl,
            discipline: discipline.toLowerCase(),
            chunk_index: i,
            total_chunks: totalChunks,
            ...(drawingClassification && {
              house_type_code: drawingClassification.houseTypeCode,
              drawing_type: drawingClassification.drawingType,
              drawing_description: drawingClassification.drawingDescription,
            }),
          },
        });

      if (insertError) {
        indexingErrors.push(`Chunk ${i}: ${insertError.message}`);
      } else {
        successCount++;
      }
    } catch (embError) {
      const msg = embError instanceof Error ? embError.message : 'Unknown embedding error';
      indexingErrors.push(`Chunk ${i}: ${msg}`);
    }
  }

  logger.logIndexingComplete(successCount, totalChunks);

  if (successCount === 0) {
    return logger.logComplete(false, undefined, 0, totalChunks, 'All indexing attempts failed', indexingErrors);
  }

  if (successCount < totalChunks) {
    return logger.logComplete(
      false, 
      undefined, 
      successCount, 
      totalChunks, 
      `Partial indexing failed: ${successCount}/${totalChunks} chunks indexed`, 
      indexingErrors
    );
  }

  const verificationResult = await verifyDocumentIndexed(supabase, fileName, totalChunks, schemeId);

  if (!verificationResult.verified) {
    logger.logVerificationFailure(verificationResult.error || 'Verification failed');
    return logger.logComplete(
      false, 
      undefined, 
      successCount, 
      totalChunks, 
      'Verification failed: ' + verificationResult.error,
      indexingErrors
    );
  }

  logger.logVerificationSuccess(fileName, verificationResult.sectionsCount);

  return logger.logComplete(true, undefined, successCount, totalChunks);
}
