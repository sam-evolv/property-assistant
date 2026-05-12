import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { resolveAgentContextV2 } from '@/lib/agent-intelligence/resolve-agent-v2';
import {
  confirmBroadcast,
  type BroadcastDraftEnvelope,
  type BroadcastEmailDraft,
} from '@/lib/agent-intelligence/tools/broadcast-tools';
import type { AgentContext } from '@/lib/agent-intelligence/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface IncomingBody {
  draft: BroadcastDraftEnvelope;
  selected_applicant_ids?: string[];
  selected_emails?: BroadcastEmailDraft[];
}

function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && /.+@.+\..+/.test(value);
}

function validateBody(raw: any): { ok: true; data: IncomingBody } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Invalid body' };
  const draft = raw.draft;
  if (!draft || typeof draft !== 'object') return { ok: false, error: 'draft is required' };
  if (draft.status !== 'draft' || draft.type !== 'broadcast') {
    return { ok: false, error: 'draft must be a broadcast envelope' };
  }
  if (!Array.isArray(draft.emails) || draft.emails.length === 0) {
    return { ok: false, error: 'draft.emails must contain at least one entry' };
  }
  for (const e of draft.emails) {
    if (!e || typeof e !== 'object') return { ok: false, error: 'Invalid email entry' };
    if (!isValidEmail(e.recipient_email)) return { ok: false, error: 'Email recipient_email invalid' };
    if (typeof e.subject !== 'string' || typeof e.body !== 'string') {
      return { ok: false, error: 'Each email needs subject and body strings' };
    }
  }
  return { ok: true, data: raw as IncomingBody };
}

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json();
    const validated = validateBody(raw);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }
    const body = validated.data;

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

    // selected_emails wins when supplied (the card sends edited subjects/bodies
    // plus per-row selection). Otherwise selected_applicant_ids filters the
    // envelope's emails by applicant_id, and a missing filter means "send all".
    const candidateEmails = (body.selected_emails && body.selected_emails.length > 0)
      ? body.selected_emails
      : body.draft.emails;

    const selectedIds = Array.isArray(body.selected_applicant_ids)
      ? new Set(body.selected_applicant_ids)
      : null;
    const selectedEmailSet = Array.isArray(body.selected_emails)
      ? new Set(body.selected_emails.map((e) => e.recipient_email.trim().toLowerCase()))
      : null;

    const emails = candidateEmails
      .filter((e) => {
        if (!e.subject?.trim() || !e.body?.trim()) return false;
        if (selectedIds) {
          if (e.applicant_id === null) return selectedEmailSet?.has(e.recipient_email.trim().toLowerCase()) ?? false;
          return selectedIds.has(e.applicant_id);
        }
        if (selectedEmailSet) {
          return selectedEmailSet.has(e.recipient_email.trim().toLowerCase());
        }
        return e.selected !== false;
      })
      .map((e) => ({
        applicant_id: e.applicant_id ?? null,
        recipient_email: e.recipient_email.trim(),
        recipient_name: (e.recipient_name || '').trim() || e.recipient_email,
        subject: e.subject.trim(),
        body: e.body.trim(),
      }));

    if (emails.length === 0) {
      return NextResponse.json({ error: 'Pick at least one recipient.' }, { status: 400 });
    }

    const result = await confirmBroadcast(supabaseAdmin, agentContext, {
      intent: body.draft.intent,
      filter_used: body.draft.filter_used,
      filter_natural: body.draft.filter_natural,
      tone: body.draft.tone,
      emails,
    });

    if (result.status === 'error') {
      return NextResponse.json(
        { status: 'error', error: result.error, broadcast_id: result.broadcast_id, drafts_written: 0 },
        { status: 500 },
      );
    }

    return NextResponse.json({
      status: 'success',
      broadcast_id: result.broadcast_id,
      drafts_written: result.drafts_written,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[confirm-broadcast] unhandled', { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
