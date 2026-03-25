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

  // Fetch support queries joined with installation for address info
  const { data, error } = await supabase
    .from('support_queries')
    .select(`
      id,
      installation_id,
      query_text,
      query_category,
      resolved,
      escalated,
      resolved_without_callout,
      response_source,
      created_at,
      installations ( job_reference, address_line_1, city, customer_name )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Map to a friendlier shape for the frontend
  const queries = (data || []).map((q: Record<string, unknown>) => {
    const inst = q.installations as Record<string, string> | null;
    // Derive status from resolved + response_source
    let status = 'open';
    if (q.resolved) status = 'resolved';
    else if (q.response_source === 'in_progress') status = 'in_progress';

    return {
      id: q.id,
      installation_id: q.installation_id,
      customer_ref: inst?.customer_name || inst?.job_reference || 'Unknown',
      address: inst ? `${inst.address_line_1}, ${inst.city}` : '',
      query_type: q.query_category || 'General',
      query_status: status,
      description: q.query_text,
      resolved_without_callout: q.resolved_without_callout,
      created_at: q.created_at,
    };
  });

  return NextResponse.json({ queries });
}
