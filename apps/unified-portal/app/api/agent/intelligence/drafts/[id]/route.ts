import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import {
  resolveRecipient,
  toDraftRecord,
} from '@/lib/agent-intelligence/drafts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/intelligence/drafts/:id
 * Returns the full draft (subject, body, recipient, context chips).
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = getSupabaseAdmin();
    const { data: row, error } = await supabase
      .from('pending_drafts')
      .select('*')
      .eq('id', params.id)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const recipient = await resolveRecipient(supabase, row.draft_type, row.recipient_id);
    return NextResponse.json({ draft: toDraftRecord(row, recipient) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PATCH /api/agent/intelligence/drafts/:id
 * Body: { subject?, body?, sendMethod?, recipientId? }
 * Saves edits back into content_json. Any save implicitly means the user
 * touched the draft — the send route reads this flag off a later diff rather
 * than tracking it here, to keep this route dumb.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const supabase = getSupabaseAdmin();
    const cookieStore = cookies();
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user } } = await supabaseAuth.auth.getUser();

    const { data: existing, error: getErr } = await supabase
      .from('pending_drafts')
      .select('*')
      .eq('id', params.id)
      .maybeSingle();

    if (getErr) return NextResponse.json({ error: getErr.message }, { status: 500 });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (user && existing.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const nextContent = { ...(existing.content_json || {}) };
    if (typeof body.subject === 'string') nextContent.subject = body.subject;
    if (typeof body.body === 'string') nextContent.body = body.body;

    const updates: Record<string, any> = {
      content_json: nextContent,
      updated_at: new Date().toISOString(),
    };
    if (body.sendMethod) updates.send_method = body.sendMethod;
    if (typeof body.recipientId === 'string') updates.recipient_id = body.recipientId;

    const { data: updated, error: updErr } = await supabase
      .from('pending_drafts')
      .update(updates)
      .eq('id', params.id)
      .select('*')
      .single();

    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    const recipient = await resolveRecipient(supabase, updated.draft_type, updated.recipient_id);
    return NextResponse.json({ draft: toDraftRecord(updated, recipient) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/agent/intelligence/drafts/:id
 * Hard-deletes — drafts are disposable by design. The recent_actions row from
 * Session 1 is removed too so the Session 1 undo pill can't resurrect a draft
 * the user explicitly discarded.
 */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = getSupabaseAdmin();
    const cookieStore = cookies();
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user } } = await supabaseAuth.auth.getUser();

    const { data: existing } = await supabase
      .from('pending_drafts')
      .select('user_id')
      .eq('id', params.id)
      .maybeSingle();

    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (user && existing.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await supabase
      .from('recent_actions')
      .delete()
      .eq('target_table', 'pending_drafts')
      .eq('target_id', params.id);

    const { error } = await supabase.from('pending_drafts').delete().eq('id', params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
