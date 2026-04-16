export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/care/third-party';

type CompleteBody = {
  uploadId: string;
  storagePath: string;
  documentSizeBytes: number;
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as CompleteBody | null;
  if (!body?.uploadId || !body.storagePath) {
    return NextResponse.json({ error: 'Missing uploadId or storagePath' }, { status: 400 });
  }

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('care_third_party_uploads')
    .update({
      storage_path: body.storagePath,
      document_size_bytes: body.documentSizeBytes ?? null,
    })
    .eq('id', body.uploadId)
    .select('id, created_at')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Upload not found' }, { status: 500 });
  }

  const reference = `TPU-${data.id.slice(0, 8).toUpperCase()}`;
  return NextResponse.json({ ok: true, reference });
}
