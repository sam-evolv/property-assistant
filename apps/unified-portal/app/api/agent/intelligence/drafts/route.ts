import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import {
  resolveRecipient,
  toDraftRecord,
  type DraftRecord,
} from '@/lib/agent-intelligence/drafts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/intelligence/drafts
 * Returns every pending_review draft for the authenticated user, newest first.
 * Also returns a `count` field so the bottom nav / sidebar badge can stay
 * live without a second round trip.
 */
export async function GET(_request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const cookieStore = cookies();
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user } } = await supabaseAuth.auth.getUser();

    const userId = user?.id || (await fallbackUserId(supabase));
    if (!userId) {
      return NextResponse.json({ drafts: [], count: 0 }, { status: 200 });
    }

    const { data: rows, error } = await supabase
      .from('pending_drafts')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending_review')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

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

async function fallbackUserId(supabase: ReturnType<typeof getSupabaseAdmin>): Promise<string | null> {
  // Mirrors the voice capture routes — dev/preview mode drops onto the first
  // agent profile so you can exercise the screen without a real session.
  const { data } = await supabase
    .from('agent_profiles')
    .select('user_id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.user_id || null;
}
