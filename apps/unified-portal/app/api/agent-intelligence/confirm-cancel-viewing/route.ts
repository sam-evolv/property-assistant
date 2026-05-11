import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { resolveAgentContextV2 } from '@/lib/agent-intelligence/resolve-agent-v2';
import {
  confirmCancelViewing,
  type ViewingSource,
} from '@/lib/agent-intelligence/tools/viewing-tools';
import type { AgentContext } from '@/lib/agent-intelligence/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface IncomingBody {
  viewing_id: string;
  source: ViewingSource;
  reason?: string | null;
}

function isValidSource(s: unknown): s is ViewingSource {
  return s === 'viewings' || s === 'agent_viewings';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }
    if (typeof body.viewing_id !== 'string' || body.viewing_id.length === 0) {
      return NextResponse.json({ error: 'viewing_id required' }, { status: 400 });
    }
    if (!isValidSource(body.source)) {
      return NextResponse.json({ error: 'source must be "viewings" or "agent_viewings"' }, { status: 400 });
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
    if (!agentContext.tenantId) {
      return NextResponse.json({ error: 'Agent has no tenant assignment' }, { status: 403 });
    }

    const result = await confirmCancelViewing(supabase, agentContext, {
      viewing_id: body.viewing_id,
      source: body.source,
      reason: typeof body.reason === 'string' ? body.reason : null,
    });

    return NextResponse.json({ status: 'success', ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[confirm-cancel-viewing] failed', { message });
    return NextResponse.json({ status: 'error', error: message }, { status: 500 });
  }
}
