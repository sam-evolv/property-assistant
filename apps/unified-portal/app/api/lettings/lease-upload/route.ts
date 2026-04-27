import { NextResponse, type NextRequest } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';
import { requireRole, getSupabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/lettings/lease-upload
 *
 * Multipart upload for lease PDFs from the address-entry screen. Replaces
 * the in-memory handoff in Session 5 — the PDF is persisted to Supabase
 * Storage immediately so a reload no longer loses it.
 *
 * Returns { documentId, fileUrl } where fileUrl is the storage path
 * (private bucket — only the service role reads from it on the
 * extract-lease endpoint). The documentId is what /api/lettings/extract-
 * lease consumes next.
 *
 * The lettings_documents row created here has letting_property_id = NULL.
 * Migration 053 must be applied first; see file header in
 * apps/unified-portal/migrations/053_*.sql.
 */

const BUCKET = 'lettings-documents';
const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const started = Date.now();
  try {
    await requireRole(['developer', 'admin', 'super_admin']);

    const form = await request.formData().catch(() => null);
    if (!form) {
      return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
    }

    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: 'Empty file' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'PDF exceeds 10 MB limit' }, { status: 400 });
    }

    const isPdf =
      file.type === 'application/pdf'
      || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      return NextResponse.json({ error: 'Only PDF lease documents are supported' }, { status: 400 });
    }

    // Resolve the calling agent profile (matches the convention in
    // /api/agent/workspaces/route.ts).
    const cookieStore = cookies();
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const { data: agentProfile, error: profileErr } = await admin
      .from('agent_profiles')
      .select('id, tenant_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (profileErr || !agentProfile) {
      return NextResponse.json({ error: 'No agent profile for this user' }, { status: 403 });
    }

    const documentId = randomUUID();
    const storagePath = `${agentProfile.tenant_id}/${documentId}.pdf`;
    const buffer = Buffer.from(await file.arrayBuffer());

    // Idempotent bucket creation — matches the pattern in
    // app/api/care-dashboard/archive/upload/route.ts. Catch the "already
    // exists" error silently.
    await admin.storage
      .createBucket(BUCKET, { public: false })
      .catch(() => null);

    const { error: uploadErr } = await admin.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadErr) {
      console.error(`[lettings-upload] storage upload failed: ${uploadErr.message}`);
      return NextResponse.json({ error: uploadErr.message }, { status: 500 });
    }

    const { error: insertErr } = await admin
      .from('lettings_documents')
      .insert({
        id: documentId,
        letting_property_id: null,
        agent_id: agentProfile.id,
        tenant_id: agentProfile.tenant_id,
        doc_type: 'lease',
        original_filename: file.name,
        file_url: storagePath,
        file_size_bytes: file.size,
        mime_type: 'application/pdf',
        ai_extraction_status: 'pending',
      });

    if (insertErr) {
      // Best-effort cleanup of the orphan storage object.
      await admin.storage.from(BUCKET).remove([storagePath]).catch(() => null);
      console.error(`[lettings-upload] insert failed: ${insertErr.message}`);
      const isNotNullProp =
        insertErr.message.includes('letting_property_id')
        && insertErr.message.includes('null');
      if (isNotNullProp) {
        return NextResponse.json(
          {
            error:
              'Migration 053 has not been applied — letting_property_id is still NOT NULL. '
              + 'Run apps/unified-portal/migrations/053_lettings_documents_nullable_property.sql in Supabase.',
          },
          { status: 500 },
        );
      }
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    console.log(
      `[lettings-upload] ok documentId=${documentId} bytes=${file.size} duration_ms=${Date.now() - started}`,
    );
    return NextResponse.json({ documentId, fileUrl: storagePath });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED' || message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error(`[lettings-upload] error duration_ms=${Date.now() - started} reason=${message}`);
    return NextResponse.json({ error: 'Lease upload failed' }, { status: 500 });
  }
}
