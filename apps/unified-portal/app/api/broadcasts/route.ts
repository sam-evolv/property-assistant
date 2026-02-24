/**
 * Broadcasts API
 *
 * GET /api/broadcasts — List broadcasts for a development (developer auth)
 * POST /api/broadcasts — Create and send a broadcast (developer auth)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';
import { sendBulkNotification, resolveTargetRecipients } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const tenantId = session.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const developmentId = searchParams.get('developmentId');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('broadcasts')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (developmentId) {
      query = query.eq('development_id', developmentId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, count, error } = await query;

    if (error) {
      console.error('[Broadcasts GET] Error:', error);
      return NextResponse.json({ error: 'Failed to fetch broadcasts' }, { status: 500 });
    }

    return NextResponse.json({
      broadcasts: data || [],
      total: count || 0,
      page,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('[Broadcasts GET] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const tenantId = session.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    const body = await request.json();
    const {
      development_id,
      title,
      body: messageBody,
      category,
      target_type,
      target_filter,
      target_unit_ids,
      scheduled_for,
      attachment_url,
      attachment_name,
    } = body;

    if (!development_id || !title || !messageBody) {
      return NextResponse.json(
        { error: 'development_id, title, and body are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Resolve recipients
    const recipientUserIds = await resolveTargetRecipients(
      development_id,
      target_type || 'all',
      target_filter,
      target_unit_ids
    );

    // Create broadcast record
    const { data: broadcast, error } = await supabase
      .from('broadcasts')
      .insert({
        tenant_id: tenantId,
        created_by: session.id,
        development_id,
        title,
        body: messageBody,
        category: category || 'community',
        target_type: target_type || 'all',
        target_filter: target_filter || null,
        target_unit_ids: target_unit_ids || null,
        scheduled_for: scheduled_for || null,
        attachment_url: attachment_url || null,
        attachment_name: attachment_name || null,
        status: scheduled_for ? 'scheduled' : 'sending',
        recipients_count: recipientUserIds.length,
      })
      .select()
      .single();

    if (error || !broadcast) {
      console.error('[Broadcasts POST] Error creating broadcast:', error);
      return NextResponse.json({ error: 'Failed to create broadcast' }, { status: 500 });
    }

    // If immediate send (not scheduled), send asynchronously
    if (!scheduled_for) {
      // Fire and forget — don't block the response
      sendBroadcastNotifications(
        broadcast.id,
        development_id,
        recipientUserIds,
        title,
        messageBody,
        category || 'community'
      );
    }

    return NextResponse.json({
      broadcast,
      recipients: recipientUserIds.length,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('[Broadcasts POST] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Send broadcast notifications asynchronously
 */
async function sendBroadcastNotifications(
  broadcastId: string,
  developmentId: string,
  recipientUserIds: string[],
  title: string,
  messageBody: string,
  category: string
) {
  const supabase = getSupabaseAdmin();

  try {
    const { sent, failed } = await sendBulkNotification(
      developmentId,
      {
        title,
        body: messageBody,
        category: 'broadcast',
        broadcastId,
        triggeredBy: `broadcast.${category}`,
        actionUrl: `/notifications/${broadcastId}`,
      },
      recipientUserIds
    );

    await supabase
      .from('broadcasts')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        delivered_count: sent,
        updated_at: new Date().toISOString(),
      })
      .eq('id', broadcastId);

    console.log(`[Broadcasts] Sent broadcast ${broadcastId}: ${sent} delivered, ${failed} failed`);
  } catch (error) {
    console.error(`[Broadcasts] Failed to send broadcast ${broadcastId}:`, error);

    await supabase
      .from('broadcasts')
      .update({
        status: 'failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', broadcastId);
  }
}
