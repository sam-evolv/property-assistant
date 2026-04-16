export const dynamic = 'force-dynamic';

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
  const tenantId = searchParams.get('tenantId');

  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId required' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: content, error } = await supabase
    .from('installer_content')
    .select('id, title, content_type, system_type, description, file_url, status, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('installer_content fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type ContentRow = {
    id: string; title: string; content_type: string; system_type: string | null;
    description: string | null; file_url: string | null; status: string | null; created_at: string;
  };
  const mapped = ((content || []) as ContentRow[]).map(item => ({
    id: item.id,
    title: item.title,
    content_type: item.content_type,
    system_type: item.system_type,
    description: item.description,
    url: item.file_url ?? null,
    is_published: item.status === 'live',
    created_at: item.created_at,
  }));

  return NextResponse.json({
    content: mapped,
    total: mapped.length,
  });
}
