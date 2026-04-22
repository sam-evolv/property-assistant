import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/applicants/badge-count
 *
 * Returns the number of applicants with at least one application in an
 * action-required state (received or referencing) — i.e. things the agent
 * needs to look at. Drives the nav badge on mobile + sidebar on desktop.
 */
export async function GET(_request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const cookieStore = cookies();
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user } } = await supabaseAuth.auth.getUser();

    let agentId: string | null = null;
    if (user) {
      const { data } = await supabase
        .from('agent_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      agentId = data?.id || null;
    }
    if (!agentId) {
      const { data } = await supabase
        .from('agent_profiles')
        .select('id')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      agentId = data?.id || null;
    }
    if (!agentId) return NextResponse.json({ count: 0 });

    const { data: apps } = await supabase
      .from('agent_rental_applications')
      .select('applicant_id')
      .eq('agent_id', agentId)
      .in('status', ['received', 'referencing']);

    const unique = new Set((apps || []).map((a) => a.applicant_id));
    return NextResponse.json({ count: unique.size });
  } catch (error: any) {
    return NextResponse.json({ count: 0, error: error.message }, { status: 200 });
  }
}
