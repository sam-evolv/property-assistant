import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import {
  resolveRecipient,
  toDraftRecord,
  type DraftRecord,
} from '@/lib/agent-intelligence/drafts';
import {
  resolveSessionWorkspace,
  assertDraftWorkspace,
  type WorkspaceMode,
} from '@/lib/agent-intelligence/workspace-resolution';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/intelligence/drafts
 * Returns every pending_review draft for the authenticated user's active
 * workspace, newest first. Also returns a `count` field so the bottom nav /
 * sidebar badge can stay live without a second round trip.
 *
 * Workspace isolation:
 *   - The query filters on workspace_id only. The historical filter by
 *     draft_type is gone — it was the source of the Bridge Property
 *     Group bleed (buyer_followup drafts surfaced in both sales and
 *     lettings inboxes because the type appeared in both filters).
 *   - A server-side tripwire asserts every returned row's workspace_id
 *     matches the resolved session workspace. Any mismatch throws — this
 *     is defence-in-depth against a regression in the SQL filter or RLS
 *     policy, not a silent filter.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const cookieStore = cookies();
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user } } = await supabaseAuth.auth.getUser();

    if (!user?.id) {
      // No auth → no drafts. The earlier `fallbackUserId` heuristic that
      // dropped onto the first agent profile in dev mode is gone — it
      // was a per-user data leak waiting to happen the moment the
      // codepath landed in production.
      return NextResponse.json({ drafts: [], count: 0 }, { status: 200 });
    }

    const modeParam = request.nextUrl.searchParams.get('mode');
    const modeHint: WorkspaceMode | null =
      modeParam === 'sales' || modeParam === 'lettings' ? modeParam : null;

    const session = await resolveSessionWorkspace(supabase, user.id, modeHint);
    if (!session) {
      return NextResponse.json({ drafts: [], count: 0 }, { status: 200 });
    }

    const { data: rows, error } = await supabase
      .from('pending_drafts')
      .select('*')
      .eq('workspace_id', session.workspaceId)
      .eq('status', 'pending_review')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Tripwire — every row MUST already match the session workspace. If
    // the SQL filter regresses (or RLS leaks rows the application layer
    // depended on it to hide), this throws instead of silently filtering.
    assertDraftWorkspace(rows || [], session.workspaceId);

    const drafts: DraftRecord[] = [];
    for (const row of rows || []) {
      const recipient = await resolveRecipient(supabase, row.draft_type, row.recipient_id);
      drafts.push(toDraftRecord(row, recipient));
    }

    return NextResponse.json({ drafts, count: drafts.length });
  } catch (error: any) {
    console.error('[agent/intelligence/drafts GET] Error:', error.message);
    return NextResponse.json(
      { error: 'Failed to list drafts', details: error.message },
      { status: 500 }
    );
  }
}
