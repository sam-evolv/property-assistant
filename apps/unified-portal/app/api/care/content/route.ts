export const dynamic = 'force-dynamic';

/**
 * GET /api/care/content?installation_id=<id>
 *
 * Returns installer_content grouped by content_type for the given
 * installation's tenant, filtered to content matching the installation's
 * system_type plus general content (system_type IS NULL).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const installationId = searchParams.get('installation_id');

  if (!installationId) {
    return NextResponse.json({ error: 'installation_id required' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Resolve installation → tenant_id + system_type
  const { data: installation, error: instError } = await supabase
    .from('installations')
    .select('id, tenant_id, system_type')
    .eq('id', installationId)
    .single();

  if (instError || !installation) {
    return NextResponse.json({ error: 'Installation not found' }, { status: 404 });
  }

  // Fetch content matching tenant + (system_type OR general)
  const { data: items, error: contentError } = await supabase
    .from('installer_content')
    .select('id, title, content_type, system_type, description, content_url, thumbnail_url, is_featured, display_order')
    .eq('tenant_id', installation.tenant_id)
    .or(`system_type.eq.${installation.system_type},system_type.is.null`)
    .order('display_order', { ascending: true });

  if (contentError) {
    return NextResponse.json({ error: 'Failed to fetch content' }, { status: 500 });
  }

  // Group by content_type
  const grouped: Record<string, object[]> = {};
  for (const item of items ?? []) {
    const type: string = item.content_type ?? 'guide';
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push({
      id: item.id,
      title: item.title,
      content_type: item.content_type,
      category: item.system_type,
      description: item.description,
      content_url: item.content_url,
      thumbnail_url: item.thumbnail_url,
      is_featured: item.is_featured,
      view_count: item.display_order ?? 0,
    });
  }

  return NextResponse.json({ content: grouped });
}
