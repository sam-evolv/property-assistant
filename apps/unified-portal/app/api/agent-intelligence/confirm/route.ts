import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, getSupabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_COUNTERPARTY_ROLES = new Set(['buyer', 'solicitor', 'developer', 'agent']);

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { draft, skill, user_action, conversation_id } = body;

    if (!draft || !skill || !['approve', 'discard'].includes(user_action)) {
      return NextResponse.json(
        { error: 'draft, skill, and user_action (approve|discard) are required' },
        { status: 400 },
      );
    }

    const admin = getSupabaseAdmin();

    // Resolve agent profile for tenant_id + display_name (needed for communication_events)
    const { data: agentProfile } = await admin
      .from('agent_profiles')
      .select('id, tenant_id, display_name')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    const side_effects: {
      intelligence_action_id: string | null;
      communication_event_id: string | null;
      agent_viewing_id: string | null;
    } = {
      intelligence_action_id: null,
      communication_event_id: null,
      agent_viewing_id: null,
    };

    if (user_action === 'approve') {
      // ── communication_events: sales email drafts only ────────────────────
      let communicationEventId: string | null = null;
      const isSalesEmail =
        draft.type === 'email' && draft.affected_record?.kind === 'sales_unit';

      if (isSalesEmail && agentProfile) {
        const { data: unit } = await admin
          .from('units')
          .select('development_id')
          .eq('id', draft.affected_record.id)
          .maybeSingle();

        if (unit?.development_id) {
          const finalSubject = draft.subject ?? null;
          const finalBody: string = draft.body ?? '';
          const counterpartyRole = VALID_COUNTERPARTY_ROLES.has(draft.recipient?.role)
            ? draft.recipient.role
            : 'other';

          const { data: commEvent } = await admin
            .from('communication_events')
            .insert({
              tenant_id: agentProfile.tenant_id,
              development_id: unit.development_id,
              unit_id: draft.affected_record.id,
              actor_id: user.id,
              actor_role: 'agent',
              actor_name: agentProfile.display_name,
              type: 'email',
              direction: 'outbound',
              counterparty_name: draft.recipient?.name ?? null,
              counterparty_role: counterpartyRole,
              subject: finalSubject,
              summary: finalBody.slice(0, 200),
              outcome: JSON.stringify({
                recipient_email: draft.recipient?.email ?? null,
                body: finalBody,
                skill,
                draft_id: draft.id,
                was_edited: false,
              }),
            })
            .select('id')
            .single();

          if (commEvent) {
            communicationEventId = commEvent.id;
          }
        } else {
          console.warn(
            '[confirm] sales_unit email: could not resolve development_id for unit',
            draft.affected_record?.id,
          );
        }
      }

      // ── intelligence_actions ─────────────────────────────────────────────
      const actionType =
        draft.type === 'email'
          ? 'email_sent'
          : draft.type === 'viewing_record'
          ? 'viewing_created'
          : 'report_generated';

      const metadata: Record<string, unknown> = { skill, draft_id: draft.id, draft };
      if (draft.type === 'email' && !isSalesEmail) {
        metadata.communication_events_skipped = 'not a sales email';
      }
      if (isSalesEmail && !communicationEventId) {
        metadata.communication_events_skipped = 'development_id lookup failed';
      }

      const { data: action } = await admin
        .from('intelligence_actions')
        .insert({
          developer_id: user.id,
          conversation_id: conversation_id ?? null,
          action_type: actionType,
          action_status: 'completed',
          description: draft.subject ?? `Approved ${draft.type} draft`,
          metadata,
        })
        .select('id')
        .single();

      if (action) {
        side_effects.intelligence_action_id = action.id;
        side_effects.communication_event_id = communicationEventId;
        if (draft.type === 'viewing_record') {
          side_effects.agent_viewing_id = action.id;
        }
      }
    } else {
      // discard
      const { data: action } = await admin
        .from('intelligence_actions')
        .insert({
          developer_id: user.id,
          conversation_id: conversation_id ?? null,
          action_type: 'draft_discarded',
          action_status: 'discarded',
          description: `Discarded ${draft.type} draft: ${draft.subject ?? draft.id}`,
          metadata: { skill, draft_id: draft.id },
        })
        .select('id')
        .single();

      if (action) {
        side_effects.intelligence_action_id = action.id;
      }
    }

    return NextResponse.json({
      status: 'ok',
      draft_id: draft.id,
      action_type:
        user_action === 'approve'
          ? draft.type === 'email'
            ? 'email_sent'
            : draft.type === 'viewing_record'
            ? 'viewing_created'
            : 'report_generated'
          : 'draft_discarded',
      side_effects,
    });
  } catch (error) {
    console.error('[confirm] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
