/**
 * Integration Audit Logging
 *
 * Records all integration-related activity for compliance and debugging.
 *
 * Common audit events:
 * - integration.created, integration.updated, integration.disconnected
 * - sync.started, sync.completed, sync.failed
 * - sync.field_updated (with old/new values)
 * - conflict.created, conflict.resolved
 * - api.authenticated, api.request
 * - token.refreshed, token.refresh_failed
 * - webhook.delivered, webhook.failed
 * - api_key.created, api_key.revoked
 */

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export type AuditActorType = 'user' | 'system' | 'api_key' | 'webhook';

export interface AuditLogEntry {
  tenant_id: string;
  action: string;
  actor_type: AuditActorType;
  actor_id?: string;
  resource_type?: string;
  resource_id?: string;
  metadata?: Record<string, any>;
  ip_address?: string;
}

export async function logAudit(
  tenantId: string,
  action: string,
  actorType: AuditActorType,
  metadata: Record<string, any> = {},
  request?: NextRequest
): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();

    await supabase.from('integration_audit_log').insert({
      tenant_id: tenantId,
      action,
      actor_type: actorType,
      actor_id: metadata.actor_id || (actorType === 'system' ? 'system' : undefined),
      resource_type: metadata.resource_type,
      resource_id: metadata.resource_id,
      metadata,
      ip_address: request?.headers.get('x-forwarded-for') || null,
    });
  } catch (error) {
    // Audit logging should never break the main flow
    console.error('[Audit] Failed to write audit log:', error);
  }
}

export async function getAuditLogs(
  tenantId: string,
  options: {
    limit?: number;
    offset?: number;
    action?: string;
    resourceType?: string;
    resourceId?: string;
  } = {}
) {
  const supabase = getSupabaseAdmin();
  const { limit = 50, offset = 0, action, resourceType, resourceId } = options;

  let query = supabase
    .from('integration_audit_log')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (action) query = query.eq('action', action);
  if (resourceType) query = query.eq('resource_type', resourceType);
  if (resourceId) query = query.eq('resource_id', resourceId);

  const { data, error } = await query;

  if (error) {
    console.error('[Audit] Failed to fetch audit logs:', error);
    throw error;
  }

  return data || [];
}
