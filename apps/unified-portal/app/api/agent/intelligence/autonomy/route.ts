import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import {
  GLOBAL_PAUSE_DRAFT_TYPE,
  isStatutoryDraftType,
  loadAutonomyPreferences,
} from '@/lib/agent-intelligence/autonomy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveUserId(): Promise<string | null> {
  const cookieStore = cookies();
  const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (user?.id) return user.id;

  // Dev/preview fallback, mirrors drafts route behaviour.
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from('agent_profiles')
    .select('user_id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.user_id || null;
}

/**
 * GET /api/agent/intelligence/autonomy
 * Returns the full preferences map + global pause flag.
 */
export async function GET(_request: NextRequest) {
  try {
    const userId = await resolveUserId();
    if (!userId) return NextResponse.json({ preferences: {}, globalPaused: false });

    const supabase = getSupabaseAdmin();
    const { byDraftType, globalPaused } = await loadAutonomyPreferences(supabase, userId);
    return NextResponse.json({ preferences: byDraftType, globalPaused });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PATCH /api/agent/intelligence/autonomy
 * Body: { draftType: string, autoSendEnabled: boolean }
 *       or { globalPaused: boolean }
 *
 * Toggling on a statutory type is silently refused at the API layer — UI
 * should render the row as non-interactive but we defend the same rule here.
 */
export async function PATCH(request: NextRequest) {
  try {
    const userId = await resolveUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    if (typeof body?.globalPaused === 'boolean') {
      await supabase
        .from('agent_autonomy_preferences')
        .upsert(
          {
            user_id: userId,
            draft_type: GLOBAL_PAUSE_DRAFT_TYPE,
            auto_send_enabled: body.globalPaused,
            enabled_at: body.globalPaused ? now : null,
            disabled_at: body.globalPaused ? null : now,
            updated_at: now,
          },
          { onConflict: 'user_id,draft_type' },
        );
      return NextResponse.json({ globalPaused: body.globalPaused });
    }

    const draftType: string | undefined = body?.draftType;
    const autoSendEnabled: boolean | undefined = body?.autoSendEnabled;
    if (!draftType || typeof autoSendEnabled !== 'boolean') {
      return NextResponse.json({ error: 'draftType + autoSendEnabled required' }, { status: 400 });
    }

    if (autoSendEnabled && isStatutoryDraftType(draftType)) {
      return NextResponse.json(
        { error: 'Statutory draft types cannot be auto-sent' },
        { status: 403 },
      );
    }

    await supabase
      .from('agent_autonomy_preferences')
      .upsert(
        {
          user_id: userId,
          draft_type: draftType,
          auto_send_enabled: autoSendEnabled,
          enabled_at: autoSendEnabled ? now : null,
          disabled_at: autoSendEnabled ? null : now,
          updated_at: now,
        },
        { onConflict: 'user_id,draft_type' },
      );

    return NextResponse.json({ draftType, autoSendEnabled });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/agent/intelligence/autonomy
 * Body: { action: 'dismiss_offer', draftType }
 * Records the dismissal so the offer respects the 30-day / +10-sends cooldown.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await resolveUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const supabase = getSupabaseAdmin();

    if (body?.action !== 'dismiss_offer' || !body?.draftType) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { data: existing } = await supabase
      .from('agent_autonomy_preferences')
      .select('offer_dismissed_count')
      .eq('user_id', userId)
      .eq('draft_type', body.draftType)
      .maybeSingle();

    const nextCount = (existing?.offer_dismissed_count || 0) + 1;

    await supabase
      .from('agent_autonomy_preferences')
      .upsert(
        {
          user_id: userId,
          draft_type: body.draftType,
          auto_send_enabled: false,
          offered_at: now,
          offer_dismissed_count: nextCount,
          updated_at: now,
        },
        { onConflict: 'user_id,draft_type' },
      );

    return NextResponse.json({ dismissed: true, dismissCount: nextCount });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
