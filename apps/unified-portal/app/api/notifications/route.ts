/**
 * Notifications API for purchaser app
 *
 * GET /api/notifications — List user's notifications (paginated)
 * PATCH /api/notifications — Mark notifications as read
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
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const unreadOnly = searchParams.get('unread') === 'true';

    if (!unitUid || !token) {
      return NextResponse.json({ error: 'unitUid and token required' }, { status: 401 });
    }

    const tokenResult = await validatePurchaserToken(token, unitUid);
    if (!tokenResult.valid) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Get unit info to find development_id
    const { data: unit } = await supabase
      .from('units')
      .select('id, project_id')
      .eq('id', unitUid)
      .single();

    if (!unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    // Fetch notifications for this unit/user
    let query = supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .or(`user_id.eq.${unitUid},and(development_id.eq.${unit.project_id},category.eq.broadcast)`)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (unreadOnly) {
      query = query.eq('is_read', false);
    }

    const { data, count, error } = await query;

    if (error) {
      console.error('[Notifications GET] Error:', error);
      return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
    }

    // Get unread count
    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', unitUid)
      .eq('is_read', false);

    return NextResponse.json({
      notifications: data || [],
      total: count || 0,
      page,
      unread_count: unreadCount || 0,
    });
  } catch (error) {
    console.error('[Notifications GET] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, unitUid, notification_ids, mark_all_read } = body;

    if (!unitUid || !token) {
      return NextResponse.json({ error: 'unitUid and token required' }, { status: 401 });
    }

    const tokenResult = await validatePurchaserToken(token, unitUid);
    if (!tokenResult.valid) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    if (mark_all_read) {
      await supabase
        .from('notifications')
        .update({ is_read: true, read_at: now })
        .eq('user_id', unitUid)
        .eq('is_read', false);
    } else if (notification_ids?.length) {
      await supabase
        .from('notifications')
        .update({ is_read: true, read_at: now })
        .eq('user_id', unitUid)
        .in('id', notification_ids);
    }

    // Update broadcast read counts
    if (mark_all_read || notification_ids?.length) {
      // Increment read_count on any associated broadcasts
      const { data: readNotifications } = await supabase
        .from('notifications')
        .select('broadcast_id')
        .eq('user_id', unitUid)
        .eq('is_read', true)
        .not('broadcast_id', 'is', null);

      if (readNotifications) {
        const broadcastIds = [...new Set(readNotifications.map(n => n.broadcast_id).filter(Boolean))];
        for (const broadcastId of broadcastIds) {
          const { count } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('broadcast_id', broadcastId)
            .eq('is_read', true);

          await supabase
            .from('broadcasts')
            .update({ read_count: count || 0 })
            .eq('id', broadcastId);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Notifications PATCH] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
