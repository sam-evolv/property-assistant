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
  if (!installationId) return NextResponse.json({ conversations: [] });

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('care_conversations')
    .select('id, title, message_count, created_at, updated_at')
    .eq('installation_id', installationId)
    .order('updated_at', { ascending: false })
    .limit(10);

  return NextResponse.json({ conversations: data || [] });
}
