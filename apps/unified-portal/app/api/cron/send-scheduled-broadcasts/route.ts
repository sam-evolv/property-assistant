// Cron job: Send Scheduled Broadcasts
// Runs daily to check for scheduled broadcasts.
// GET /api/cron/send-scheduled-broadcasts
// vercel.json: { "path": "/api/cron/send-scheduled-broadcasts", "schedule": "0 0 * * *" }

import { NextRequest, NextResponse } from 'next/server';
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
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  // Find broadcasts that are scheduled and due
  const { data: broadcasts, error } = await supabase
    .from('broadcasts')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_for', new Date().toISOString());

  if (error) {
    console.error('[CronBroadcasts] Error fetching scheduled broadcasts:', error);
    return NextResponse.json({ error: 'Failed to fetch broadcasts' }, { status: 500 });
  }

  let processed = 0;

  for (const broadcast of broadcasts || []) {
    try {
      // Resolve recipients
      const recipientUserIds = await resolveTargetRecipients(
        broadcast.development_id,
        broadcast.target_type,
        broadcast.target_filter,
        broadcast.target_unit_ids
      );

      // Mark as sending
      await supabase
        .from('broadcasts')
        .update({ status: 'sending', updated_at: new Date().toISOString() })
        .eq('id', broadcast.id);

      // Send notifications
      const { sent } = await sendBulkNotification(
        broadcast.development_id,
        {
          title: broadcast.title,
          body: broadcast.body,
          category: 'broadcast',
          broadcastId: broadcast.id,
          triggeredBy: `broadcast.${broadcast.category}`,
          actionUrl: `/notifications/${broadcast.id}`,
        },
        recipientUserIds
      );

      // Mark as sent
      await supabase
        .from('broadcasts')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          delivered_count: sent,
          updated_at: new Date().toISOString(),
        })
        .eq('id', broadcast.id);

      processed++;
      console.log(`[CronBroadcasts] Sent broadcast ${broadcast.id}: ${sent} delivered`);
    } catch (err) {
      console.error(`[CronBroadcasts] Failed broadcast ${broadcast.id}:`, err);

      await supabase
        .from('broadcasts')
        .update({
          status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', broadcast.id);
    }
  }

  return NextResponse.json({ processed });
}
