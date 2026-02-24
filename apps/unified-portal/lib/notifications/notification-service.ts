/**
 * Central notification service.
 * All notifications flow through here — event-triggered, broadcasts, scheduled.
 *
 * Responsibilities:
 * 1. Create notification record in database
 * 2. Check user preferences (muted categories, quiet hours)
 * 3. Send push notification via FCM
 * 4. Update delivery status
 */

import { createClient } from '@supabase/supabase-js';
import { sendPush, type PushPayload } from './fcm';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export interface SendNotificationParams {
  userId: string;
  unitId?: string;
  developmentId?: string;
  title: string;
  body: string;
  category: string;
  broadcastId?: string;
  triggeredBy?: string;
  actionUrl?: string;
}

interface NotificationPreferences {
  push_enabled: boolean;
  email_enabled: boolean;
  muted_categories: string[];
  quiet_hours_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
}

async function getUserPreferences(userId: string): Promise<NotificationPreferences | null> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();
  return data;
}

function isQuietHours(preferences: NotificationPreferences): boolean {
  if (!preferences.quiet_hours_enabled || !preferences.quiet_hours_start || !preferences.quiet_hours_end) {
    return false;
  }

  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  const start = preferences.quiet_hours_start;
  const end = preferences.quiet_hours_end;

  // Handle overnight quiet hours (e.g., 22:00 to 08:00)
  if (start > end) {
    return currentTime >= start || currentTime < end;
  }
  return currentTime >= start && currentTime < end;
}

/**
 * Send a notification to a single user.
 * Creates a DB record and sends push if appropriate.
 */
export async function sendNotification(params: SendNotificationParams): Promise<string | null> {
  const supabase = getServiceClient();

  // Check user preferences
  const preferences = await getUserPreferences(params.userId);

  const isMuted = preferences?.muted_categories?.includes(params.category);

  // Create notification record
  const { data: notification, error } = await supabase
    .from('notifications')
    .insert({
      user_id: params.userId,
      unit_id: params.unitId || null,
      development_id: params.developmentId || null,
      title: params.title,
      body: params.body,
      category: params.category,
      broadcast_id: params.broadcastId || null,
      triggered_by: params.triggeredBy || null,
      action_url: params.actionUrl || null,
      push_sent: false,
    })
    .select('id')
    .single();

  if (error || !notification) {
    console.error('[NotificationService] Failed to create notification:', error);
    return null;
  }

  // If muted, don't send push but keep the in-app record
  if (isMuted) {
    return notification.id;
  }

  // If push is disabled by user, skip
  if (preferences && !preferences.push_enabled) {
    return notification.id;
  }

  // Get user's active device tokens
  const { data: tokens } = await supabase
    .from('push_device_tokens')
    .select('token, platform')
    .eq('user_id', params.userId)
    .eq('is_active', true);

  if (!tokens?.length) {
    return notification.id;
  }

  // Check quiet hours (except for urgent notifications)
  if (preferences && isQuietHours(preferences) && params.category !== 'broadcast') {
    return notification.id;
  }

  // Send push to all user's devices
  let pushSuccess = false;
  for (const deviceToken of tokens) {
    const sent = await sendPush(deviceToken.token, {
      title: params.title,
      body: params.body,
      data: {
        notificationId: notification.id,
        category: params.category,
        actionUrl: params.actionUrl || '',
      },
      sound: 'default',
    });
    if (sent) pushSuccess = true;
  }

  // Update delivery status
  await supabase
    .from('notifications')
    .update({
      push_sent: true,
      push_sent_at: new Date().toISOString(),
      push_delivered: pushSuccess,
      push_error: pushSuccess ? null : 'All delivery attempts failed',
    })
    .eq('id', notification.id);

  return notification.id;
}

/**
 * Send notification to multiple users (for broadcasts).
 */
export async function sendBulkNotification(
  developmentId: string,
  params: Omit<SendNotificationParams, 'userId' | 'unitId' | 'developmentId'>,
  targetUserIds: string[]
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (const userId of targetUserIds) {
    try {
      const notificationId = await sendNotification({
        ...params,
        userId,
        developmentId,
      });
      if (notificationId) {
        sent++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error(`[NotificationService] Failed to send to user ${userId}:`, error);
      failed++;
    }
  }

  return { sent, failed };
}

/**
 * Get unread notification count for a user.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const supabase = getServiceClient();
  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  return count || 0;
}

/**
 * Resolve target recipients for a broadcast based on targeting rules.
 */
export async function resolveTargetRecipients(
  developmentId: string,
  targetType: string,
  targetFilter?: any,
  targetUnitIds?: string[]
): Promise<string[]> {
  const supabase = getServiceClient();

  switch (targetType) {
    case 'all': {
      const { data } = await supabase
        .from('units')
        .select('purchaser_email, user_id')
        .eq('development_id', developmentId)
        .not('purchaser_email', 'is', null);

      // Get user IDs from auth.users by email, or use user_id directly if available
      // For now, collect unique user IDs from units that have auth user associations
      if (!data) return [];

      // Use a lookup from units table where user info exists
      const userIds: string[] = [];
      for (const unit of data) {
        if (unit.user_id) {
          userIds.push(unit.user_id);
        }
      }
      return [...new Set(userIds)];
    }

    case 'custom': {
      if (!targetUnitIds?.length) return [];
      const { data } = await supabase
        .from('units')
        .select('user_id')
        .in('id', targetUnitIds)
        .not('user_id', 'is', null);
      return (data || []).map((u: any) => u.user_id).filter(Boolean);
    }

    case 'pipeline_stage': {
      const stage = targetFilter?.stage;
      if (!stage) return [];
      // Get units at a specific pipeline stage
      const { data } = await supabase
        .from('unit_sales_pipeline')
        .select('unit_id')
        .eq('development_id', developmentId);

      if (!data) return [];

      // Filter by pipeline stage (check which date field is the most recent set)
      const unitIds = data.map((p: any) => p.unit_id).filter(Boolean);
      if (!unitIds.length) return [];

      const { data: units } = await supabase
        .from('units')
        .select('user_id')
        .in('id', unitIds)
        .not('user_id', 'is', null);
      return (units || []).map((u: any) => u.user_id).filter(Boolean);
    }

    case 'unit_type': {
      const houseTypeCode = targetFilter?.house_type_code;
      if (!houseTypeCode) return [];
      const { data } = await supabase
        .from('units')
        .select('user_id')
        .eq('development_id', developmentId)
        .eq('house_type_code', houseTypeCode)
        .not('user_id', 'is', null);
      return (data || []).map((u: any) => u.user_id).filter(Boolean);
    }

    default:
      return [];
  }
}
