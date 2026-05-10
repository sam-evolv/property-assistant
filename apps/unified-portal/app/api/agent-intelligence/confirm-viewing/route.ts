import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { resolveAgentContextV2 } from '@/lib/agent-intelligence/resolve-agent-v2';
import { confirmViewing, type ViewingDraft } from '@/lib/agent-intelligence/tools/viewing-tools';
import type { AgentContext } from '@/lib/agent-intelligence/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isViewingDraft(value: unknown): value is ViewingDraft {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.applicant_id === 'string' &&
    typeof v.applicant_name === 'string' &&
    typeof v.development_id === 'string' &&
    typeof v.development_name === 'string' &&
    typeof v.scheduled_at === 'string' &&
    typeof v.duration_minutes === 'number'
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!isViewingDraft(body?.draft)) {
      return NextResponse.json({ error: 'Invalid draft payload' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const cookieStore = cookies();
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const v2 = await resolveAgentContextV2(supabase, user.id);
    const resolved = v2.context;
    if (!resolved) {
      return NextResponse.json({ error: 'No agent profile found' }, { status: 401 });
    }

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
    if (!agentContext.assignedDevelopmentIds.includes(body.draft.development_id)) {
      return NextResponse.json({ error: 'Development not in your assigned schemes' }, { status: 403 });
    }

    const created = await confirmViewing(supabase, agentContext, { draft: body.draft });

    return NextResponse.json({
      viewing: {
        id: created.id,
        scheduled_at: created.scheduled_at,
        status: created.status,
        applicant_name: body.draft.applicant_name,
        development_name: body.draft.development_name,
        duration_minutes: body.draft.duration_minutes,
        location: body.draft.location ?? null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
