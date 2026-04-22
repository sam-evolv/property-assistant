import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import {
  computeEligibility,
  loadAutonomyPreferences,
  GLOBAL_PAUSE_DRAFT_TYPE,
  type DraftTypeStats,
  type SendHistoryRow,
} from '@/lib/agent-intelligence/autonomy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/intelligence/track-record
 * Returns per-draft-type stats for the authenticated user, including
 * eligibility flags + current auto_send_enabled state. The autonomy
 * settings screen + the voice confirmation card both consume this.
 */
export async function GET(_request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const cookieStore = cookies();
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user } } = await supabaseAuth.auth.getUser();

    const userId = user?.id || (await fallbackUserId(supabase));
    if (!userId) {
      return NextResponse.json({ draftTypes: [], globalPaused: false });
    }

    const [{ data: historyRows }, prefs] = await Promise.all([
      supabase
        .from('agent_send_history')
        .select('id, user_id, draft_type, was_edited_before_send, undone, sent_at, send_mode')
        .eq('user_id', userId),
      loadAutonomyPreferences(supabase, userId),
    ]);

    const byType = new Map<string, SendHistoryRow[]>();
    for (const r of (historyRows || []) as SendHistoryRow[]) {
      if (!byType.has(r.draft_type)) byType.set(r.draft_type, []);
      byType.get(r.draft_type)!.push(r);
    }

    // Surface any preference rows the user has even if they haven't sent
    // anything of that type yet, so the settings screen stays honest.
    for (const draftType of Object.keys(prefs.byDraftType)) {
      if (draftType === GLOBAL_PAUSE_DRAFT_TYPE) continue;
      if (!byType.has(draftType)) byType.set(draftType, []);
    }

    const draftTypes: DraftTypeStats[] = [];
    for (const [draftType, rows] of byType) {
      const base = computeEligibility(draftType, rows);
      const pref = prefs.byDraftType[draftType] || {
        autoSendEnabled: false,
        offeredAt: null,
        offerDismissedCount: 0,
      };
      draftTypes.push({
        ...base,
        autoSendEnabled: pref.autoSendEnabled,
        offeredAt: pref.offeredAt,
        offerDismissedCount: pref.offerDismissedCount,
      });
    }

    draftTypes.sort((a, b) => b.totalSent - a.totalSent);

    return NextResponse.json({
      draftTypes,
      globalPaused: prefs.globalPaused,
    });
  } catch (error: any) {
    console.error('[agent/intelligence/track-record] Error:', error.message);
    return NextResponse.json(
      { error: 'Failed to compute track record', details: error.message },
      { status: 500 }
    );
  }
}

async function fallbackUserId(supabase: ReturnType<typeof getSupabaseAdmin>): Promise<string | null> {
  const { data } = await supabase
    .from('agent_profiles')
    .select('user_id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.user_id || null;
}
