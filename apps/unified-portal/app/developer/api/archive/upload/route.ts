import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const maxDuration = 300;

// Fix PDF Import Crash - use require for CommonJS
const pdf = require('pdf-parse');

// Initialize with Service Role to bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const PROJECT_ID = '57dc3919-2725-4575-8046-9179075ac88e';

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
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

export async function POST(request: NextRequest) {
  console.log('\n============================================================');
  console.log('[Developer Upload] DOCUMENT UPLOAD + TRAIN PIPELINE');
  console.log('[Developer Upload] PROJECT_ID:', PROJECT_ID);
  console.log('============================================================');

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

      console.log(`\n[Developer Upload] File: ${fileName}`);
      console.log(`[Developer Upload] Size: ${fileBuffer.length} bytes`);

      // STEP 1: Upload to Storage
      const storagePath = `${PROJECT_ID}/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

      const { error: uploadError } = await supabase.storage
        .from('development_docs')
        .upload(storagePath, fileBuffer, { contentType: mimeType, upsert: true });

      if (uploadError) {
        console.error('[Developer Upload] Storage error:', uploadError.message);
        results.push({ fileName, status: 'failed', error: uploadError.message, chunks: 0 });
        continue;
      }

      const { data: urlData } = supabase.storage.from('development_docs').getPublicUrl(storagePath);
      const fileUrl = urlData?.publicUrl || '';
      console.log('[Developer Upload] Storage: SUCCESS');

      // STEP 2: Record in documents table
      const { data: docRecord, error: docError } = await supabase
        .from('documents')
        .insert({
          project_id: PROJECT_ID,
          title: fileName.replace(/\.[^/.]+$/, ''),
          file_name: fileName,
          file_url: fileUrl,
          mime_type: mimeType,
          status: 'processing',
        })
        .select()
        .single();

      if (docError) {
        console.error('[Developer Upload] Document record error:', docError.message);
        results.push({ fileName, status: 'failed', error: docError.message, chunks: 0 });
        continue;
      }

      console.log('[Developer Upload] Document ID:', docRecord.id);

      // STEP 3: Parse PDF
      let extractedText = '';

      try {
        if (mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
          console.log('[Developer Upload] Parsing PDF...');
          const data = await pdf(fileBuffer);
          extractedText = data.text || '';
          console.log('[Developer Upload] PDF pages:', data.numpages);
          console.log('[Developer Upload] PDF text:', extractedText.length, 'chars');
        } else {
          extractedText = fileBuffer.toString('utf-8');
        }
      } catch (parseError) {
        console.error('[Developer Upload] Parse error:', parseError);
        await supabase.from('documents').update({ status: 'failed' }).eq('id', docRecord.id);
        results.push({ fileName, status: 'failed', error: 'PDF parsing failed', chunks: 0 });
        continue;
      }

      if (extractedText.length < 50) {
        console.error('[Developer Upload] No readable text');
        await supabase.from('documents').update({ status: 'failed' }).eq('id', docRecord.id);
        results.push({ fileName, status: 'failed', error: 'No text content', chunks: 0 });
        continue;
      }

      console.log('[Developer Upload] Preview:', extractedText.slice(0, 150).replace(/\s+/g, ' '));

      // STEP 4: Chunk and Embed
      const chunks = chunkText(extractedText);
      console.log('[Developer Upload] Chunks:', chunks.length);

      let successCount = 0;
      for (let i = 0; i < chunks.length; i++) {
        try {
          console.log(`[Developer Upload] Embedding ${i + 1}/${chunks.length}...`);
          const embedding = await generateEmbedding(chunks[i]);

          const { error: insertError } = await supabase
            .from('document_sections')
            .insert({
              project_id: PROJECT_ID,
              content: chunks[i],
              embedding: embedding,
              metadata: {
                document_id: docRecord.id,
                source: fileName.replace(/\.[^/.]+$/, ''),
                file_name: fileName,
                file_url: fileUrl,
                chunk_index: i,
                total_chunks: chunks.length,
                discipline: metadata.discipline || 'other',
              },
            });

          if (!insertError) {
            successCount++;
          } else {
            console.error(`[Developer Upload] Insert error:`, insertError.message);
          }
        } catch (embError) {
          console.error(`[Developer Upload] Embed error:`, embError);
        }
      }

      await supabase
        .from('documents')
        .update({ status: successCount > 0 ? 'completed' : 'failed' })
        .eq('id', docRecord.id);

      console.log(`[Developer Upload] SUCCESS: ${successCount}/${chunks.length} chunks`);

      results.push({
        fileName,
        url: fileUrl,
        status: successCount > 0 ? 'indexed' : 'failed',
        chunks: successCount,
        discipline: metadata.discipline || 'other',
      });
    }

    console.log('\n============================================================');
    console.log('[Developer Upload] ALL FILES COMPLETE');
    console.log('============================================================\n');

    const totalChunks = results.reduce((sum, r) => sum + (r.chunks || 0), 0);

    return NextResponse.json({
      success: totalChunks > 0,
      count: totalChunks,
      uploaded: results,
      message: `Processed ${results.length} file(s) with ${totalChunks} chunks`,
    });

  } catch (error) {
    console.error('[Developer Upload] Fatal error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
