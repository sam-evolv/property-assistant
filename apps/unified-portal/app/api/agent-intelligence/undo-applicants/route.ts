import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { resolveAgentContextV2 } from '@/lib/agent-intelligence/resolve-agent-v2';
import { undoApplicantAction } from '@/lib/agent-intelligence/tools/applicant-tools';
import type { AgentContext } from '@/lib/agent-intelligence/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const auditLogId = body?.audit_log_id;
    if (typeof auditLogId !== 'string' || auditLogId.length === 0) {
      return NextResponse.json({ error: 'audit_log_id required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const cookieStore = cookies();
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const v2 = await resolveAgentContextV2(supabase, user.id);
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

    const result = await undoApplicantAction(supabase, agentContext, auditLogId);
    const status = result.status === 'reverted' ? 200 : result.status === 'not_found' ? 404 : 409;
    return NextResponse.json(result, { status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
