import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, getSupabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
    const side_effects: Record<string, string> = {};

    if (user_action === 'approve') {
      const actionType =
        draft.type === 'email'
          ? 'email_sent'
          : draft.type === 'viewing_record'
          ? 'viewing_created'
          : 'report_generated';

      const { data: action } = await admin
        .from('intelligence_actions')
        .insert({
          developer_id: user.id,
          conversation_id: conversation_id ?? null,
          action_type: actionType,
          action_status: 'completed',
          description: draft.subject ?? `Approved ${draft.type} draft`,
          metadata: { skill, draft_id: draft.id, draft },
        })
        .select('id')
        .single();

      if (action) {
        if (draft.type === 'email') {
          side_effects.communication_event_id = action.id;
        } else if (draft.type === 'viewing_record') {
          side_effects.agent_viewing_id = action.id;
        }
      }
    } else {
      await admin.from('intelligence_actions').insert({
        developer_id: user.id,
        conversation_id: conversation_id ?? null,
        action_type: 'draft_discarded',
        action_status: 'discarded',
        description: `Discarded ${draft.type} draft: ${draft.subject ?? draft.id}`,
        metadata: { skill, draft_id: draft.id },
      });
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
