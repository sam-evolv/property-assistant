export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/supabase-server';
import { getServiceClient, resolveSESystemsTenantId, THIRD_PARTY_BUCKET } from '@/lib/care/third-party';

export async function GET(req: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const includePreview = searchParams.get('preview') === '1';

  const tenantId = session.tenantId ?? (await resolveSESystemsTenantId());
  const supabase = getServiceClient();

  let query = supabase
    .from('care_third_party_uploads')
    .select('*')
    .eq('installer_tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const uploads = data ?? [];

  let previewById: Record<string, string> = {};
  if (includePreview && uploads.length > 0) {
    const results = await Promise.all(
      uploads.map(async (row) => {
        const { data: signed } = await supabase.storage
          .from(THIRD_PARTY_BUCKET)
          .createSignedUrl(row.storage_path, 60 * 10);
        return [row.id, signed?.signedUrl ?? ''] as const;
      }),
    );
    previewById = Object.fromEntries(results.filter(([, url]) => url));
  }

  const pendingCount = uploads.filter((u) => u.status === 'pending').length;

  return NextResponse.json({
    uploads: uploads.map((u) => ({
      ...u,
      preview_url: previewById[u.id] ?? null,
    })),
    pendingCount,
  });
}
