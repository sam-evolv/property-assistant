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

  // Resolve installer branding from the installation's tenant. Falls back to
  // the OpenHouse Care defaults when env/auth isn't available so the manifest
  // endpoint never 500s for the PWA install flow.
  let tenantName: string | null = null;
  let tenantLogo: string | null = null;
  let tenantTheme: string | null = null;
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('installations')
      .select('tenants(name, logo_url, theme_color)')
      .eq('id', id)
      .single();
    const tenant = (data as any)?.tenants ?? null;
    tenantName = tenant?.name ?? null;
    tenantLogo = tenant?.logo_url ?? null;
    tenantTheme = tenant?.theme_color ?? null;
  } catch {
    // Ignore — we'll emit the generic OpenHouse Care manifest.
  }

  const appName = tenantName ? `${tenantName} Care` : 'OpenHouse Care';
  const shortName = tenantName ?? 'Care';
  const themeColor = tenantTheme ?? '#D4AF37';

  // Use the tenant logo for both icon sizes when present (browsers will scale).
  // Keep the local PNGs as the fallback so the app stays installable when a
  // tenant has no logo configured yet.
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
    name: appName,
    short_name: shortName,
    description: 'Your home system care portal',
    start_url: `/care/${id}`,
    scope: `/care/${id}`,
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: themeColor,
    orientation: 'portrait-primary',
    icons,
  };

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      // Short cache so the demo install picks up tenant changes promptly.
      'Cache-Control': 'public, max-age=60',
    },
  });
}
