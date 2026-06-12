import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { getResendClient } from '@/lib/resend';
import { enforceTrustFloor } from '@/lib/agent-intelligence/autonomy';
import { authorizeDraftMutation } from '@/lib/agent-intelligence/draft-auth';
import { resolveSessionWorkspace } from '@/lib/agent-intelligence/workspace-resolution';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/intelligence/undo-send
 * Body: { batchId }
 *
 * Flips the draft back to pending_review, attempts to cancel the email on
 * Resend (only works within Resend's cancellation window for scheduled sends
 * — for immediate sends it surfaces that honestly rather than pretending to
 * have pulled the email back), and marks the send-history row as undone.
 */
export async function POST(request: NextRequest) {
  try {
    const { batchId } = await request.json();
    if (!batchId) {
      return NextResponse.json({ error: 'batchId required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Auth guard — same pattern as the sibling draft mutation routes
    // (send-draft, drafts/[id]): cookie-authenticated user required, then
    // each pending_drafts row is authorised before it is mutated.
    const cookieStore = cookies();
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Workspace scope, as in send-draft: cross-workspace undos 404 by design.
    const workspaceSession = await resolveSessionWorkspace(supabase, user.id, null);

    const { data: entries, error } = await supabase
      .from('recent_actions')
      .select('id, target_id, reversal_payload, status, action_type')
      .eq('approval_batch_id', batchId)
      .eq('status', 'active');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!entries || entries.length === 0) {
      return NextResponse.json({ reversed: [], notice: 'Nothing to undo' });
    }

    const reversed: string[] = [];
    let providerNotice: string | null = null;
    const trustFloorReverts: Array<{ userId: string; draftType: string }> = [];

    for (const entry of entries) {
      const payload = entry.reversal_payload as any;
      if (payload?.op !== 'restore_draft') continue;

      // Authorise against the actual draft row before mutating anything.
      // tenant-scope: authorizeDraftMutation enforces draft.user_id === user.id
      // and draft.tenant_id === the user's agent_profiles.tenant_id
      const { data: draft } = await supabase
        .from('pending_drafts')
        .select('id, user_id, tenant_id, workspace_id')
        .eq('id', payload.draftId)
        .maybeSingle();

      if (!draft) continue; // nothing to restore — skip without touching history

      const authResult = await authorizeDraftMutation(supabase, user, draft);
      if (!authResult.ok) return authResult.response;

      if (!workspaceSession || draft.workspace_id !== workspaceSession.workspaceId) {
        return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
      }

      // Best-effort provider cancellation. Resend only cancels scheduled
      // emails that haven't left yet; immediate sends cannot be recalled.
      if (entry.action_type === 'send_email' && payload.providerMessageId) {
        try {
          const { client } = await getResendClient();
          const anyClient = client as any;
          if (anyClient?.emails?.cancel) {
            await anyClient.emails.cancel(payload.providerMessageId);
          } else {
            providerNotice =
              "Email already left Resend — draft restored as pending, but the recipient may have already received it.";
          }
        } catch {
          providerNotice =
            "Email already left Resend — draft restored as pending, but the recipient may have already received it.";
        }
      }

      await supabase
        .from('pending_drafts')
        .update({
          status: payload.priorStatus || 'pending_review',
          sent_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', payload.draftId);

      let undoneHistory: { user_id: string; draft_type: string; send_mode: string } | null = null;
      if (payload.historyId) {
        const { data } = await supabase
          .from('agent_send_history')
          .update({ undone: true })
          .eq('id', payload.historyId)
          .select('user_id, draft_type, send_mode')
          .single();
        undoneHistory = data as any;
      }

      await supabase
        .from('recent_actions')
        .update({ status: 'undone', undone_at: new Date().toISOString() })
        .eq('id', entry.id);

      reversed.push(entry.id);

      // Trust-floor check: if this was an auto-send and the recent window
      // now exceeds the undo threshold, flip the preference off so the next
      // voice capture drops back to review mode.
      if (undoneHistory?.send_mode === 'auto_sent') {
        const result = await enforceTrustFloor(
          supabase,
          undoneHistory.user_id,
          undoneHistory.draft_type,
        );
        if (result.reverted) {
          trustFloorReverts.push({
            userId: undoneHistory.user_id,
            draftType: undoneHistory.draft_type,
          });
        }
      }
    }

    return NextResponse.json({ reversed, notice: providerNotice, trustFloorReverts });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
