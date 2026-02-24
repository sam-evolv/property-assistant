/**
 * Webhook Dispatcher
 *
 * Dispatches events to subscribed webhooks with HMAC signature verification,
 * delivery tracking, and exponential backoff retries.
 *
 * Events:
 * - unit.created, unit.updated
 * - pipeline.stage_changed
 * - purchaser.registered, purchaser.question_asked
 * - document.uploaded, document.accessed
 * - compliance.status_changed
 * - message.received (AI assistant interaction)
 */

import { createHmac } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { logAudit } from './security/audit';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface Webhook {
  id: string;
  tenant_id: string;
  url: string;
  secret: string;
  events: string[];
  development_ids: string[] | null;
  is_active: boolean;
  consecutive_failures: number;
  max_failures: number;
}

interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: any;
  status: string;
  attempt_number: number;
}

async function createWebhookDelivery(
  webhookId: string,
  eventType: string,
  payload: Record<string, any>
): Promise<WebhookDelivery> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('webhook_deliveries')
    .insert({
      webhook_id: webhookId,
      event_type: eventType,
      payload,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function updateDeliveryStatus(
  deliveryId: string,
  status: 'delivered' | 'failed',
  httpStatus: number | null,
  responseBody: string | null
) {
  const supabase = getSupabaseAdmin();

  await supabase
    .from('webhook_deliveries')
    .update({
      status,
      http_status: httpStatus,
      response_body: responseBody?.slice(0, 1000), // Truncate response
    })
    .eq('id', deliveryId);
}

async function incrementWebhookFailures(webhookId: string, reason: string) {
  const supabase = getSupabaseAdmin();

  const { data: webhook } = await supabase
    .from('webhooks')
    .select('consecutive_failures, max_failures')
    .eq('id', webhookId)
    .single();

  if (!webhook) return;

  const newFailures = (webhook.consecutive_failures || 0) + 1;
  const shouldDisable = newFailures >= webhook.max_failures;

  await supabase
    .from('webhooks')
    .update({
      consecutive_failures: newFailures,
      last_failure_reason: reason,
      ...(shouldDisable ? { is_active: false } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', webhookId);
}

async function resetWebhookFailures(webhookId: string) {
  const supabase = getSupabaseAdmin();

  await supabase
    .from('webhooks')
    .update({
      consecutive_failures: 0,
      last_failure_reason: null,
      last_triggered_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', webhookId);
}

async function scheduleRetry(deliveryId: string, delaySeconds: number) {
  const supabase = getSupabaseAdmin();

  await supabase
    .from('webhook_deliveries')
    .update({
      next_retry_at: new Date(Date.now() + delaySeconds * 1000).toISOString(),
    })
    .eq('id', deliveryId);
}

async function deliverWebhook(
  webhook: Webhook,
  delivery: WebhookDelivery,
  eventType: string,
  payload: Record<string, any>
) {
  const body = JSON.stringify({
    event: eventType,
    timestamp: new Date().toISOString(),
    data: payload,
  });

  // HMAC signature for verification
  const signature = createHmac('sha256', webhook.secret)
    .update(body)
    .digest('hex');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-OpenHouse-Signature': `sha256=${signature}`,
        'X-OpenHouse-Event': eventType,
        'X-OpenHouse-Delivery': delivery.id,
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const responseText = await response.text().catch(() => '');

    await updateDeliveryStatus(
      delivery.id,
      response.ok ? 'delivered' : 'failed',
      response.status,
      responseText
    );

    if (!response.ok) {
      await incrementWebhookFailures(webhook.id, `HTTP ${response.status}`);
    } else {
      await resetWebhookFailures(webhook.id);
    }

    await logAudit(webhook.tenant_id, response.ok ? 'webhook.delivered' : 'webhook.failed', 'webhook', {
      webhook_id: webhook.id,
      delivery_id: delivery.id,
      event_type: eventType,
      http_status: response.status,
    });
  } catch (error: any) {
    await updateDeliveryStatus(delivery.id, 'failed', null, error.message);
    await incrementWebhookFailures(webhook.id, error.message);

    // Schedule retry with exponential backoff (max 1 hour)
    const retryDelay = Math.min(2 ** delivery.attempt_number * 60, 3600);
    await scheduleRetry(delivery.id, retryDelay);

    await logAudit(webhook.tenant_id, 'webhook.failed', 'webhook', {
      webhook_id: webhook.id,
      delivery_id: delivery.id,
      event_type: eventType,
      error: error.message,
    });
  }
}

/**
 * Dispatch an event to all subscribed webhooks for a tenant.
 */
export async function dispatchWebhookEvent(
  tenantId: string,
  eventType: string,
  payload: Record<string, any>
) {
  const supabase = getSupabaseAdmin();

  // Find all active webhooks subscribed to this event
  const { data: webhooks } = await supabase
    .from('webhooks')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .contains('events', [eventType]);

  if (!webhooks?.length) return;

  for (const webhook of webhooks) {
    // Filter by development if specified
    if (webhook.development_ids?.length && payload.development_id) {
      if (!webhook.development_ids.includes(payload.development_id)) continue;
    }

    // Create delivery record and dispatch asynchronously
    const delivery = await createWebhookDelivery(webhook.id, eventType, payload);
    deliverWebhook(webhook, delivery, eventType, payload).catch(console.error);
  }
}

/**
 * Retry pending webhook deliveries (called by cron job).
 */
export async function retryPendingDeliveries() {
  const supabase = getSupabaseAdmin();

  const { data: pending } = await supabase
    .from('webhook_deliveries')
    .select('*, webhooks(*)')
    .eq('status', 'pending')
    .lte('next_retry_at', new Date().toISOString())
    .limit(50);

  if (!pending?.length) return;

  for (const delivery of pending) {
    if (!delivery.webhooks) continue;

    // Increment attempt number
    await supabase
      .from('webhook_deliveries')
      .update({ attempt_number: delivery.attempt_number + 1 })
      .eq('id', delivery.id);

    await deliverWebhook(
      delivery.webhooks as Webhook,
      delivery,
      delivery.event_type,
      delivery.payload
    );
  }
}
