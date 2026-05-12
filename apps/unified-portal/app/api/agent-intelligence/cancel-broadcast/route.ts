import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { resolveAgentContextV2 } from '@/lib/agent-intelligence/resolve-agent-v2';
import { cancelBroadcast } from '@/lib/agent-intelligence/tools/broadcast-tools';
import type { AgentContext } from '@/lib/agent-intelligence/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json();
    const auditLogId = typeof raw?.audit_log_id === 'string' ? raw.audit_log_id.trim() : '';
    if (!auditLogId) {
      return NextResponse.json({ error: 'audit_log_id is required' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const cookieStore = cookies();
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const v2 = await resolveAgentContextV2(supabaseAdmin, user.id);
    const resolved = v2.context;
    if (!resolved) return NextResponse.json({ error: 'No agent profile found' }, { status: 401 });

    const agentContext: AgentContext = {
      agentProfileId: resolved.agentProfileId,
      authUserId: resolved.authUserId,
      tenantId: resolved.tenantId ?? '',
      displayName: resolved.displayName,
      agencyName: resolved.agencyName,
      agentType: resolved.agentType,
      assignedSchemes: resolved.assignedSchemes,
      assignedDevelopmentIds: resolved.assignedDevelopmentIds,
      assignedDevelopmentNames: resolved.assignedDevelopmentNames,
      activeDevelopmentId: null,
      isDemoMode: resolved.isDemoMode,
    };

    if (!agentContext.tenantId) {
      return NextResponse.json({ error: 'Agent has no tenant assignment' }, { status: 403 });
    }

    const result = await cancelBroadcast(supabaseAdmin, agentContext, { audit_log_id: auditLogId });

    if (result.status === 'not_found') {
      return NextResponse.json({ status: 'not_found', error: result.error }, { status: 404 });
    }
    if (result.status === 'expired') {
      return NextResponse.json({ status: 'expired', error: result.error }, { status: 410 });
    }
    if (result.status === 'error') {
      return NextResponse.json({ status: 'error', error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      status: result.status,
      drafts_deleted: result.drafts_deleted,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[cancel-broadcast] unhandled', { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
