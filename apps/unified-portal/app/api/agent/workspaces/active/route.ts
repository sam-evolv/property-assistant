import { NextResponse, type NextRequest } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { requireRole, getSupabaseAdmin } from '@/lib/supabase-server';
import { setActiveWorkspace } from '@/lib/agent/workspaces';

export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/workspaces/active
 *
 * Body: { workspaceId: string }
 *
 * Sets agent_profiles.last_active_workspace_id after verifying the workspace
 * belongs to the calling agent. Returns the destination URL the caller should
 * navigate to (sales -> /agent/home, lettings -> /agent/lettings/home). The
 * data layer never navigates — that's a UI decision.
 *
 * Service role bypasses RLS so the ownership check inside setActiveWorkspace
 * is the security boundary; without it, an agent could point their pointer at
 * someone else's workspace.
 */
export async function POST(request: NextRequest) {
  try {
    await requireRole(['developer', 'admin', 'super_admin']);

    const body = await request.json().catch(() => null);
    const workspaceId = typeof body?.workspaceId === 'string' ? body.workspaceId : null;
    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

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
      console.error('[agent/workspaces/active] profile lookup error:', profileErr.message);
      return NextResponse.json({ error: 'Profile lookup failed' }, { status: 500 });
    }
    if (!agentProfile) {
      return NextResponse.json({ error: 'No agent profile for this user' }, { status: 403 });
    }

    const result = await setActiveWorkspace(agentProfile.id, workspaceId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED' || message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message === 'WORKSPACE_NOT_FOUND') {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }
    if (message === 'WORKSPACE_OWNERSHIP_MISMATCH') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('[agent/workspaces/active] error:', message);
    return NextResponse.json({ error: 'Failed to set active workspace' }, { status: 500 });
  }
}
