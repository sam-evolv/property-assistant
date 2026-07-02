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

    // Fail closed: no authenticated user or no matching agent profile → 401.
    // Never fall back to the first/oldest agent_profile (cross-tenant leak).
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('agent_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    const agentId = profile?.id || null;
    if (!agentId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
