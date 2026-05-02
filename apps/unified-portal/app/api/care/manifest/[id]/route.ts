export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Look up the tenant logo so the installed PWA's home-screen icon matches
  // the installer for that installation. Everything else stays as before.
  let tenantLogo: string | null = null;
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('installations')
      .select('tenants(logo_url)')
      .eq('id', id)
      .single();
    tenantLogo = (data as any)?.tenants?.logo_url ?? null;
  } catch {
    // Ignore — we'll emit the generic OpenHouse Care manifest.
  }

  const icons = tenantLogo
    ? [
        { src: tenantLogo, sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: tenantLogo, sizes: '512x512', type: 'image/png', purpose: 'any' },
      ]
    : [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      ];

  const manifest = {
    name: 'OpenHouse Care',
    short_name: 'Care',
    description: 'Your home system care portal',
    start_url: `/care/${id}`,
    scope: `/care/${id}`,
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#D4AF37',
    orientation: 'portrait-primary',
    icons,
  };

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
