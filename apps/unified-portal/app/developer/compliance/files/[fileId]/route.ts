export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/supabase-server';

/**
 * Compliance files live in the private `compliance-documents` bucket and the
 * `compliance_files` row stores only the object key. Resolve the file for the
 * caller's tenant, mint a short-lived signed URL, and redirect to it.
 * `?download=1` asks Storage to serve it as an attachment.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await params;
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    if (!session.tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: file } = await supabaseAdmin
      .from('compliance_files')
      .select('storage_path, file_name')
      .eq('id', fileId)
      .eq('tenant_id', session.tenantId)
      .maybeSingle();

    if (!file?.storage_path) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const download = new URL(request.url).searchParams.get('download') === '1';
    const { data: signed, error } = await supabaseAdmin.storage
      .from('compliance-documents')
      .createSignedUrl(
        file.storage_path,
        60 * 10,
        download ? { download: file.file_name || true } : undefined
      );

    if (error || !signed?.signedUrl) {
      return NextResponse.json({ error: 'File not available' }, { status: 404 });
    }

    return NextResponse.redirect(signed.signedUrl);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
