import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const maxDuration = 300;

// Use require for pdf-parse to avoid ESM/CommonJS conflicts
const pdf = require('pdf-parse');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

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

export async function POST(request: NextRequest) {
  console.log('\n' + '='.repeat(60));
  console.log('[Developer Upload] DOCUMENT UPLOAD + TRAIN PIPELINE');
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

    console.log(`[Developer Upload] Processing ${files.length} file(s)`);

    const results = [];

    for (const file of files) {
      if (!file || !(file instanceof File)) continue;

      const fileName = file.name;
      const mimeType = file.type || 'application/octet-stream';
      const fileBuffer = Buffer.from(await file.arrayBuffer());
      const storageName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const storagePath = `${PROJECT_ID}/${storageName}`;

      console.log(`\n[Developer Upload] File: ${fileName} (${mimeType})`);
      console.log(`[Developer Upload] Size: ${fileBuffer.length} bytes`);

      // STEP 1: Upload to Storage
      const { error: storageError } = await supabase.storage
        .from('development_docs')
        .upload(storagePath, fileBuffer, { contentType: mimeType, upsert: true });

      if (storageError) {
        console.error('[Developer Upload] Storage error:', storageError.message);
        results.push({ fileName, status: 'failed', error: storageError.message });
        continue;
      }

      const { data: urlData } = supabase.storage.from('development_docs').getPublicUrl(storagePath);
      const publicUrl = urlData?.publicUrl || '';
      console.log('[Developer Upload] Stored:', storagePath);

      // STEP 2: Parse PDF or extract text
      let extractedText = '';
      
      if (mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
        console.log('[Developer Upload] Parsing PDF...');
        try {
          const pdfData = await pdf(fileBuffer);
          extractedText = pdfData.text || '';
          console.log(`[Developer Upload] PDF: ${extractedText.length} characters`);
        } catch (pdfErr) {
          console.error('[Developer Upload] PDF error:', pdfErr);
          results.push({ fileName, status: 'failed', error: 'PDF parsing failed' });
          continue;
        }
      } else if (mimeType.includes('text') || fileName.endsWith('.txt') || fileName.endsWith('.md')) {
        extractedText = fileBuffer.toString('utf-8');
      } else {
        const rawText = fileBuffer.toString('utf-8');
        extractedText = rawText.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
      }

      if (extractedText.length < 50) {
        console.error('[Developer Upload] No text extracted');
        results.push({ fileName, status: 'failed', error: 'No text content' });
        continue;
      }

      // STEP 3: Chunk and embed
      const chunks = splitIntoChunks(extractedText);
      console.log(`[Developer Upload] ${chunks.length} chunks to embed`);

      let successCount = 0;
      for (let i = 0; i < chunks.length; i++) {
        try {
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

          if (!insertError) successCount++;
        } catch (embErr) {
          console.error(`[Developer Upload] Chunk ${i} error:`, embErr);
        }
      }

      console.log(`[Developer Upload] Embedded ${successCount}/${chunks.length} chunks`);
      
      results.push({
        fileName,
        url: publicUrl,
        status: successCount > 0 ? 'indexed' : 'failed',
        chunks: successCount,
      });
    }

    console.log('\n[Developer Upload] ALL FILES PROCESSED');
    console.log('='.repeat(60) + '\n');

    const totalChunks = results.reduce((sum, r) => sum + (r.chunks || 0), 0);
    
    return NextResponse.json({
      success: totalChunks > 0,
      count: totalChunks,
      uploaded: results,
      message: `Processed ${results.length} file(s) with ${totalChunks} total chunks`,
    });

  } catch (error) {
    console.error('[Developer Upload] Fatal error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
