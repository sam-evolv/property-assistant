import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const maxDuration = 300;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// SINGLE SOURCE OF TRUTH - hardcoded Launch project ID
const PROJECT_ID = '57dc3919-2725-4575-8046-9179075ac88e';
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 100;

function splitIntoChunks(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    let chunk = text.slice(start, end);
    
    if (end < text.length) {
      const lastPeriod = chunk.lastIndexOf('.');
      const lastNewline = chunk.lastIndexOf('\n');
      const breakPoint = Math.max(lastPeriod, lastNewline);
      if (breakPoint > CHUNK_SIZE * 0.5) {
        chunk = text.slice(start, start + breakPoint + 1);
      }
    }
    
    chunks.push(chunk.trim());
    start += chunk.length - CHUNK_OVERLAP;
  }
  
  return chunks.filter(c => c.length > 50);
}

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000),
    dimensions: 1536,
  });
  return response.data[0].embedding;
}

async function extractPDFText(buffer: Buffer): Promise<string> {
  try {
    // pdf-parse v1.1.1 - default export is the function
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    console.log('[Upload] PDF parsed successfully:', data.numpages, 'pages');
    return data.text || '';
  } catch (err) {
    console.error('[Upload] PDF parse failed:', err);
    return '';
  }
}

export async function POST(request: NextRequest) {
  console.log('\n' + '='.repeat(60));
  console.log('[Upload] DOCUMENT UPLOAD + TRAIN PIPELINE');
  console.log('[Upload] PROJECT_ID:', PROJECT_ID);
  console.log('='.repeat(60));

  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const metadataStr = formData.get('metadata') as string;
    
    let metadata: { discipline?: string } = {};
    try {
      metadata = metadataStr ? JSON.parse(metadataStr) : {};
    } catch {
      metadata = {};
    }

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    console.log(`[Upload] Processing ${files.length} file(s)`);

    const results = [];

    for (const file of files) {
      if (!file || !(file instanceof File)) continue;

      const fileName = file.name;
      const mimeType = file.type || 'application/octet-stream';
      const fileBuffer = Buffer.from(await file.arrayBuffer());
      const storageName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const storagePath = `${PROJECT_ID}/${storageName}`;

      console.log(`\n[Upload] File: ${fileName}`);
      console.log(`[Upload] Size: ${fileBuffer.length} bytes`);

      // STEP 1: Upload to Storage
      const { error: storageError } = await supabase.storage
        .from('development_docs')
        .upload(storagePath, fileBuffer, { contentType: mimeType, upsert: true });

      if (storageError) {
        console.error('[Upload] Storage error:', storageError.message);
        results.push({ fileName, status: 'failed', error: storageError.message, chunks: 0 });
        continue;
      }

      const { data: urlData } = supabase.storage.from('development_docs').getPublicUrl(storagePath);
      const publicUrl = urlData?.publicUrl || '';
      console.log('[Upload] Stored:', storagePath);

      // STEP 2: Extract text
      let extractedText = '';
      
      if (mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
        extractedText = await extractPDFText(fileBuffer);
      } else if (mimeType.includes('text') || fileName.endsWith('.txt') || fileName.endsWith('.md') || fileName.endsWith('.csv')) {
        extractedText = fileBuffer.toString('utf-8');
      } else {
        // Try as text for unknown types
        extractedText = fileBuffer.toString('utf-8');
      }

      console.log(`[Upload] Extracted text: ${extractedText.length} chars`);

      if (extractedText.length < 50) {
        console.error('[Upload] No readable text extracted');
        results.push({ fileName, status: 'failed', error: 'No text content', chunks: 0 });
        continue;
      }

      // Show a preview of actual text (not binary garbage)
      const preview = extractedText.slice(0, 200).replace(/\s+/g, ' ');
      console.log('[Upload] Preview:', preview);

      // STEP 3: Chunk and embed
      const chunks = splitIntoChunks(extractedText);
      console.log(`[Upload] Created ${chunks.length} chunks`);

      let successCount = 0;
      for (let i = 0; i < chunks.length; i++) {
        try {
          console.log(`[Upload] Embedding chunk ${i + 1}/${chunks.length}...`);
          const embedding = await generateEmbedding(chunks[i]);
          
          const { error: insertError } = await supabase
            .from('document_sections')
            .insert({
              project_id: PROJECT_ID,
              content: chunks[i],
              embedding: embedding,
              metadata: {
                source: fileName.replace(/\.[^/.]+$/, ''),
                file_name: fileName,
                file_url: publicUrl,
                chunk_index: i,
                total_chunks: chunks.length,
                discipline: metadata.discipline || 'other',
              },
            });

          if (!insertError) {
            successCount++;
          } else {
            console.error(`[Upload] Chunk ${i} DB error:`, insertError.message);
          }
        } catch (embErr) {
          console.error(`[Upload] Chunk ${i} error:`, embErr);
        }
      }

      console.log(`[Upload] SUCCESS: ${successCount}/${chunks.length} chunks embedded`);
      
      results.push({
        fileName,
        url: publicUrl,
        status: successCount > 0 ? 'indexed' : 'failed',
        chunks: successCount,
        discipline: metadata.discipline || 'other',
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log('[Upload] COMPLETE');
    console.log('='.repeat(60) + '\n');

    const totalChunks = results.reduce((sum, r) => sum + (r.chunks || 0), 0);
    
    return NextResponse.json({
      success: totalChunks > 0,
      count: totalChunks,
      uploaded: results,
      message: `Processed ${results.length} file(s) with ${totalChunks} chunks`,
    });

  } catch (error) {
    console.error('[Upload] Fatal error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
