export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/supabase-server';
import OpenAI from 'openai';
import { isFloorPlan } from '@/lib/floorplan/extractor';

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
      // orgErr intentionally ignored - bridge may already exist
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
      // projectErr intentionally ignored - bridge may already exist
    }

    // Create a training_jobs record so developers can see upload/indexing status in the UI
    let trainingJobId: string | null = null;
    try {
      const { data: jobData } = await supabaseAdmin
        .from('training_jobs')
        .insert({
          tenant_id: tenantId,
          development_id: developmentId,
          file_name: files.map(f => f.name).join(', '),
          file_type: files.length === 1 ? (files[0].name.split('.').pop() || 'unknown') : 'mixed',
          status: 'processing',
          total_chunks: 0,
          processed_chunks: 0,
          started_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      trainingJobId = jobData?.id || null;
      // trainingJobId created successfully
    } catch (_jobErr) {
        // error handled silently
    }

    let succeeded = 0;
    let failed = 0;
    let totalChunksIndexed = 0;
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
        } catch (_drizzleErr) {
            // error handled silently
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
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const pdfMod = await import('pdf-parse') as any;
              const pdfParse = pdfMod.default ?? pdfMod;
              const pdfData = await pdfParse(Buffer.from(fileBuffer));
              extractedText = pdfData.text?.trim() || '';
            } catch (_pdfErr) {
                // error handled silently
            }
          } else if (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')) {
            extractedText = Buffer.from(fileBuffer).toString('utf-8');
          }

          if (extractedText.length >= 50) {
            const textChunks = chunkText(extractedText);
            const MAX_CHUNKS = 40; // cap to stay within maxDuration=60s
            const toIndex = textChunks.slice(0, MAX_CHUNKS);

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
                }
              } catch (_chunkErr) {
                  // error handled silently
              }
            }

          } else {
          }
        } catch (_indexErr) {
            // error handled silently
        }

        fileResults.push({ fileName: file.name, success: true, chunksIndexed });
        succeeded++;
        totalChunksIndexed += chunksIndexed;

        // Phase 4: Floor plan vision extraction (if this looks like a floor plan)
        if (isFloorPlan(file.name, discipline)) {
          try {
            const { extractFloorPlanRooms } = await import('@/lib/floorplan/extractor');
            const extractResult = await extractFloorPlanRooms(
              Buffer.from(fileBuffer),
              process.env.OPENAI_API_KEY!,
            );

            if (extractResult.rooms.length > 0) {

              for (const room of extractResult.rooms) {
                const { error: dimErr } = await supabaseAdmin
                  .from('unit_room_dimensions')
                  .insert({
                    tenant_id: tenantId,
                    development_id: developmentId,
                    house_type_id: null,
                    room_name: room.room_name,
                    room_key: room.room_key,
                    floor: room.floor,
                    length_m: room.length_m,
                    width_m: room.width_m,
                    area_sqm: room.area_sqm,
                    ceiling_height_m: room.ceiling_height_m,
                    source: 'floorplan_vision',
                    verified: false,
                    extraction_confidence: room.confidence,
                    extraction_notes: `Auto-extracted from ${file.name}`,
                  });
                if (dimErr) {
                }
              }
            } else {
            }
          } catch (_fpErr) {
              // error handled silently
          }
        }

      } catch (err: any) {
        fileResults.push({ fileName: file.name, success: false, error: err.message });
        failed++;
      }
    }

    // Update training_jobs record with final status
    if (trainingJobId) {
      try {
        await supabaseAdmin
          .from('training_jobs')
          .update({
            status: failed === 0 ? 'completed' : (succeeded === 0 ? 'failed' : 'partial'),
            total_chunks: totalChunksIndexed,
            processed_chunks: totalChunksIndexed,
            completed_at: new Date().toISOString(),
            error_message: failed > 0 ? `${failed} file(s) failed` : null,
          })
          .eq('id', trainingJobId);
      } catch (_jobUpdateErr) {
          // error handled silently
      }
    }

    return NextResponse.json({
      success: failed === 0,
      successfulFiles: succeeded,
      summary: { total: files.length, succeeded, failed },
      files: fileResults,
    });

  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (error.message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

// GET: return real training jobs for the authenticated tenant
export async function GET(request: NextRequest) {
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const tenantId = session.tenantId;
    const { searchParams } = new URL(request.url);
    const developmentId = searchParams.get('developmentId');

    const supabaseAdmin = getSupabaseAdmin();
    let query = supabaseAdmin
      .from('training_jobs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (developmentId) {
      query = query.eq('development_id', developmentId);
    }

    const { data: jobs, error } = await query;
    if (error) {
      return NextResponse.json({ jobs: [] });
    }

    return NextResponse.json({ jobs: jobs || [] });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ jobs: [] });
  }
}
