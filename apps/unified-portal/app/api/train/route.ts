export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/supabase-server';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
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

    // Ensure a legacy `projects` row exists for this development.
    // Both `documents` and `document_sections` have FK constraints on project_id → projects.id.
    // New developments (created via Drizzle) don't have a projects row — we create it here.
    const { data: existingProject } = await supabaseAdmin
      .from('projects')
      .select('id')
      .eq('id', developmentId)
      .single();

    if (!existingProject) {
      const { data: dev } = await supabaseAdmin
        .from('developments')
        .select('name, tenant_id')
        .eq('id', developmentId)
        .single();

      const { error: projectErr } = await supabaseAdmin
        .from('projects')
        .insert({
          id: developmentId,
          organization_id: tenantId,
          name: dev?.name || 'Development',
        });

      if (projectErr) {
        console.error('[Upload] Failed to create projects bridge row:', projectErr.message);
      } else {
        console.log('[Upload] Created projects bridge row for development:', developmentId);
      }
    }

    let succeeded = 0;
    let failed = 0;
    const fileResults: Array<{ fileName: string; success: boolean; error?: string }> = [];

    for (const file of files) {
      try {
        // 1. Upload file to Supabase Storage
        const fileBuffer = await file.arrayBuffer();
        const timestamp = Date.now();
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `${developmentId}/${timestamp}_${sanitizedName}`;

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
        const discipline = inferDiscipline(file.name);
        const title = file.name.replace(/\.[^.]+$/, '');

        // 2. Try Drizzle documents table first (full schema)
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
            // uploaded_by intentionally omitted — references admins table,
            // but developers are in auth.users, not admins
            version: 1,
            status: 'active',
            processing_status: 'complete',
            is_important: false,
            must_read: false,
          });
          docWritten = true;
          console.log('[Upload] Drizzle insert success for', file.name);
        } catch (drizzleErr) {
          console.warn('[Upload] Drizzle insert failed for', file.name, '— falling back to Supabase REST');
        }

        // 3. Fallback: insert into legacy Supabase documents table
        // Only works for developments that have a corresponding row in the `projects` table
        if (!docWritten) {
          const { error: legacyErr } = await supabaseAdmin
            .from('documents')
            .insert({
              project_id: developmentId,
              title,
              file_url: fileUrl,
              storage_path: storagePath,
              category: discipline,
            });

          if (legacyErr) {
            if (legacyErr.code === '23503') {
              // FK violation — this development has no legacy projects row, Drizzle table required
              console.warn('[Upload] Legacy insert skipped for', file.name, '— no projects row for', developmentId);
            } else {
              console.error('[Upload] Legacy insert error for', file.name, ':', legacyErr.message);
            }
          } else {
            docWritten = true;
            console.log('[Upload] Legacy Supabase insert success for', file.name);
          }
        }

        // 4. Create document_sections entry so AI can discover the document
        try {
          await supabaseAdmin
            .from('document_sections')
            .insert({
              project_id: developmentId,
              content: `Document: ${file.name}`,
              metadata: {
                source: file.name,
                file_name: file.name,
                file_url: fileUrl,
                discipline,
                doc_kind: 'general',
                is_important: false,
              },
            });
        } catch (sectionErr) {
          // Non-fatal — document is uploaded, AI indexing can happen separately
          console.warn('[Upload] document_sections insert failed for', file.name);
        }

        fileResults.push({ fileName: file.name, success: true });
        succeeded++;
        console.log('[Upload] ✅ Completed:', file.name);
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
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

// GET: stub for training jobs (called by the UI on page load)
export async function GET(request: NextRequest) {
  return NextResponse.json({ jobs: [] });
}
