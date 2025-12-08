import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { classifyDrawing, DrawingClassification } from '@/lib/drawing-classifier';

export const runtime = 'nodejs';
export const maxDuration = 300;

const pdf = require('pdf-parse');

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
  console.log('[Upload] SIMPLE DOCUMENT UPLOAD');
  console.log('[Upload] PROJECT_ID:', PROJECT_ID);
  console.log('============================================================');

  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    
    // Get discipline from multiple sources: direct field, category field, or metadata JSON
    let discipline = (formData.get('discipline') as string) || (formData.get('category') as string) || '';
    const metadataStr = formData.get('metadata') as string;
    if (!discipline && metadataStr) {
      try {
        const metadata = JSON.parse(metadataStr);
        discipline = metadata.discipline || metadata.category || '';
      } catch (e) {
        // ignore parse errors
      }
    }
    discipline = discipline || 'other';

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    console.log(`[Upload] Processing ${files.length} file(s) with discipline: ${discipline}`);
    const results = [];

    for (const file of files) {
      if (!file || !(file instanceof File)) continue;

      const fileName = file.name;
      const mimeType = file.type || 'application/octet-stream';
      const fileBuffer = Buffer.from(await file.arrayBuffer());
      const docName = fileName.replace(/\.[^/.]+$/, '');

      console.log(`\n[Upload] File: ${fileName} (${fileBuffer.length} bytes)`);

      // STEP 1: Upload to Storage
      const storagePath = `${PROJECT_ID}/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const { error: uploadError } = await supabase.storage
        .from('development_docs')
        .upload(storagePath, fileBuffer, { contentType: mimeType, upsert: true });

      if (uploadError) {
        console.error('[Upload] Storage error:', uploadError.message);
        results.push({ fileName, status: 'failed', error: uploadError.message, chunks: 0 });
        continue;
      }

      const { data: urlData } = supabase.storage.from('development_docs').getPublicUrl(storagePath);
      const fileUrl = urlData?.publicUrl || '';
      console.log('[Upload] Storage OK');

      // STEP 2: Parse PDF
      let extractedText = '';
      try {
        if (mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
          console.log('[Upload] Parsing PDF...');
          const data = await pdf(fileBuffer);
          extractedText = data.text || '';
          console.log(`[Upload] Extracted ${extractedText.length} chars from ${data.numpages} pages`);
        } else {
          extractedText = fileBuffer.toString('utf-8');
        }
      } catch (parseError) {
        console.error('[Upload] Parse error:', parseError);
        results.push({ fileName, status: 'failed', error: 'PDF parsing failed', chunks: 0 });
        continue;
      }

      if (extractedText.length < 50) {
        console.error('[Upload] No text extracted');
        results.push({ fileName, status: 'failed', error: 'No text content', chunks: 0 });
        continue;
      }

      // STEP 3: Classify drawing (for architectural documents)
      let drawingClassification: DrawingClassification | null = null;
      if (discipline === 'architectural' || discipline === 'other') {
        try {
          console.log('[Upload] Classifying drawing...');
          drawingClassification = await classifyDrawing(fileName, docName, extractedText);
          console.log('[Upload] Drawing classification:', {
            houseTypeCode: drawingClassification.houseTypeCode,
            drawingType: drawingClassification.drawingType,
            confidence: drawingClassification.confidence,
          });
        } catch (classifyError) {
          console.error('[Upload] Classification error:', classifyError);
        }
      }

      // STEP 4: Chunk and Embed directly into document_sections
      const chunks = chunkText(extractedText);
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
                source: docName,
                file_name: fileName,
                file_url: fileUrl,
                discipline: discipline.toLowerCase(),
                chunk_index: i,
                total_chunks: chunks.length,
                ...(drawingClassification && {
                  house_type_code: drawingClassification.houseTypeCode,
                  drawing_type: drawingClassification.drawingType,
                  drawing_description: drawingClassification.drawingDescription,
                }),
              },
            });

          if (!insertError) {
            successCount++;
          } else {
            console.error(`[Upload] Insert error:`, insertError.message);
          }
        } catch (embError) {
          console.error(`[Upload] Embed error:`, embError);
        }
      }

      console.log(`[Upload] SUCCESS: ${successCount}/${chunks.length} chunks embedded`);
      results.push({ fileName, status: 'indexed', chunks: successCount });
    }

    console.log('\n============================================================');
    console.log('[Upload] COMPLETE');
    console.log('============================================================\n');

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
