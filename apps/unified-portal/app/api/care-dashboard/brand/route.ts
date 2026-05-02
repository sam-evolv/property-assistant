export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSessionWithStatus, getSupabaseAdmin } from '@/lib/supabase-server';

/**
 * GET /api/care-dashboard/brand
 *
 * Resolves the logged-in user's tenant and returns the installer branding
 * the Care Dashboard layout / insights / archive pages need to render
 * (logo, display name, slug). The Care Dashboard chrome was hardcoded to
 * SE Systems before this endpoint existed.
 */
export async function GET() {
  const session = await getServerSessionWithStatus();
  if (session.status !== 'authenticated') {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }

  const tenantId = session.session.tenantId;
  if (!tenantId) {
    return NextResponse.json({ name: null, logoUrl: null, slug: null });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('tenants')
    .select('name, logo_url, slug')
    .eq('id', tenantId)
    .single();

  if (error || !data) {
    return NextResponse.json({ name: null, logoUrl: null, slug: null });
  }

  return NextResponse.json({
    name: data.name ?? null,
    logoUrl: data.logo_url ?? null,
    slug: data.slug ?? null,
  });
}
