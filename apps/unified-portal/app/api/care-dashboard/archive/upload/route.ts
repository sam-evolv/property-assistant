export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/supabase-server';
import {
  DOCUMENT_CATEGORIES,
  getServiceClient,
  resolveSESystemsTenantId,
} from '@/lib/care/third-party';

const INSTALLER_CONTENT_BUCKET = 'installer-content';
const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
]);

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

function titleFromFilename(name: string) {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

function safeFilename(name: string) {
  return name.replace(/[^a-z0-9._-]/gi, '-');
}

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) return bad('Invalid form data');

  const file = form.get('file');
  const installationId = form.get('installation_id');
  const category = form.get('category');
  const notesRaw = form.get('notes');

  if (!(file instanceof File)) return bad('Missing file');
  if (typeof installationId !== 'string' || !installationId) return bad('Missing installation_id');
  if (typeof category !== 'string' || !category) return bad('Missing category');
  if (!DOCUMENT_CATEGORIES.includes(category as (typeof DOCUMENT_CATEGORIES)[number])) {
    return bad('Invalid category');
  }
  if (file.size === 0) return bad('Empty file');
  if (file.size > MAX_BYTES) return bad('File exceeds 25 MB limit');
  if (file.type && !ALLOWED_MIME.has(file.type)) return bad('Unsupported file type');

  const notes = typeof notesRaw === 'string' && notesRaw.trim() ? notesRaw.trim() : null;
  const tenantId = session.tenantId ?? (await resolveSESystemsTenantId());
  const supabase = getServiceClient();

  const { data: installation, error: instErr } = await supabase
    .from('installations')
    .select('id, tenant_id, system_type, inverter_model, panel_model, job_reference, address_line_1, city')
    .eq('id', installationId)
    .single();

  if (instErr || !installation) return bad('Installation not found', 404);
  if (session.tenantId && installation.tenant_id !== session.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await supabase.storage.createBucket(INSTALLER_CONTENT_BUCKET, { public: true }).catch(() => null);

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const storagePath = `${tenantId}/${installation.id}/${stamp}-${safeFilename(file.name)}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await supabase.storage
    .from(INSTALLER_CONTENT_BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });

  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  const { data: publicUrl } = supabase.storage
    .from(INSTALLER_CONTENT_BUCKET)
    .getPublicUrl(storagePath);

  const title = titleFromFilename(file.name);

  const jobRef = installation.job_reference as string | null;
  const address = [installation.address_line_1, installation.city].filter(Boolean).join(', ');
  const descriptionParts = [
    notes,
    `Category: ${category}`,
    jobRef ? `Job ${jobRef}` : null,
    address || null,
  ].filter(Boolean);
  const description = descriptionParts.join(' · ');

  const { data: row, error: insertErr } = await supabase
    .from('installer_content')
    .insert({
      tenant_id: tenantId,
      title,
      content_type: 'document',
      system_type: installation.system_type ?? null,
      description,
      file_url: publicUrl.publicUrl,
      status: 'live',
    })
    .select('id')
    .single();

  if (insertErr || !row) {
    await supabase.storage.from(INSTALLER_CONTENT_BUCKET).remove([storagePath]).catch(() => null);
    return NextResponse.json(
      { error: insertErr?.message ?? 'Could not record content' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, id: row.id });
}
