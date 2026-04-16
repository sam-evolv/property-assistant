export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/supabase-server';
import { getServiceClient } from '@/lib/care/third-party';

type Body = {
  status: 'approved' | 'rejected' | 'filed';
  reviewNotes?: string;
};

const SYSTEM_TYPE_BY_JOB: Record<string, string> = {
  'Solar PV Installation': 'solar_pv',
  'Heat Pump Installation': 'heat_pump',
  'EV Charger Installation': 'ev_charger',
  'Battery Storage Installation': 'solar_pv',
  'Insulation / Deep Retrofit': 'other',
  'Ventilation (MVHR)': 'mvhr',
  Other: 'other',
};

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.status || !['approved', 'rejected', 'filed'].includes(body.status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const supabase = getServiceClient();

  const { data: upload, error: fetchError } = await supabase
    .from('care_third_party_uploads')
    .select('*')
    .eq('id', params.id)
    .single();

  if (fetchError || !upload) {
    return NextResponse.json({ error: 'Upload not found' }, { status: 404 });
  }

  if (session.tenantId && upload.installer_tenant_id !== session.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error: updateError } = await supabase
    .from('care_third_party_uploads')
    .update({
      status: body.status,
      reviewed_by: session.id,
      reviewed_at: new Date().toISOString(),
      review_notes: body.reviewNotes ?? null,
    })
    .eq('id', params.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // When filed, mirror into the Care Smart Archive (installer_content).
  if (body.status === 'filed') {
    const systemType = upload.job_type
      ? SYSTEM_TYPE_BY_JOB[upload.job_type as string] ?? null
      : null;

    const description = [
      `Submitted by ${upload.submitter_name}`,
      upload.submitter_company ? `(${upload.submitter_company})` : null,
      upload.job_reference ? `· Job ${upload.job_reference}` : null,
      upload.property_address ? `· ${upload.property_address}` : null,
    ]
      .filter(Boolean)
      .join(' ');

    await supabase.from('installer_content').insert({
      tenant_id: upload.installer_tenant_id,
      title: upload.document_name,
      content_type: 'document',
      system_type: systemType,
      description,
      file_url: upload.storage_path,
      status: 'live',
    });
  }

  return NextResponse.json({ ok: true });
}
