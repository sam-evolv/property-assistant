import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import {
  resolveRecipient,
  toDraftRecord,
} from '@/lib/agent-intelligence/drafts';
import { authorizeDraftMutation } from '@/lib/agent-intelligence/draft-auth';
import { resolveSessionWorkspace } from '@/lib/agent-intelligence/workspace-resolution';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/intelligence/drafts/:id
 *
 * Returns the full draft. Workspace-scoped: a Sales draft is invisible to
 * a Lettings session (and vice versa) — the route returns 404 rather than
 * the draft so direct URL navigation can't reveal a draft from the other
 * workspace.
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = getSupabaseAdmin();
    const cookieStore = cookies();
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user } } = await supabaseAuth.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const session = await resolveSessionWorkspace(supabase, user.id, null);
    if (!session) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { data: row, error } = await supabase
      .from('pending_drafts')
      .select('*')
      .eq('id', params.id)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Cross-workspace fetches return 404 — not 403, not the draft. The
    // existence of a draft id is itself information a different workspace
    // shouldn't be able to confirm.
    if (row.workspace_id !== session.workspaceId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const recipient = await resolveRecipient(supabase, row.draft_type, row.recipient_id);
    return NextResponse.json({ draft: toDraftRecord(row, recipient) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PATCH /api/agent/intelligence/drafts/:id
 * Body: { subject?, body?, sendMethod?, recipientId? }
 *
 * Cross-workspace mutations return 404 by design — the route refuses to
 * acknowledge a draft from a different workspace.
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

    const authResult = await authorizeDraftMutation(supabase, user, existing);
    if (!authResult.ok) return authResult.response;

    // Workspace scope check — defense beyond the user/tenant check.
    if (user?.id) {
      const session = await resolveSessionWorkspace(supabase, user.id, null);
      if (!session || existing.workspace_id !== session.workspaceId) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
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
 *
 * Cross-workspace deletes return 404. Same reasoning as GET — confirming
 * a draft id from another workspace is itself a leak.
 */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = getSupabaseAdmin();
    const cookieStore = cookies();
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user } } = await supabaseAuth.auth.getUser();

    const { data: existing } = await supabase
      .from('pending_drafts')
      .select('user_id, tenant_id, workspace_id')
      .eq('id', params.id)
      .maybeSingle();

    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const authResult = await authorizeDraftMutation(supabase, user, existing);
    if (!authResult.ok) return authResult.response;

    if (user?.id) {
      const session = await resolveSessionWorkspace(supabase, user.id, null);
      if (!session || existing.workspace_id !== session.workspaceId) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
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
