import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse');

export const runtime = 'nodejs';
export const maxDuration = 300;

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
    input: text,
    dimensions: 1536,
  });
  return response.data[0].embedding;
}

async function extractText(buffer: Buffer, mimeType: string, fileName: string): Promise<string> {
  if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
    try {
      const pdfData = await pdfParse(buffer);
      return pdfData.text || '';
    } catch (err) {
      console.error('[Upload] PDF parse error:', err);
      return '';
    }
  }
  
  if (mimeType.includes('text') || fileName.endsWith('.txt') || fileName.endsWith('.csv')) {
    return buffer.toString('utf-8');
  }
  
  return '';
}

export async function POST(request: NextRequest) {
  console.log('\n' + '='.repeat(60));
  console.log('[Developer Upload] SUPABASE UPLOAD + TRAIN PIPELINE');
  console.log('='.repeat(60));

  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const developmentId = (formData.get('developmentId') as string) || PROJECT_ID;
    const metadataStr = formData.get('metadata') as string;
    
    let metadata: { discipline?: string; houseTypeId?: string; isImportant?: boolean; mustRead?: boolean } = {};
    try {
      metadata = metadataStr ? JSON.parse(metadataStr) : {};
    } catch {
      metadata = {};
    }

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    console.log(`[Developer Upload] Processing ${files.length} file(s) for project ${developmentId}`);

    const uploadedDocuments = [];

    for (const file of files) {
      if (!file || !(file instanceof File)) continue;

      const fileName = file.name;
      const mimeType = file.type || 'application/octet-stream';
      const buffer = Buffer.from(await file.arrayBuffer());
      const storageName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const storagePath = `${developmentId}/${storageName}`;

      console.log(`\n[Developer Upload] File: ${fileName} (${mimeType})`);

      // Step 1: Upload to Supabase Storage
      let publicUrl = '';
      const { error: uploadError } = await supabase.storage
        .from('development_docs')
        .upload(storagePath, buffer, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) {
        console.error('[Developer Upload] Storage error:', uploadError.message);
        if (uploadError.message.includes('not found')) {
          await supabase.storage.createBucket('development_docs', { public: true });
          await supabase.storage.from('development_docs').upload(storagePath, buffer, { contentType: mimeType });
        }
      }

      const { data: urlData } = supabase.storage.from('development_docs').getPublicUrl(storagePath);
      publicUrl = urlData?.publicUrl || '';
      console.log('[Developer Upload] Stored at:', publicUrl);

      // Step 2: Extract text
      const extractedText = await extractText(buffer, mimeType, fileName);
      console.log(`[Developer Upload] Extracted ${extractedText.length} characters`);

      // Step 3: Chunk and embed (INLINE - directly to Supabase document_sections)
      let chunksEmbedded = 0;
      
      if (extractedText.length > 50) {
        const chunks = splitIntoChunks(extractedText);
        console.log(`[Developer Upload] Split into ${chunks.length} chunks, generating embeddings...`);

        for (let i = 0; i < chunks.length; i++) {
          try {
            const embedding = await generateEmbedding(chunks[i]);
            
            const { error: insertError } = await supabase
              .from('document_sections')
              .insert({
                project_id: developmentId,
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
              chunksEmbedded++;
            } else {
              console.error(`[Developer Upload] Chunk ${i} error:`, insertError.message);
            }
          } catch (embErr) {
            console.error(`[Developer Upload] Embedding error chunk ${i}:`, embErr);
          }
        }

        console.log(`[Developer Upload] ✅ Embedded ${chunksEmbedded}/${chunks.length} chunks to Supabase`);
      } else {
        console.log('[Developer Upload] No text extracted, skipping AI training');
      }

      uploadedDocuments.push({
        id: crypto.randomUUID(),
        fileName,
        url: publicUrl,
        discipline: metadata.discipline || 'other',
        chunksEmbedded,
        status: 'completed',
        aiClassified: false,
      });
    }

    console.log('\n[Developer Upload] ✅ ALL FILES PROCESSED TO SUPABASE');
    console.log('='.repeat(60) + '\n');

    return NextResponse.json({
      success: true,
      uploaded: uploadedDocuments,
      message: `Uploaded ${uploadedDocuments.length} document(s) and created ${uploadedDocuments.reduce((sum, r) => sum + r.chunksEmbedded, 0)} chunks`,
    });

  } catch (error) {
    console.error('[Developer Upload] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
