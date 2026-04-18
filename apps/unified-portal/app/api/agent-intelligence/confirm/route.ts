import { NextRequest } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// POST /api/agent-intelligence/confirm
// ---------------------------------------------------------------------------
// Approval-flow endpoint for the agent Intelligence skin.
//
// Each agentic skill (chase_aged_contracts, draft_viewing_followup,
// weekly_monday_briefing, draft_lease_renewal, natural_query,
// schedule_viewing_draft) returns an envelope of drafts. The drafts hold a
// stable UUID and are shown to the agent in the UI. When the agent approves,
// edits, or discards one, the client POSTs the draft back here and we
// materialise the side-effect (insert viewing, log email, etc.) exactly once.
//
// IMPORTANT: no real email transport is wired. When an email draft is
// approved, we write a row into `communication_events` — that's the
// "sent-from-the-app" marker. A future session will plug in Resend / SMTP.
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_DRAFT_TYPES = new Set(['email', 'viewing_record', 'report']);
const VALID_USER_ACTIONS = new Set(['approve', 'edit', 'discard']);

// `communication_events.counterparty_role` is CHECK-constrained to
// agent|developer|buyer|solicitor|other — agentic skills currently emit
// 'agent', 'buyer', 'solicitor', 'tenant'. Map the outliers to 'other'.
const COUNTERPARTY_ROLE_MAP: Record<string, string> = {
  agent: 'agent',
  developer: 'developer',
  buyer: 'buyer',
  solicitor: 'solicitor',
};

