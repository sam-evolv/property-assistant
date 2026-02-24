/**
 * POST /api/notifications/register-device
 *
 * Called from the purchaser app when:
 * - App first launches and gets push permission
 * - Token is refreshed by FCM/APNs
 *
 * Auth: purchaser token (unitUid + token)
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { deviceToken, platform, unitUid, token, endpoint, p256dh, auth_key } = body;

    if (!deviceToken || !platform) {
      return NextResponse.json({ error: 'deviceToken and platform required' }, { status: 400 });
    }

    if (!unitUid || !token) {
      return NextResponse.json({ error: 'unitUid and token required for auth' }, { status: 401 });
    }

    if (!['ios', 'android', 'web'].includes(platform)) {
      return NextResponse.json({ error: 'platform must be ios, android, or web' }, { status: 400 });
    }

    // Validate purchaser token
    const tokenResult = await validatePurchaserToken(token, unitUid);
    if (!tokenResult.valid) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Get unit info for development context
    const { data: unit } = await supabase
      .from('units')
      .select('id, project_id')
      .eq('id', unitUid)
      .single();

    // Generate a deterministic user_id from unitUid for device token storage
    // Since purchasers don't have auth.users accounts, we use the unit ID as user reference
    const userId = unitUid;

    // Upsert token (update if exists, create if new)
    const { error } = await supabase
      .from('push_device_tokens')
      .upsert(
        {
          user_id: userId,
          unit_id: unit?.id || unitUid,
          development_id: unit?.project_id || null,
          platform,
          token: deviceToken,
          endpoint: endpoint || null,
          p256dh: p256dh || null,
          auth_key: auth_key || null,
          is_active: true,
          last_used_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,token' }
      );

    if (error) {
      console.error('[RegisterDevice] Failed to register device:', error);
      return NextResponse.json({ error: 'Failed to register device' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[RegisterDevice] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
