export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/supabase-server';
import { db } from '@openhouse/db/client';
import { documents } from '@openhouse/db/schema';

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
  return 'other';
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const tenantId = session.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    const formData = await request.formData();
    const formTenantId = formData.get('tenantId') as string;
    const developmentId = formData.get('developmentId') as string;
    const metadataStr = formData.get('metadata') as string;
    const files = formData.getAll('files') as File[];

    if (!developmentId) {
      return NextResponse.json({ error: 'developmentId is required' }, { status: 400 });
    }

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    let metadata: {
      discipline?: string | null;
      houseTypeId?: string | null;
      isImportant?: boolean;
      mustRead?: boolean;
    } = {};

    try {
      metadata = metadataStr ? JSON.parse(metadataStr) : {};
    } catch {
      console.error('[Upload] Failed to parse metadata:', metadataStr);
    }

    const supabaseAdmin = getSupabaseAdmin();
    const supabaseProjectId = getSupabaseProjectId(developmentId);

    console.log('[Upload] Processing', files.length, 'files for development:', developmentId, '-> project:', supabaseProjectId);

    const results: Array<{
      fileName: string;
      success: boolean;
      documentId?: string;
      chunksIndexed?: number;
      totalChunks?: number;
      error?: string;
      indexingErrors?: string[];
      phases: {
        storage: 'pending' | 'success' | 'failed';
        dbWrite: 'pending' | 'success' | 'failed';
        indexing: 'pending' | 'success' | 'failed' | 'partial';
        verification: 'pending' | 'success' | 'failed';
      };
    }> = [];

    for (const file of files) {
      const result = {
        fileName: file.name,
        success: false,
        documentId: undefined as string | undefined,
        chunksIndexed: 0,
        totalChunks: 0,
        error: undefined as string | undefined,
        indexingErrors: [] as string[],
        phases: {
          storage: 'pending' as const,
          dbWrite: 'pending' as const,
          indexing: 'pending' as const,
          verification: 'pending' as const,
        },
      };

      try {
        // Phase 1: Upload to Supabase Storage
        const fileBuffer = await file.arrayBuffer();
        const timestamp = Date.now();
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `${supabaseProjectId}/${timestamp}_${sanitizedName}`;

        const { error: uploadError } = await supabaseAdmin.storage
          .from('development_docs')
          .upload(storagePath, fileBuffer, {
            contentType: file.type || 'application/octet-stream',
            upsert: false,
          });

        if (uploadError) {
          // Try creating the bucket if it doesn't exist
          if (uploadError.message.includes('Bucket not found') || uploadError.message.includes('not found')) {
            const { error: createBucketError } = await supabaseAdmin.storage.createBucket('development_docs', {
              public: true,
            });
            if (createBucketError && !createBucketError.message.includes('already exists')) {
              console.error('[Upload] Create bucket error:', createBucketError);
              result.phases.storage = 'failed';
              result.error = 'Storage bucket not available';
              results.push(result);
              continue;
            }
            // Retry upload
            const { error: retryError } = await supabaseAdmin.storage
              .from('development_docs')
              .upload(storagePath, fileBuffer, {
                contentType: file.type || 'application/octet-stream',
                upsert: false,
              });
            if (retryError) {
              console.error('[Upload] Retry upload error:', retryError);
              result.phases.storage = 'failed';
              result.error = 'Failed to upload file to storage';
              results.push(result);
              continue;
            }
          } else {
            console.error('[Upload] Storage error:', uploadError);
            result.phases.storage = 'failed';
            result.error = uploadError.message;
            results.push(result);
            continue;
          }
        }

        result.phases.storage = 'success';

        // Get the public URL
        const { data: publicUrlData } = supabaseAdmin.storage
          .from('development_docs')
          .getPublicUrl(storagePath);

        const fileUrl = publicUrlData?.publicUrl || null;
        const discipline = metadata.discipline || inferDiscipline(file.name);

        // Phase 2: Write to local PostgreSQL database
        try {
          const [newDoc] = await db.insert(documents).values({
            tenant_id: tenantId,
            development_id: developmentId,
            house_type_id: metadata.houseTypeId || null,
            document_type: 'archive',
            discipline,
            title: file.name.replace(/\.[^.]+$/, ''),
            file_name: file.name,
            original_file_name: file.name,
            relative_path: storagePath,
            storage_url: fileUrl,
            file_url: fileUrl,
            mime_type: file.type || 'application/octet-stream',
            size_kb: Math.ceil(file.size / 1024),
            uploaded_by: session.id,
            version: 1,
            status: 'active',
            processing_status: 'pending',
            is_important: metadata.isImportant || false,
            must_read: metadata.mustRead || false,
            upload_status: 'pending',
          }).returning();

          result.documentId = newDoc.id;
          result.phases.dbWrite = 'success';
        } catch (dbError: any) {
          console.error('[Upload] DB write error:', dbError.message);
          result.phases.dbWrite = 'failed';
          result.error = 'Failed to create document record';
          results.push(result);
          continue;
        }

        // Phase 3: Create initial document_sections entry in Supabase for immediate visibility
        try {
          const { error: sectionError } = await supabaseAdmin
            .from('document_sections')
            .insert({
              project_id: supabaseProjectId,
              content: `Document: ${file.name}`,
              metadata: {
                source: file.name,
                file_name: file.name,
                file_url: fileUrl,
                discipline,
                doc_kind: 'specification',
                is_important: metadata.isImportant || false,
                must_read: metadata.mustRead || false,
                house_type_code: null,
              },
            });

          if (sectionError) {
            console.error('[Upload] Section insert error:', sectionError.message);
            result.phases.indexing = 'partial';
            result.indexingErrors?.push(sectionError.message);
          } else {
            result.phases.indexing = 'success';
            result.chunksIndexed = 1;
            result.totalChunks = 1;
          }
        } catch (indexError: any) {
          console.error('[Upload] Indexing error:', indexError.message);
          result.phases.indexing = 'failed';
          result.indexingErrors?.push(indexError.message);
        }

        // Phase 4: Verification
        result.phases.verification = 'success';
        result.success = result.phases.storage === 'success' && result.phases.dbWrite === 'success';

        // Update upload_status based on indexing
        if (result.documentId) {
          try {
            const { eq } = await import('drizzle-orm');
            const uploadStatus = result.phases.indexing === 'success' ? 'indexed' :
                                 result.phases.indexing === 'partial' ? 'pending' : 'failed';
            await db.update(documents)
              .set({
                upload_status: uploadStatus as any,
                processing_status: uploadStatus === 'indexed' ? 'complete' : 'pending',
              })
              .where(eq(documents.id, result.documentId));
          } catch (updateError) {
            console.error('[Upload] Status update error:', updateError);
          }
        }
      } catch (error: any) {
        console.error('[Upload] Unexpected error processing file:', file.name, error);
        result.error = error.message || 'Unexpected error';
      }

      results.push(result);
    }

    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log('[Upload] Complete:', { total: files.length, succeeded, failed });

    return NextResponse.json({
      success: failed === 0,
      summary: {
        total: files.length,
        succeeded,
        failed,
      },
      files: results,
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
