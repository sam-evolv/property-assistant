import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET() {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('diagnostic_flows')
    .select(`
      id,
      flow_name,
      system_type,
      step_count,
      times_triggered,
      updated_at
    `)
    .order('times_triggered', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ flows: data || [] });
}
