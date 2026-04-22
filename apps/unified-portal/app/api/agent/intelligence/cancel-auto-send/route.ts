import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/intelligence/cancel-auto-send
 * Body: { draftId }
 *
 * Called when the user hits Cancel during the 10-second auto-send window.
 * Flips the draft from auto_sending back to pending_review so it drops
 * into the Drafts inbox. Also records a lightweight send-history row with
 * send_mode = 'auto_cancelled_pre_send' so Session 3's telemetry reflects
 * the cancellation (it is not an undo — nothing was ever sent).
 */
export async function POST(request: NextRequest) {
  try {
    const { draftId } = await request.json();
    if (!draftId) return NextResponse.json({ error: 'draftId required' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const cookieStore = cookies();
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user } } = await supabaseAuth.auth.getUser();

    const { data: draft } = await supabase
      .from('pending_drafts')
      .select('*')
      .eq('id', draftId)
      .maybeSingle();

    if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    if (user && draft.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (draft.status !== 'auto_sending') {
      return NextResponse.json({ error: `Draft is in status "${draft.status}"` }, { status: 409 });
    }

    await supabase
      .from('pending_drafts')
      .update({ status: 'pending_review', updated_at: new Date().toISOString() })
      .eq('id', draftId);

    // Telemetry: this is a cancelled auto-send, not a sent row. Recorded so
    // the autonomy analytics can distinguish "held by user" from "held by
    // confidence / active hours / trust floor".
    await supabase.from('agent_send_history').insert({
      user_id: draft.user_id,
      tenant_id: draft.tenant_id,
      draft_id: draft.id,
      draft_type: draft.draft_type,
      recipient_id: draft.recipient_id,
      sent_at: new Date().toISOString(),
      was_edited_before_send: false,
      undone: false,
      send_method: draft.send_method,
      send_mode: 'auto_cancelled_pre_send',
    });

    return NextResponse.json({ cancelled: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
