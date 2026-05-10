import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { resolveAgentContextV2 } from '@/lib/agent-intelligence/resolve-agent-v2';
import {
  confirmApplicantAdd,
  confirmApplicantUpdate,
  confirmApplicantRemove,
  type ApplicantCandidate,
  type ApplicantUpdateDraft,
  type ApplicantRemoveDraft,
} from '@/lib/agent-intelligence/tools/applicant-tools';
import type { AgentContext } from '@/lib/agent-intelligence/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface AddBody {
  action: 'add';
  candidates: ApplicantCandidate[];
  selected_indices: number[];
}
interface UpdateBody {
  action: 'update';
  draft: ApplicantUpdateDraft;
}
interface RemoveBody {
  action: 'remove';
  drafts: ApplicantRemoveDraft[];
}
type Body = AddBody | UpdateBody | RemoveBody;

function isAddBody(body: any): body is AddBody {
  return body?.action === 'add' && Array.isArray(body.candidates) && Array.isArray(body.selected_indices);
}
function isUpdateBody(body: any): body is UpdateBody {
  return body?.action === 'update' && body.draft && typeof body.draft.applicant_id === 'string';
}
function isRemoveBody(body: any): body is RemoveBody {
  return body?.action === 'remove' && Array.isArray(body.drafts);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Body;
    if (!isAddBody(body) && !isUpdateBody(body) && !isRemoveBody(body)) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
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

    if (isAddBody(body)) {
      console.log('[confirm-applicants:add] body received', {
        candidates: body.candidates.length,
        selected_indices: body.selected_indices,
      });
      const result = await confirmApplicantAdd(supabase, agentContext, {
        candidates: body.candidates,
        selected_indices: body.selected_indices,
      });
      // When the agent picked at least one candidate but every insert
      // failed, surface a 500 with the per-row errors so the card lands in
      // its visible error state instead of silently saying "Added 0".
      if (body.selected_indices.length > 0 && result.created.length === 0) {
        return NextResponse.json(
          {
            error: result.errors[0]?.message || "Couldn't add applicants",
            action: 'add',
            result,
          },
          { status: 500 },
        );
      }
      return NextResponse.json({ action: 'add', result });
    }
    if (isUpdateBody(body)) {
      const result = await confirmApplicantUpdate(supabase, agentContext, { draft: body.draft });
      return NextResponse.json({ action: 'update', result });
    }
    const result = await confirmApplicantRemove(supabase, agentContext, { drafts: body.drafts });
    return NextResponse.json({ action: 'remove', result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
