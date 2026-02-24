/**
 * Notification Preferences API for purchaser app
 *
 * GET /api/notifications/preferences — Get user's notification preferences
 * PUT /api/notifications/preferences — Update preferences
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validatePurchaserToken } from '@openhouse/api/qr-tokens';

export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const unitUid = searchParams.get('unitUid');

    if (!unitUid || !token) {
      return NextResponse.json({ error: 'unitUid and token required' }, { status: 401 });
    }

    const tokenResult = await validatePurchaserToken(token, unitUid);
    if (!tokenResult.valid) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', unitUid)
      .single();

    // Return defaults if no preferences exist yet
    const preferences = data || {
      push_enabled: true,
      email_enabled: false,
      muted_categories: [],
      quiet_hours_enabled: false,
      quiet_hours_start: null,
      quiet_hours_end: null,
    };

    return NextResponse.json({ preferences });
  } catch (error) {
    console.error('[NotificationPreferences GET] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, unitUid, push_enabled, email_enabled, muted_categories, quiet_hours_enabled, quiet_hours_start, quiet_hours_end } = body;

    if (!unitUid || !token) {
      return NextResponse.json({ error: 'unitUid and token required' }, { status: 401 });
    }

    const tokenResult = await validatePurchaserToken(token, unitUid);
    if (!tokenResult.valid) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('notification_preferences')
      .upsert(
        {
          user_id: unitUid,
          push_enabled: push_enabled ?? true,
          email_enabled: email_enabled ?? false,
          muted_categories: muted_categories || [],
          quiet_hours_enabled: quiet_hours_enabled ?? false,
          quiet_hours_start: quiet_hours_start || null,
          quiet_hours_end: quiet_hours_end || null,
          updated_at: now,
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error('[NotificationPreferences PUT] Error:', error);
      return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[NotificationPreferences PUT] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