// `intelligence_interactions.user_action` is CHECK-constrained to
// accepted|edited|rejected|ignored|sent. Translate the client-facing
// approve|edit|discard into those.
const INTERACTION_USER_ACTION: Record<string, string> = {
  approve: 'accepted',
  edit: 'edited',
  discard: 'rejected',
};

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  const { draft, skill, user_action, edited_body, edited_subject, conversation_id, message_id } = body ?? {};

  // --- Validation (Step 2) -------------------------------------------------
  if (!draft || typeof draft !== 'object') {
    return jsonResponse(400, { error: 'draft object is required' });
  }
  if (typeof draft.id !== 'string' || !UUID_RE.test(draft.id)) {
    return jsonResponse(400, { error: 'draft.id must be a valid uuid' });
  }
  if (!VALID_DRAFT_TYPES.has(draft.type)) {
    return jsonResponse(400, { error: `draft.type must be one of: email | viewing_record | report` });
  }
  if (typeof skill !== 'string' || !skill.length) {
    return jsonResponse(400, { error: 'skill is required' });
  }
  if (!VALID_USER_ACTIONS.has(user_action)) {
    return jsonResponse(400, { error: 'user_action must be one of: approve | edit | discard' });
  }
  if (user_action === 'edit' && (typeof edited_body !== 'string' || !edited_body.length)) {
    return jsonResponse(400, { error: 'edited_body is required when user_action="edit"' });
  }

  const supabase = getSupabaseAdmin();

  // --- Authentication ------------------------------------------------------
  // Match the pattern used in /chat: route-handler auth client reads the
  // session cookie, then fall back to the first agent profile in dev mode.
  const cookieStore = cookies();
  const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });
  const { data: { user } } = await supabaseAuth.auth.getUser();

  let profile: { id: string; user_id: string; tenant_id: string; display_name: string | null } | null = null;

  if (user) {
    const { data } = await supabase
      .from('agent_profiles')
      .select('id, user_id, tenant_id, display_name')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    profile = data as typeof profile;
  }
  if (!profile) {
    const { data } = await supabase
      .from('agent_profiles')
      .select('id, user_id, tenant_id, display_name')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    profile = data as typeof profile;
  }
  if (!profile) {
    return jsonResponse(401, { error: 'No agent profile found' });
  }

  const agentUserId = profile.user_id;
  const agentProfileId = profile.id;
  const tenantId = profile.tenant_id;
  const displayName = profile.display_name || 'Agent';

  // --- Idempotency / discarded check (Step 1) ------------------------------
  // intelligence_actions has no unique constraint on (draft_id), so we query
  // by metadata->>draft_id scoped to this agent (stored on `developer_id`,
  // repurposed to hold the agent's auth user_id — see migration 027 comment).
  const { data: existingRows } = await supabase
    .from('intelligence_actions')
    .select('id, action_status, action_type, created_at')
    .eq('developer_id', agentUserId)
    .filter('metadata->>draft_id', 'eq', draft.id)
    .order('created_at', { ascending: false })
    .limit(1);

  const existing = existingRows?.[0];
  if (existing) {
    if (existing.action_status === 'completed') {
      return jsonResponse(200, {
        status: 'already_completed',
        previous_action: existing.action_type,
        completed_at: existing.created_at,
      });
    }
    if (existing.action_status === 'discarded') {
      return jsonResponse(409, { error: 'draft_already_discarded' });
    }
    // Any other status falls through and is treated as first-time confirm.
  }

  const actionType = `skill:${skill}:${draft.type}`;
  const affectedLabel = draft.affected_record?.label ?? draft.subject ?? draft.id;

  // --- Discard path --------------------------------------------------------
  if (user_action === 'discard') {
    await supabase.from('intelligence_actions').insert({
      developer_id: agentUserId,
      conversation_id: conversation_id || null,
      message_id: message_id || null,
      action_type: actionType,
      action_status: 'discarded',
      description: `User discarded draft: ${affectedLabel}`,
      metadata: { draft_id: draft.id, skill, draft_snapshot: draft },
    });

    await supabase.from('intelligence_interactions').insert({
      tenant_id: tenantId,
      user_id: agentUserId,
      user_role: 'agent',
      skin: 'agent',
      // query_text is NOT NULL on the table — use a synthetic marker.
      query_text: `[confirm] ${skill}`,
      tools_called: [skill],
      // response_type CHECK allows answer|draft|report|task_created|error|clarification;
      // 'draft_discarded' is not permitted, so we record the category ('draft')
      // and rely on user_action='rejected' for the disposition.
      response_type: 'draft',
      user_action: INTERACTION_USER_ACTION.discard,
      model_used: null,
    });

    return jsonResponse(200, { status: 'discarded', draft_id: draft.id });
  }

  // --- Approve / edit path -------------------------------------------------
  const finalSubject = user_action === 'edit' && typeof edited_subject === 'string'
    ? edited_subject
    : (draft.subject ?? null);
  const finalBody = user_action === 'edit' ? edited_body : draft.body;

  let communicationEventId: string | null = null;
  let agentViewingId: string | null = null;
  const sideEffectNotes: string[] = [];

  if (draft.type === 'email') {
    const recipient = draft.recipient ?? {};
    const isSelfEmail = recipient.email === 'self';

    if (isSelfEmail) {
      // Briefings and natural-query reports are self-addressed "reports"
      // delivered as type=email. The agent acknowledging them should not
      // create a communication_events row.
      sideEffectNotes.push('self-addressed email — communication_events insert skipped');
    } else {
      // communication_events.development_id is NOT NULL, so we have to
      // resolve one from the affected record. If that's not possible
      // (letting property, tenancy, briefing, query) we skip the insert and
      // record a note — the intelligence_actions row is the durable audit.
      const devId = await resolveDevelopmentId(supabase, draft.affected_record);
      if (!devId) {
        sideEffectNotes.push(
          `no development_id resolvable from affected_record.kind="${draft.affected_record?.kind ?? 'unknown'}" — communication_events insert skipped (column is NOT NULL)`,
        );
      } else {
        const counterpartyRole = COUNTERPARTY_ROLE_MAP[recipient.role as string] ?? 'other';
        // communication_events has neither a `metadata` jsonb column nor a
        // `counterparty_email` column. Stash the email address and the
        // richer audit metadata in `outcome` (text) as JSON so it's at least
        // queryable via `outcome::jsonb->>...` in future analytics.
        const outcomePayload = JSON.stringify({
          skill,
          draft_id: draft.id,
          was_edited: user_action === 'edit',
          counterparty_email: recipient.email ?? null,
          reasoning: draft.reasoning ?? null,
          body: finalBody,
        });

        const unitIdForEvent = draft.affected_record?.kind === 'sales_unit'
          ? draft.affected_record.id
          : null;

        // NOTE: no email transport is wired yet. This row is the
        // "sent-from-the-app" marker until Resend / SMTP is plugged in.
        const { data: cev, error: cevErr } = await supabase
          .from('communication_events')
          .insert({
            tenant_id: tenantId,
            development_id: devId,
            unit_id: unitIdForEvent,
            actor_id: agentUserId,
            actor_role: 'agent',
            actor_name: displayName,
            type: 'email',
            direction: 'outbound',
            counterparty_name: recipient.name ?? null,
            counterparty_role: counterpartyRole,
            subject: finalSubject,
            summary: (finalBody ?? '').slice(0, 200),
            outcome: outcomePayload,
            visibility: 'shared',
          })
          .select('id')
          .maybeSingle();
        if (cevErr) {
          sideEffectNotes.push(`communication_events insert failed: ${cevErr.message}`);
        } else if (cev) {
          communicationEventId = cev.id;
        }
      }
    }
  } else if (draft.type === 'viewing_record') {
    let parsed: Record<string, any>;
    try {
      parsed = JSON.parse(draft.body);
    } catch (e) {
      return jsonResponse(500, {
        error: 'viewing_record draft body is not valid JSON',
        details: e instanceof Error ? e.message : String(e),
      });
    }

    // Do not trust any auth-sensitive values from the draft body — force
    // agent_id and tenant_id to values resolved from the session.
    const viewingRow: Record<string, any> = {
      agent_id: agentProfileId,
      tenant_id: tenantId,
      development_id: parsed.development_id ?? null,
      unit_id: parsed.unit_id ?? null,
      buyer_name: parsed.buyer_name ?? null,
      buyer_email: parsed.buyer_email ?? null,
      buyer_phone: parsed.buyer_phone ?? null,
      scheme_name: parsed.scheme_name ?? null,
      unit_ref: parsed.unit_ref ?? null,
      viewing_date: parsed.viewing_date ?? null,
      viewing_time: parsed.viewing_time ?? null,
      status: 'confirmed',
      source: 'intelligence',
    };

    const { data: viewing, error: vErr } = await supabase
      .from('agent_viewings')
      .insert(viewingRow)
      .select('id')
      .maybeSingle();
    if (vErr) {
      return jsonResponse(500, { error: 'Failed to insert agent_viewings row', details: vErr.message });
    }
    if (viewing) agentViewingId = viewing.id;
  }
  // draft.type === 'report' → no side effect by design.

  // Durable audit trail. description must be NOT NULL on intelligence_actions.
  await supabase.from('intelligence_actions').insert({
    developer_id: agentUserId,
    conversation_id: conversation_id || null,
    message_id: message_id || null,
    action_type: actionType,
    action_status: 'completed',
    description: `Executed: ${affectedLabel}`,
    metadata: {
      draft_id: draft.id,
      skill,
      draft_snapshot: draft,
      final_subject: finalSubject,
      final_body: finalBody,
      was_edited: user_action === 'edit',
      side_effects: {
        communication_event_id: communicationEventId,
        agent_viewing_id: agentViewingId,
        notes: sideEffectNotes,
      },
    },
  });

  await supabase.from('intelligence_interactions').insert({
    tenant_id: tenantId,
    user_id: agentUserId,
    user_role: 'agent',
    skin: 'agent',
    query_text: `[confirm] ${skill}`,
    tools_called: [skill],
    // 'draft_executed' isn't in the CHECK list — 'draft' is the nearest
    // allowed category. The user_action column carries the disposition.
    response_type: 'draft',
    user_action: INTERACTION_USER_ACTION[user_action],
    edited_text: user_action === 'edit' ? finalBody : null,
    model_used: null,
  });

  return jsonResponse(200, {
    status: 'completed',
    draft_id: draft.id,
    action_type: actionType,
    side_effects: {
      communication_event_id: communicationEventId,
      agent_viewing_id: agentViewingId,
    },
  });
}

// Try to resolve a development_id for a draft's affected record. Returns null
// when the record kind isn't scheme-scoped (tenancy, letting_property, query,
// briefing) or when the lookup fails. Callers should treat null as "skip the
// communication_events insert" — the primary audit trail lives in
// intelligence_actions.
async function resolveDevelopmentId(
  supabase: SupabaseClient,
  affected: { kind?: string; id?: string } | undefined,
): Promise<string | null> {
  if (!affected?.kind || !affected.id) return null;
  if (affected.kind === 'sales_unit') {
    const { data } = await supabase
      .from('units')
      .select('development_id')
      .eq('id', affected.id)
      .maybeSingle();
    return (data as any)?.development_id ?? null;
  }
  if (affected.kind === 'viewing') {
    const { data } = await supabase
      .from('agent_viewings')
      .select('development_id')
      .eq('id', affected.id)
      .maybeSingle();
    return (data as any)?.development_id ?? null;
  }
  return null;
}
