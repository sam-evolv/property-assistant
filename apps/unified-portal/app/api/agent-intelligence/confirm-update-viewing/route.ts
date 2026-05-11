import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { resolveAgentContextV2 } from '@/lib/agent-intelligence/resolve-agent-v2';
import {
  confirmUpdateViewing,
  type ViewingFieldDelta,
  type ViewingSource,
} from '@/lib/agent-intelligence/tools/viewing-tools';
import type { AgentContext } from '@/lib/agent-intelligence/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface IncomingBody {
  viewing_id: string;
  source: ViewingSource;
  next: ViewingFieldDelta;
}

function isValidSource(s: unknown): s is ViewingSource {
  return s === 'viewings' || s === 'agent_viewings';
}

function validate(body: any): { ok: true; data: IncomingBody } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid body' };
  if (typeof body.viewing_id !== 'string' || body.viewing_id.length === 0) {
    return { ok: false, error: 'viewing_id required' };
  }
  if (!isValidSource(body.source)) return { ok: false, error: 'source must be "viewings" or "agent_viewings"' };
  if (!body.next || typeof body.next !== 'object') return { ok: false, error: 'next required' };
  return { ok: true, data: body as IncomingBody };
}

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json();
    const validated = validate(raw);
    if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });

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

    if (validated.data.next.property && validated.data.next.property.development_id) {
      if (!agentContext.assignedDevelopmentIds.includes(validated.data.next.property.development_id)) {
        return NextResponse.json({ error: 'Development not in your assigned schemes' }, { status: 403 });
      }
    }

    const result = await confirmUpdateViewing(supabase, agentContext, {
      viewing_id: validated.data.viewing_id,
      source: validated.data.source,
      next: validated.data.next,
    });

    return NextResponse.json({ status: 'success', ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[confirm-update-viewing] failed', { message });
    return NextResponse.json({ status: 'error', error: message }, { status: 500 });
  }
}
