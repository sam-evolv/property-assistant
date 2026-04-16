export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  DOCUMENT_CATEGORIES,
  JOB_TYPES,
  THIRD_PARTY_BUCKET,
  buildStoragePath,
  getServiceClient,
  resolveSESystemsTenantId,
} from '@/lib/care/third-party';

type InitBody = {
  submitterName: string;
  submitterCompany?: string;
  submitterEmail: string;
  submitterPhone?: string;
  jobReference?: string;
  propertyAddress?: string;
  jobType?: string;
  documentName: string;
  documentCategory: string;
};

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as InitBody | null;
  if (!body) return bad('Invalid JSON body');

  const {
    submitterName,
    submitterCompany,
    submitterEmail,
    submitterPhone,
    jobReference,
    propertyAddress,
    jobType,
    documentName,
    documentCategory,
  } = body;

  if (!submitterName || !submitterEmail || !documentName || !documentCategory) {
    return bad('Missing required fields');
  }
  if (!DOCUMENT_CATEGORIES.includes(documentCategory as (typeof DOCUMENT_CATEGORIES)[number])) {
    return bad('Invalid document category');
  }
  if (jobType && !JOB_TYPES.includes(jobType as (typeof JOB_TYPES)[number])) {
    return bad('Invalid job type');
  }

  const supabase = getServiceClient();
  const installerTenantId = await resolveSESystemsTenantId();
  const storagePath = buildStoragePath(submitterEmail, documentName);

  const { data: upload, error: insertError } = await supabase
    .from('care_third_party_uploads')
    .insert({
      installer_tenant_id: installerTenantId,
      submitter_name: submitterName,
      submitter_company: submitterCompany ?? null,
      submitter_email: submitterEmail,
      submitter_phone: submitterPhone ?? null,
      job_reference: jobReference ?? null,
      property_address: propertyAddress ?? null,
      job_type: jobType ?? null,
      document_name: documentName,
      document_category: documentCategory,
      storage_path: storagePath,
      status: 'pending',
    })
    .select('id')
    .single();

  if (insertError || !upload) {
    return NextResponse.json(
      { error: insertError?.message ?? 'Could not record upload' },
      { status: 500 },
    );
  }

  // Ensure the bucket exists so the signed URL succeeds. Private bucket.
  await supabase.storage.createBucket(THIRD_PARTY_BUCKET, { public: false }).catch(() => null);

  const { data: signed, error: signedError } = await supabase.storage
    .from(THIRD_PARTY_BUCKET)
    .createSignedUploadUrl(storagePath);

  if (signedError || !signed) {
    return NextResponse.json(
      { error: signedError?.message ?? 'Could not create upload URL' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    uploadId: upload.id,
    bucket: THIRD_PARTY_BUCKET,
    storagePath,
    signedUrl: signed.signedUrl,
    token: signed.token,
  });
}
