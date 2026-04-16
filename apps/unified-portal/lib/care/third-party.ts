import { createClient } from '@supabase/supabase-js';

export const THIRD_PARTY_BUCKET = 'care-third-party-uploads';

export const SE_SYSTEMS_TENANT_FALLBACK_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
export const SE_SYSTEMS_TENANT_NAME = 'SE Systems Cork';

export const DOCUMENT_CATEGORIES = [
  'Commissioning Certificate',
  'Manufacturer Warranty',
  'SEAI Grant Documentation',
  'BER Certificate',
  'Installation Photos',
  'Compliance Certificate',
  'Handover Pack',
  'Other',
] as const;

export const JOB_TYPES = [
  'Solar PV Installation',
  'Heat Pump Installation',
  'EV Charger Installation',
  'Battery Storage Installation',
  'Insulation / Deep Retrofit',
  'Ventilation (MVHR)',
  'Other',
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];
export type JobType = (typeof JOB_TYPES)[number];

export function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

/**
 * Resolves the SE Systems Cork tenant id. Falls back to a stable demo id if
 * the tenants table cannot be queried (for example when RLS blocks anonymous
 * lookups). For the SE Systems demo this only needs to return a stable uuid
 * that matches the seed data.
 */
export async function resolveSESystemsTenantId(): Promise<string> {
  try {
    const supabase = getServiceClient();
    const { data } = await supabase
      .from('tenants')
      .select('id')
      .eq('name', SE_SYSTEMS_TENANT_NAME)
      .maybeSingle();
    if (data?.id) return data.id as string;

    const { data: inserted } = await supabase
      .from('tenants')
      .insert({ name: SE_SYSTEMS_TENANT_NAME })
      .select('id')
      .single();
    if (inserted?.id) return inserted.id as string;
  } catch {
    // fall through
  }
  return SE_SYSTEMS_TENANT_FALLBACK_ID;
}

export function buildStoragePath(submitterEmail: string, filename: string) {
  const slug = submitterEmail.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const clean = filename.replace(/[^a-z0-9._-]/gi, '-');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${slug}/${stamp}-${clean}`;
}
