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

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParseModule = require('pdf-parse');
    const PDFParse = pdfParseModule.PDFParse;
    
    console.log('[Upload] Using pdf-parse v2.x PDFParse class');
    
    // v2.x API: Create parser with options object containing data
    const parser = new PDFParse({
      data: new Uint8Array(buffer),
      verbosity: 0,
    });
    
    // Parse and extract text
    const doc = await parser.parse();
    let text = '';
    
    // Get all pages and join text
    const numPages = doc.numPages || 0;
    console.log(`[Upload] PDF has ${numPages} pages`);
    
    for (let i = 1; i <= numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((item: { str?: string }) => item.str || '').join(' ');
      text += pageText + '\n';
    }
    
    text = text.trim();
    console.log(`[Upload] PDF parsed: ${text.length} characters`);
    
    if (text.length > 0) {
      console.log('[Upload] Text preview:', text.slice(0, 200).replace(/\n/g, ' '));
      return text;
    }
    
    throw new Error('No text extracted from PDF');
  } catch (err) {
    console.error('[Upload] PDF parse error:', err);
    
    // Fallback: try to extract any readable text from buffer
    try {
      const rawText = buffer.toString('utf-8');
      const readable = rawText.replace(/[^\x20-\x7E\n\r]/g, '').trim();
      if (readable.length > 100) {
        console.log('[Upload] Fallback: extracted', readable.length, 'chars from raw buffer');
        return readable;
      }
    } catch {
      // Ignore fallback error
    }
    
    return '';
  }
}

async function extractText(buffer: Buffer, mimeType: string, fileName: string): Promise<string> {
  if (mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
    return await extractTextFromPdf(buffer);
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
    const metadataStr = formData.get('metadata') as string;
    
    const projectId = PROJECT_ID;
    
    let metadata: { discipline?: string; houseTypeId?: string; isImportant?: boolean; mustRead?: boolean } = {};
    try {
      metadata = metadataStr ? JSON.parse(metadataStr) : {};
    } catch {
      metadata = {};
    }

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    console.log(`[Developer Upload] Processing ${files.length} file(s) for project ${projectId}`);

    const uploadedDocuments = [];

    for (const file of files) {
      if (!file || !(file instanceof File)) continue;

      const fileName = file.name;
      const mimeType = file.type || 'application/octet-stream';
      const buffer = Buffer.from(await file.arrayBuffer());
      const storageName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const storagePath = `${projectId}/${storageName}`;

      console.log(`\n[Developer Upload] File: ${fileName} (${mimeType})`);

      // Step A: Upload to Supabase Storage
      let publicUrl = '';
      const { error: uploadError } = await supabase.storage
        .from('development_docs')
        .upload(storagePath, buffer, {
          contentType: mimeType,
          upsert: true,
        });

      if (uploadError) {
        console.error('[Developer Upload] Storage error:', uploadError.message);
        return NextResponse.json(
          { error: `Storage upload failed: ${uploadError.message}` },
          { status: 500 }
        );
      }

      const { data: urlData } = supabase.storage.from('development_docs').getPublicUrl(storagePath);
      publicUrl = urlData?.publicUrl || '';
      console.log('[Developer Upload] Stored at:', publicUrl);

      // Step B: Extract text from PDF
      const extractedText = await extractText(buffer, mimeType, fileName);
      console.log(`[Developer Upload] Extracted ${extractedText.length} characters`);

      // Step C: Chunk and embed
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
                project_id: projectId,
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
              console.error(`[Developer Upload] Chunk ${i} DB error:`, insertError.message);
              return NextResponse.json(
                { error: `Database insert failed: ${insertError.message}` },
                { status: 500 }
              );
            }
          } catch (embErr) {
            console.error(`[Developer Upload] Embedding error chunk ${i}:`, embErr);
            return NextResponse.json(
              { error: `Embedding generation failed: ${embErr instanceof Error ? embErr.message : 'Unknown error'}` },
              { status: 500 }
            );
          }
        }

        console.log(`[Developer Upload] Embedded ${chunksEmbedded}/${chunks.length} chunks to Supabase`);
      } else {
        console.log('[Developer Upload] No text extracted, storing metadata only');
        const embedding = await generateEmbedding(`Document: ${fileName}`);
        const { error: insertError } = await supabase
          .from('document_sections')
          .insert({
            project_id: projectId,
            content: `Document: ${fileName}`,
            embedding: embedding,
            metadata: {
              source: fileName.replace(/\.[^/.]+$/, ''),
              file_name: fileName,
              file_url: publicUrl,
              chunk_index: 0,
              total_chunks: 1,
              discipline: metadata.discipline || 'other',
              no_text_content: true,
            },
          });
        
        if (insertError) {
          console.error('[Developer Upload] Metadata insert error:', insertError.message);
          return NextResponse.json(
            { error: `Database insert failed: ${insertError.message}` },
            { status: 500 }
          );
        }
        chunksEmbedded = 1;
      }

      uploadedDocuments.push({
        id: crypto.randomUUID(),
        fileName,
        url: publicUrl,
        discipline: metadata.discipline || 'other',
        chunksEmbedded,
        status: 'indexed',
      });
    }

    console.log('\n[Developer Upload] ALL FILES PROCESSED TO SUPABASE');
    console.log('='.repeat(60) + '\n');

    return NextResponse.json({
      success: true,
      count: uploadedDocuments.reduce((sum, r) => sum + r.chunksEmbedded, 0),
      uploaded: uploadedDocuments,
      message: `Uploaded ${uploadedDocuments.length} document(s) with ${uploadedDocuments.reduce((sum, r) => sum + r.chunksEmbedded, 0)} chunks`,
    });

  } catch (error) {
    console.error('[Developer Upload] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
