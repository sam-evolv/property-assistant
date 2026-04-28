import { NextResponse, type NextRequest } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/lettings/document-upload
 *
 * Multipart upload for any property document (BER cert, gas/electrical
 * certs, photos, floor plans, etc) on an existing property. Sister to
 * lease-upload — that route stays single-purpose for the Session 5
 * pre-property lease flow which triggers AI extraction. Non-lease docs
 * land here with ai_extraction_status='not_applicable' (no extraction).
 */

const BUCKET = 'lettings-documents';
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_DOC_TYPES = new Set([
  'lease', 'ber_cert', 'gas_safety_cert', 'electrical_cert',
  'inventory', 'rtb_confirmation', 'photo', 'floorplan', 'other',
]);
const ALLOWED_MIME = /^(application\/pdf|image\/(jpeg|png|webp|heic))$/;

export async function POST(request: NextRequest) {
  const started = Date.now();
  try {
    const form = await request.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });

    const file = form.get('file');
    const docType = String(form.get('docType') ?? '');
    const lettingPropertyId = String(form.get('lettingPropertyId') ?? '');
    const tenancyId = form.get('tenancyId');

    if (!(file instanceof File)) return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    if (file.size === 0) return NextResponse.json({ error: 'Empty file' }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File exceeds 10 MB limit' }, { status: 400 });
    if (!ALLOWED_DOC_TYPES.has(docType)) return NextResponse.json({ error: 'Invalid docType' }, { status: 400 });
    if (!lettingPropertyId) return NextResponse.json({ error: 'lettingPropertyId is required' }, { status: 400 });

    const mimeType = file.type || 'application/octet-stream';
    const isPdf = mimeType === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImage = mimeType.startsWith('image/');
    if (!ALLOWED_MIME.test(mimeType) && !isPdf) {
      return NextResponse.json({ error: 'Only PDF or image files are supported' }, { status: 400 });
    }

    const cookieStore = cookies();
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = getSupabaseAdmin();
    const { data: agentProfile } = await admin
      .from('agent_profiles')
      .select('id, tenant_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!agentProfile) return NextResponse.json({ error: 'No agent profile for this user' }, { status: 403 });

    const { data: property } = await admin
      .from('agent_letting_properties')
      .select('id, agent_id, workspace_id')
      .eq('id', lettingPropertyId)
      .maybeSingle();
    if (!property || property.agent_id !== agentProfile.id) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    const documentId = randomUUID();
    const ext = isPdf ? 'pdf' : (file.name.split('.').pop()?.toLowerCase() ?? 'bin');
    const storagePath = `${agentProfile.tenant_id}/${documentId}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await admin.storage.createBucket(BUCKET, { public: false }).catch(() => null);
    const { error: uploadErr } = await admin.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: mimeType, upsert: false });
    if (uploadErr) {
      console.error(`[lettings-doc-upload] storage_failed reason=${uploadErr.message}`);
      return NextResponse.json({ error: uploadErr.message }, { status: 500 });
    }

    // Lease PDFs trigger AI extraction via /api/lettings/extract-lease;
    // non-lease docs are filed with no extraction.
    const extractionStatus = docType === 'lease' && isPdf ? 'pending' : 'not_applicable';

    const { error: insertErr } = await admin.from('lettings_documents').insert({
      id: documentId,
      letting_property_id: lettingPropertyId,
      tenancy_id: typeof tenancyId === 'string' && tenancyId ? tenancyId : null,
      workspace_id: property.workspace_id,
      agent_id: agentProfile.id,
      tenant_id: agentProfile.tenant_id,
      doc_type: docType,
      original_filename: file.name,
      file_url: storagePath,
      file_size_bytes: file.size,
      mime_type: mimeType,
      ai_extraction_status: extractionStatus,
    });
    if (insertErr) {
      await admin.storage.from(BUCKET).remove([storagePath]).catch(() => null);
      console.error(`[lettings-doc-upload] insert_failed reason=${insertErr.message}`);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    console.log(`[lettings-doc-upload] ok documentId=${documentId} type=${docType} duration_ms=${Date.now() - started}`);
    return NextResponse.json({
      ok: true,
      document: {
        id: documentId,
        docType,
        originalFilename: file.name,
        fileSizeBytes: file.size,
        uploadedAt: new Date().toISOString(),
        aiExtractionStatus: extractionStatus,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[lettings-doc-upload] error duration_ms=${Date.now() - started} reason=${message}`);
    return NextResponse.json({ error: 'Document upload failed' }, { status: 500 });
  }
}
