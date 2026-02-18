export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/supabase-server';
import OpenAI from 'openai';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
}

function inferDiscipline(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (/\b(arch|architectural|floor.?plan|elevation|section|detail|ga\b)/i.test(lower)) return 'architectural';
  if (/\b(struct|structural|foundation|beam|column|slab|rebar)/i.test(lower)) return 'structural';
  if (/\b(mech|mechanical|hvac|ventilat|heating|boiler)/i.test(lower)) return 'mechanical';
  if (/\b(elec|electrical|lighting|power|socket|circuit)/i.test(lower)) return 'electrical';
  if (/\b(plumb|plumbing|drainage|sanitary|water.?supply)/i.test(lower)) return 'plumbing';
  if (/\b(civil|site.?work|road|earthwork)/i.test(lower)) return 'civil';
  if (/\b(landscape|planting|hardscape)/i.test(lower)) return 'landscape';
  if (/\b(handover|warranty|manual|certificate|o&m|operation)/i.test(lower)) return 'handover';
  return 'general';
}

// Split text into overlapping chunks the AI can search over
function chunkText(text: string, maxChunkSize = 1000, overlap = 200): string[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map(p => p.replace(/\s+/g, ' ').trim())
    .filter(p => p.length > 30);

  if (paragraphs.length === 0) return [];

  const chunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    if (current.length + para.length + 2 > maxChunkSize && current.length > 0) {
      chunks.push(current.trim());
      current = current.slice(-overlap) + '\n\n' + para;
    } else {
      current = current ? current + '\n\n' + para : para;
    }
  }
  if (current.trim().length > 30) chunks.push(current.trim());

  return chunks;
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const tenantId = session.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    const formData = await request.formData();
    const developmentId = formData.get('developmentId') as string;
    const files = formData.getAll('files') as File[];

    if (!developmentId) {
      return NextResponse.json({ error: 'developmentId is required' }, { status: 400 });
    }
    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    console.log('[Upload] Processing', files.length, 'file(s) for development:', developmentId);

    // Bridge legacy FK chain: organisations → projects → documents + document_sections
    // New tenants/developments exist in tenants/developments but not organisations/projects
    const { data: existingOrg } = await supabaseAdmin
      .from('organisations')
      .select('id')
      .eq('id', tenantId)
      .single();

    if (!existingOrg) {
      const { data: tenant } = await supabaseAdmin
        .from('tenants').select('name').eq('id', tenantId).single();
      const { error: orgErr } = await supabaseAdmin
        .from('organisations')
        .insert({ id: tenantId, name: tenant?.name || 'Organisation' });
      if (orgErr) console.error('[Upload] organisations bridge error:', orgErr.message);
      else console.log('[Upload] Created organisations bridge for tenant:', tenantId);
    }

    const { data: existingProject } = await supabaseAdmin
      .from('projects')
      .select('id')
      .eq('id', developmentId)
      .single();

    if (!existingProject) {
      const { data: dev } = await supabaseAdmin
        .from('developments').select('name').eq('id', developmentId).single();
      const { error: projectErr } = await supabaseAdmin
        .from('projects')
        .insert({ id: developmentId, organization_id: tenantId, name: dev?.name || 'Development' });
      if (projectErr) console.error('[Upload] projects bridge error:', projectErr.message);
      else console.log('[Upload] Created projects bridge for development:', developmentId);
    }

    let succeeded = 0;
    let failed = 0;
    const fileResults: Array<{ fileName: string; success: boolean; chunksIndexed?: number; error?: string }> = [];

    for (const file of files) {
      try {
        const fileBuffer = await file.arrayBuffer();
        const timestamp = Date.now();
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `${developmentId}/${timestamp}_${sanitizedName}`;
        const discipline = inferDiscipline(file.name);
        const title = file.name.replace(/\.[^.]+$/, '');

        // Phase 1: Upload to storage
        const { error: uploadError } = await supabaseAdmin.storage
          .from('development_docs')
          .upload(storagePath, fileBuffer, {
            contentType: file.type || 'application/octet-stream',
            upsert: false,
          });

        if (uploadError) {
          console.error('[Upload] Storage error for', file.name, ':', uploadError.message);
          fileResults.push({ fileName: file.name, success: false, error: uploadError.message });
          failed++;
          continue;
        }

        const { data: publicUrlData } = supabaseAdmin.storage
          .from('development_docs')
          .getPublicUrl(storagePath);
        const fileUrl = publicUrlData?.publicUrl || null;

        // Phase 2: Write document record (Drizzle first, legacy fallback)
        let docWritten = false;
        try {
          const { db } = await import('@openhouse/db/client');
          const { documents } = await import('@openhouse/db/schema');
          await db.insert(documents).values({
            tenant_id: tenantId,
            development_id: developmentId,
            document_type: 'general',
            discipline,
            title,
            file_name: file.name,
            original_file_name: file.name,
            relative_path: storagePath,
            storage_url: fileUrl,
            file_url: fileUrl,
            mime_type: file.type || 'application/octet-stream',
            size_kb: Math.ceil(file.size / 1024),
            version: 1,
            status: 'active',
            processing_status: 'processing',
            is_important: false,
            must_read: false,
          });
          docWritten = true;
        } catch (drizzleErr) {
          console.warn('[Upload] Drizzle insert failed, trying legacy');
        }

        if (!docWritten) {
          const { error: legacyErr } = await supabaseAdmin.from('documents').insert({
            project_id: developmentId,
            title,
            file_url: fileUrl,
            storage_path: storagePath,
            category: discipline,
          });
          if (legacyErr && legacyErr.code !== '23503') {
            console.error('[Upload] Legacy insert error:', legacyErr.message);
          } else if (!legacyErr) {
            docWritten = true;
          }
        }

        // Phase 3: Extract text, chunk, embed, and index into document_sections
        // This is what makes the AI assistant learn from the document.
        let chunksIndexed = 0;
        try {
          let extractedText = '';

          if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
            try {
              const pdfParse = (await import('pdf-parse')).default;
              const pdfData = await pdfParse(Buffer.from(fileBuffer));
              extractedText = pdfData.text?.trim() || '';
              console.log('[Upload] Extracted', extractedText.length, 'chars from', file.name);
            } catch (pdfErr) {
              console.warn('[Upload] PDF extraction failed for', file.name, ':', pdfErr instanceof Error ? pdfErr.message : 'err');
            }
          } else if (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')) {
            extractedText = Buffer.from(fileBuffer).toString('utf-8');
          }

          if (extractedText.length >= 50) {
            const textChunks = chunkText(extractedText);
            const MAX_CHUNKS = 40; // cap to stay within maxDuration=60s
            const toIndex = textChunks.slice(0, MAX_CHUNKS);

            console.log('[Upload] Indexing', toIndex.length, 'chunks for', file.name);
            const openai = getOpenAI();

            for (let i = 0; i < toIndex.length; i++) {
              try {
                const embRes = await openai.embeddings.create({
                  model: 'text-embedding-3-small',
                  input: toIndex[i],
                });

                const { error: secErr } = await supabaseAdmin
                  .from('document_sections')
                  .insert({
                    project_id: developmentId,
                    content: toIndex[i],
                    embedding: embRes.data[0].embedding,
                    metadata: {
                      source: title,
                      file_name: file.name,
                      file_url: fileUrl,
                      discipline,
                      chunk_index: i,
                      total_chunks: toIndex.length,
                      drawing_type: discipline,
                      house_type_code: null,
                    },
                  });

                if (!secErr) {
                  chunksIndexed++;
                } else {
                  console.warn('[Upload] Section insert error chunk', i, ':', secErr.message);
                }
              } catch (chunkErr) {
                console.warn('[Upload] Chunk', i, 'error:', chunkErr instanceof Error ? chunkErr.message : 'err');
              }
            }

            console.log('[Upload] Indexed', chunksIndexed, '/', toIndex.length, 'chunks for', file.name);
          } else {
            console.log('[Upload] Skipping embedding — insufficient text in', file.name);
          }
        } catch (indexErr) {
          console.error('[Upload] Indexing error for', file.name, ':', indexErr instanceof Error ? indexErr.message : 'err');
        }

        fileResults.push({ fileName: file.name, success: true, chunksIndexed });
        succeeded++;
        console.log('[Upload] ✅ Completed:', file.name, `(${chunksIndexed} chunks indexed)`);

      } catch (err: any) {
        console.error('[Upload] Unexpected error for', file.name, ':', err.message);
        fileResults.push({ fileName: file.name, success: false, error: err.message });
        failed++;
      }
    }

    console.log('[Upload] Done — succeeded:', succeeded, 'failed:', failed);

    return NextResponse.json({
      success: failed === 0,
      successfulFiles: succeeded,
      summary: { total: files.length, succeeded, failed },
      files: fileResults,
    });

  } catch (error: any) {
    console.error('[Upload] Error:', error);
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (error.message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

// GET: stub for training jobs (called by the UI on page load)
export async function GET() {
  return NextResponse.json({ jobs: [] });
}
