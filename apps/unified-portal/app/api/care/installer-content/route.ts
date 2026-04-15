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
    .select('id, title, content_type, system_type, description, url, is_published, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('installer_content fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    content: content || [],
    total: content?.length ?? 0,
  });
}
