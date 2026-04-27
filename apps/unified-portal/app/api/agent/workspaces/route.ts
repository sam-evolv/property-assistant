import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { requireRole, getSupabaseAdmin } from '@/lib/supabase-server';
import { getAgentWorkspaces, getActiveWorkspace } from '@/lib/agent/workspaces';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/workspaces
 *
 * Returns the calling agent's workspaces and the id of whichever workspace
 * should be considered active right now (last_active_workspace_id, falling
 * back to is_default=true if unset).
 *
 * Shape: { workspaces: AgentWorkspace[]; activeWorkspaceId: string | null }
 *
 * Auth: requireRole — 'agent' is not a real AdminRole in this codebase
 * (only super_admin / developer / admin / tenant_admin), so we mirror the
 * existing /api/agent/* routes and gate on the same allowlist.
 */
export async function GET() {
  try {
    await requireRole(['developer', 'admin', 'super_admin']);

    const cookieStore = cookies();
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user } } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const { data: agentProfile, error: profileErr } = await admin
      .from('agent_profiles')
      .select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (profileErr) {
      console.error('[agent/workspaces] profile lookup error:', profileErr.message);
      return NextResponse.json({ error: 'Profile lookup failed' }, { status: 500 });
    }
    if (!agentProfile) {
      return NextResponse.json({ workspaces: [], activeWorkspaceId: null });
    }

    const [workspaces, active] = await Promise.all([
      getAgentWorkspaces(agentProfile.id),
      getActiveWorkspace(agentProfile.id),
    ]);

    return NextResponse.json({
      workspaces,
      activeWorkspaceId: active?.id ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED' || message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[agent/workspaces] error:', message);
    return NextResponse.json({ error: 'Failed to fetch workspaces' }, { status: 500 });
  }
}
