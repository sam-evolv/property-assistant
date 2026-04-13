/**
 * POST /api/ingest/document
 *
 * Internal background route — fetches a document, extracts text, chunks it,
 * embeds each chunk with text-embedding-3-small, and inserts rows into
 * document_sections so the homeowner AI assistant can query them.
 *
 * Called fire-and-forget from upload routes. Protected by INGEST_SECRET.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120; // embedding can take a while for large docs

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { db } from '@openhouse/db/client';
import { documents } from '@openhouse/db/schema';
import { eq } from 'drizzle-orm';

// Same mapping as archive/upload route — maps Drizzle development_id → Supabase project_id
const DEVELOPMENT_TO_SUPABASE_PROJECT: Record<string, string> = {
  '34316432-f1e8-4297-b993-d9b5c88ee2d8': '57dc3919-2725-4575-8046-9179075ac88e',
  'e0833063-55ac-4201-a50e-f329c090fbd6': '6d3789de-2e46-430c-bf31-22224bd878da',
  '39c49eeb-54a6-4b04-a16a-119012c531cb': '9598cf36-3e3f-4b7d-be6d-d1e80f708f46',
  '84a559d1-89f1-4eb6-a48b-7ca068bcc164': '84a559d1-89f1-4eb6-a48b-7ca068bcc164',
};

function getSupabaseProjectId(developmentId: string): string {
  return DEVELOPMENT_TO_SUPABASE_PROJECT[developmentId] || developmentId;
}

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
}

// Split text into overlapping chunks suitable for embedding.
// Target: ~1200 chars per chunk. Split on paragraph breaks first, then
// sentence boundaries for long paragraphs. Overlap: 150 chars.
function chunkText(text: string, maxSize = 1200, overlap = 150): string[] {
  // Normalise whitespace but preserve paragraph structure
  const normalised = text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ');
  const paragraphs = normalised
    .split(/\n{2,}/)
    .map(p => p.replace(/\n/g, ' ').trim())
    .filter(p => p.length >= 50);

  if (paragraphs.length === 0) return [];

  const chunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    // If this paragraph alone exceeds maxSize, split at sentence boundaries
    if (para.length > maxSize) {
      // Flush what we have
      if (current.trim().length >= 50) {
        chunks.push(current.trim());
        current = current.slice(-overlap);
      }
      // Split the long paragraph at sentence boundaries
      const sentences = para.match(/[^.!?]+[.!?]+(\s|$)/g) || [para];
      for (const sentence of sentences) {
        if (current.length + sentence.length + 1 > maxSize && current.length > 0) {
          if (current.trim().length >= 50) chunks.push(current.trim());
          current = current.slice(-overlap) + ' ' + sentence;
        } else {
          current = current ? current + ' ' + sentence : sentence;
        }
      }
    } else if (current.length + para.length + 2 > maxSize && current.length > 0) {
      if (current.trim().length >= 50) chunks.push(current.trim());
      current = current.slice(-overlap) + '\n\n' + para;
    } else {
      current = current ? current + '\n\n' + para : para;
    }
  }

  if (current.trim().length >= 50) chunks.push(current.trim());

  return chunks;
}

// Extract text from a PDF buffer using pdf-parse
async function extractPdfText(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfMod = await import('pdf-parse') as any;
  const pdfParse = pdfMod.default ?? pdfMod;
  const data = await pdfParse(buffer);
  // Clean up common PDF noise: excessive whitespace, page number lines
  return (data.text || '')
    .replace(/\f/g, '\n')
    .replace(/[ \t]{3,}/g, '  ')
    .replace(/^\s*\d+\s*$/gm, '') // standalone page numbers
    .trim();
}

// Generate embeddings for an array of texts, batching 20 at a time.
// Returns parallel array of embedding vectors.
async function embedBatch(texts: string[]): Promise<number[][]> {
  const openai = getOpenAI();
  const BATCH_SIZE = 20;
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: batch,
    });
    // response.data is ordered to match input order
    for (const item of response.data) {
      results.push(item.embedding);
    }
    // Small delay between batches to stay within rate limits
    if (i + BATCH_SIZE < texts.length) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  return results;
}

// Mark document as failed and persist the error message
async function markFailed(docId: string, errorMessage: string): Promise<void> {
  try {
    await db.update(documents)
      .set({
        processing_status: 'failed',
        processing_error: errorMessage.slice(0, 1000), // cap length
        updated_at: new Date(),
      })
      .where(eq(documents.id, docId));
  } catch {
    // best-effort — never throw from error handler
  }
}

export async function POST(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const secret = request.headers.get('x-ingest-secret');
  const expectedSecret = process.env.INGEST_SECRET;
  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let documentId: string;
  try {
    const body = await request.json();
    documentId = body?.document_id;
    if (!documentId) throw new Error('missing document_id');
  } catch (e) {
    return NextResponse.json(
      { error: 'document_id is required' },
      { status: 400 }
    );
  }

  // ── Fetch document row ────────────────────────────────────────────────────
  let doc: typeof documents.$inferSelect;
  try {
    const rows = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1);
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    doc = rows[0];
  } catch (e) {
    return NextResponse.json({ error: 'DB read failed' }, { status: 500 });
  }

  const supabase = getSupabaseAdmin();
  // Prefer the project_id stored on the document row (set at upload time).
  // Fall back to the hardcoded mapping for documents inserted before this column existed.
  const supabaseProjectId = doc.project_id || getSupabaseProjectId(doc.development_id || '');

  try {
    // ── Idempotency: remove any existing sections for this document ───────
    // Matches by file_name + project_id so re-ingesting replaces stale chunks
    try {
      await supabase
        .from('document_sections')
        .delete()
        .eq('project_id', supabaseProjectId)
        .filter('metadata->>file_name', 'eq', doc.file_name);
    } catch {
      // Non-fatal — continue even if cleanup fails
    }

    // ── Get file content ──────────────────────────────────────────────────
    let fileBuffer: Buffer | null = null;

    // Try Supabase Storage first (relative_path set by archive/upload route)
    const storagePath = doc.relative_path;
    const isStoragePath = storagePath &&
      !storagePath.startsWith('http') &&
      storagePath.includes('/');

    if (isStoragePath) {
      try {
        const { data: blobData, error: dlErr } = await supabase.storage
          .from('development_docs')
          .download(storagePath);
        if (!dlErr && blobData) {
          fileBuffer = Buffer.from(await blobData.arrayBuffer());
        }
      } catch {
        // fall through to URL fetch
      }
    }

    // Fallback: fetch from file_url or storage_url
    if (!fileBuffer) {
      const fetchUrl = doc.file_url || doc.storage_url;
      if (!fetchUrl) {
        await markFailed(documentId, 'No storage path or file URL available');
        return NextResponse.json(
          { error: 'No storage path or file URL' },
          { status: 400 }
        );
      }
      try {
        const res = await fetch(fetchUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        fileBuffer = Buffer.from(await res.arrayBuffer());
      } catch (fetchErr) {
        const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
        await markFailed(documentId, `File fetch failed: ${msg}`);
        return NextResponse.json({ error: 'File fetch failed' }, { status: 502 });
      }
    }

    // ── Extract text ──────────────────────────────────────────────────────
    let extractedText = '';
    const mimeType = doc.mime_type || '';
    const fileName = (doc.file_name || '').toLowerCase();

    if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
      try {
        extractedText = await extractPdfText(fileBuffer);
      } catch (pdfErr) {
        const msg = pdfErr instanceof Error ? pdfErr.message : String(pdfErr);
        await markFailed(documentId, `PDF parse failed: ${msg}`);
        return NextResponse.json({ error: 'PDF parse failed' }, { status: 422 });
      }
    } else if (mimeType === 'text/plain' || fileName.endsWith('.txt')) {
      extractedText = fileBuffer.toString('utf-8');
    } else {
      // Unsupported type — mark complete with 0 chunks (not an error)
      await db.update(documents)
        .set({
          processing_status: 'complete',
          upload_status: 'indexed',
          chunks_count: 0,
          updated_at: new Date(),
        })
        .where(eq(documents.id, documentId));
      return NextResponse.json({
        success: true,
        document_id: documentId,
        chunks_inserted: 0,
        note: 'Unsupported file type — no text extracted',
      });
    }

    if (extractedText.length < 50) {
      // Nothing useful extracted
      await db.update(documents)
        .set({
          processing_status: 'complete',
          upload_status: 'indexed',
          chunks_count: 0,
          updated_at: new Date(),
        })
        .where(eq(documents.id, documentId));
      return NextResponse.json({
        success: true,
        document_id: documentId,
        chunks_inserted: 0,
        note: 'No text content found in document',
      });
    }

    // ── Chunk ─────────────────────────────────────────────────────────────
    const chunks = chunkText(extractedText);
    if (chunks.length === 0) {
      await db.update(documents)
        .set({ processing_status: 'complete', upload_status: 'indexed', chunks_count: 0, updated_at: new Date() })
        .where(eq(documents.id, documentId));
      return NextResponse.json({ success: true, document_id: documentId, chunks_inserted: 0 });
    }

    // ── Embed ─────────────────────────────────────────────────────────────
    let embeddings: number[][];
    try {
      embeddings = await embedBatch(chunks);
    } catch (embErr) {
      const msg = embErr instanceof Error ? embErr.message : String(embErr);
      await markFailed(documentId, `Embedding failed: ${msg}`);
      return NextResponse.json({ error: 'Embedding failed' }, { status: 500 });
    }

    // ── Insert document_sections ──────────────────────────────────────────
    const fileUrl = doc.file_url || doc.storage_url || null;
    const discipline = doc.discipline || 'general';
    const title = doc.title || doc.file_name;
    const houseTypeCode = doc.house_type_code || null;

    let chunksInserted = 0;
    const insertErrors: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const { error: secErr } = await supabase
        .from('document_sections')
        .insert({
          project_id: supabaseProjectId,
          content: chunks[i],
          embedding: embeddings[i],
          metadata: {
            source: title,
            file_url: fileUrl,
            file_name: doc.file_name,
            discipline,
            chunk_index: i,
            total_chunks: chunks.length,
            house_type_code: houseTypeCode,
            document_id: documentId,
            drawing_description: null,
          },
        });

      if (secErr) {
        insertErrors.push(`chunk ${i}: ${secErr.message}`);
      } else {
        chunksInserted++;
      }
    }

    // ── Update documents row ──────────────────────────────────────────────
    const finalStatus = chunksInserted > 0 ? 'complete' : 'failed';
    const finalUploadStatus = chunksInserted > 0 ? 'indexed' : 'pending';
    const finalError = insertErrors.length > 0
      ? `${insertErrors.length} chunk(s) failed to insert`
      : null;

    await db.update(documents)
      .set({
        processing_status: finalStatus,
        processing_error: finalError,
        upload_status: finalUploadStatus as 'pending' | 'indexed',
        chunks_count: chunksInserted,
        updated_at: new Date(),
      })
      .where(eq(documents.id, documentId));

    return NextResponse.json({
      success: chunksInserted > 0,
      document_id: documentId,
      chunks_inserted: chunksInserted,
      total_chunks: chunks.length,
      insert_errors: insertErrors.length > 0 ? insertErrors : undefined,
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await markFailed(documentId, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
