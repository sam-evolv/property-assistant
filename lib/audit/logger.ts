import { db } from '@openhouse/db/client';
import { sql } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { TenancyContext } from '../tenancy-context';

export type AuditEventType =
  | 'document_upload'
  | 'document_delete'
  | 'training_job_trigger'
  | 'training_job_complete'
  | 'developer_create'
  | 'developer_delete'
  | 'role_change'
  | 'impersonation_start'
  | 'impersonation_end'
  | 'theme_change'
  | 'qr_generation'
  | 'data_export'
  | 'admin_action'
  | 'tenant_create'
  | 'tenant_delete'
  | 'development_create'
  | 'development_delete'
  | 'homeowner_create'
  | 'homeowner_delete'
  | 'login_success'
  | 'login_failure'
  | 'password_reset'
  | 'session_revoke';

export interface AuditEventMetadata {
  actor_id: string;
  actor_email: string;
  actor_role: string;
  tenant_id: string;
  development_id?: string;
  ip_address?: string;
  user_agent?: string;
  endpoint?: string;
  resource_type?: string;
  resource_id?: string;
  previous_value?: any;
  new_value?: any;
  metadata?: Record<string, any>;
}

export async function logAuditEvent(
  eventType: AuditEventType,
  metadata: AuditEventMetadata
): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO audit_logs (
        event_type,
        actor_id,
        actor_email,
        actor_role,
        tenant_id,
        development_id,
        ip_address,
        user_agent,
        endpoint,
        resource_type,
        resource_id,
        previous_value,
        new_value,
        metadata,
        created_at
      ) VALUES (
        ${eventType},
        ${metadata.actor_id},
        ${metadata.actor_email},
        ${metadata.actor_role},
        ${metadata.tenant_id},
        ${metadata.development_id || null},
        ${metadata.ip_address || null},
        ${metadata.user_agent || null},
        ${metadata.endpoint || null},
        ${metadata.resource_type || null},
        ${metadata.resource_id || null},
        ${metadata.previous_value ? JSON.stringify(metadata.previous_value) : null},
        ${metadata.new_value ? JSON.stringify(metadata.new_value) : null},
        ${metadata.metadata ? JSON.stringify(metadata.metadata) : null},
        NOW()
      )
    `);

    console.log(`[AUDIT] ${eventType}:`, {
      actor: metadata.actor_email,
      resource: metadata.resource_id,
    });
  } catch (error) {
    console.error('[AUDIT] Failed to log audit event:', error);
  }
}

export function extractRequestMetadata(request: NextRequest): {
  ip_address?: string;
  user_agent?: string;
  endpoint: string;
} {
  const ip_address =
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.ip ||
    'unknown';

  const user_agent = request.headers.get('user-agent') || 'unknown';
  
  const endpoint = new URL(request.url).pathname;

  return { ip_address, user_agent, endpoint };
}

export async function logDocumentUpload(
  context: TenancyContext,
  documentId: string,
  documentName: string,
  request: NextRequest
): Promise<void> {
  const requestMeta = extractRequestMetadata(request);

  await logAuditEvent('document_upload', {
    actor_id: context.userId,
    actor_email: context.email,
    actor_role: context.role,
    tenant_id: context.tenantId,
    development_id: context.developmentId,
    resource_type: 'document',
    resource_id: documentId,
    new_value: { name: documentName },
    ...requestMeta,
  });
}

export async function logDocumentDelete(
  context: TenancyContext,
  documentId: string,
  documentName: string,
  request: NextRequest
): Promise<void> {
  const requestMeta = extractRequestMetadata(request);

  await logAuditEvent('document_delete', {
    actor_id: context.userId,
    actor_email: context.email,
    actor_role: context.role,
    tenant_id: context.tenantId,
    development_id: context.developmentId,
    resource_type: 'document',
    resource_id: documentId,
    previous_value: { name: documentName },
    ...requestMeta,
  });
}

export async function logRoleChange(
  context: TenancyContext,
  targetUserId: string,
  targetUserEmail: string,
  oldRole: string,
  newRole: string,
  request: NextRequest
): Promise<void> {
  const requestMeta = extractRequestMetadata(request);

  await logAuditEvent('role_change', {
    actor_id: context.userId,
    actor_email: context.email,
    actor_role: context.role,
    tenant_id: context.tenantId,
    resource_type: 'user',
    resource_id: targetUserId,
    previous_value: { role: oldRole },
    new_value: { role: newRole },
    metadata: { target_email: targetUserEmail },
    ...requestMeta,
  });
}

export async function logDataExport(
  context: TenancyContext,
  exportType: string,
  recordCount: number,
  request: NextRequest
): Promise<void> {
  const requestMeta = extractRequestMetadata(request);

  await logAuditEvent('data_export', {
    actor_id: context.userId,
    actor_email: context.email,
    actor_role: context.role,
    tenant_id: context.tenantId,
    development_id: context.developmentId,
    resource_type: 'export',
    metadata: { export_type: exportType, record_count: recordCount },
    ...requestMeta,
  });
}

export async function logImpersonation(
  adminContext: TenancyContext,
  targetUserId: string,
  targetUserEmail: string,
  request: NextRequest
): Promise<void> {
  const requestMeta = extractRequestMetadata(request);

  await logAuditEvent('impersonation_start', {
    actor_id: adminContext.userId,
    actor_email: adminContext.email,
    actor_role: adminContext.role,
    tenant_id: adminContext.tenantId,
    resource_type: 'user',
    resource_id: targetUserId,
    metadata: { target_email: targetUserEmail },
    ...requestMeta,
  });
}
