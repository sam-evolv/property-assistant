import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  const { code } = await req.json();

  if (!code || typeof code !== 'string') {
    return NextResponse.json({ error: 'Access code required' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: installation, error } = await supabase
    .from('installations')
    .select('id, system_type, system_model')
    .eq('access_code', code.trim().toUpperCase())
    .eq('is_active', true)
    .single();

  if (error || !installation) {
    return NextResponse.json({ error: 'Invalid access code' }, { status: 404 });
  }

  return NextResponse.json({ installationId: installation.id });
}
