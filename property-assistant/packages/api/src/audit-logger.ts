import { db } from '@openhouse/db/client';
import { audit_log } from '@openhouse/db/schema';
import { NextRequest } from 'next/server';

export type AuditEventType =
  | 'admin_login'
  | 'login_failure'
  | 'homeowner_impersonation'
  | 'document_upload'
  | 'document_delete'
  | 'bulk_reingest'
  | 'developer_role_update'
  | 'tenant_theme_change'
  | 'rate_limit_trigger'
  | 'anomaly_detected'
  | 'unauthorized_tenant_access'
  | 'development_create'
  | 'development_delete'
  | 'homeowner_create'
  | 'homeowner_delete'
  | 'qr_generation'
  | 'data_export'
  | 'admin_action';

export interface AuditEventData {
  tenantId: string;
  type: AuditEventType;
  action: string;
  actorEmail?: string;
  actorId?: string;
  actorRole?: string;
  ipAddress?: string;
  requestPath?: string;
  requestPayload?: Record<string, any>;
  metadata?: Record<string, any>;
}

export function extractIpAddress(request: NextRequest): string {
  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.ip ||
    'unknown'
  );
}

export function extractRequestPath(request: NextRequest): string {
  try {
    const url = new URL(request.url);
    return url.pathname;
  } catch {
    return 'unknown';
  }
}

export async function logAuditEvent(data: AuditEventData): Promise<void> {
  try {
    await db.insert(audit_log).values({
      tenant_id: data.tenantId,
      type: data.type,
      action: data.action,
      actor: data.actorEmail,
      actor_id: data.actorId,
      actor_role: data.actorRole,
      ip_address: data.ipAddress,
      request_path: data.requestPath,
      request_payload: data.requestPayload,
      metadata: data.metadata,
    });

    console.log('[AUDIT]', {
      type: data.type,
      action: data.action,
      actor: data.actorEmail,
      tenant: data.tenantId,
    });
  } catch (error) {
    console.error('[AUDIT] Failed to log event:', error);
  }
}

export async function logAdminLogin(
  request: NextRequest,
  adminEmail: string,
  adminId: string,
  adminRole: string,
  tenantId: string
): Promise<void> {
  await logAuditEvent({
    tenantId,
    type: 'admin_login',
    action: 'Admin user logged in successfully',
    actorEmail: adminEmail,
    actorId: adminId,
    actorRole: adminRole,
    ipAddress: extractIpAddress(request),
    requestPath: extractRequestPath(request),
  });
}

export async function logLoginFailure(
  request: NextRequest,
  email: string,
  reason: string,
  attemptedTenantId?: string
): Promise<void> {
  await logAuditEvent({
    tenantId: attemptedTenantId || null as any,
    type: 'login_failure',
    action: `Login attempt failed: ${reason}`,
    actorEmail: email,
    ipAddress: extractIpAddress(request),
    requestPath: extractRequestPath(request),
    metadata: { reason, attempted_tenant_id: attemptedTenantId },
  });
}

export async function logHomeownerImpersonation(
  request: NextRequest,
  adminEmail: string,
  adminId: string,
  adminRole: string,
  homeownerEmail: string,
  homeownerId: string,
  tenantId: string
): Promise<void> {
  await logAuditEvent({
    tenantId,
    type: 'homeowner_impersonation',
    action: `Admin impersonated homeowner`,
    actorEmail: adminEmail,
    actorId: adminId,
    actorRole: adminRole,
    ipAddress: extractIpAddress(request),
    requestPath: extractRequestPath(request),
    metadata: {
      impersonated_email: homeownerEmail,
      impersonated_id: homeownerId,
    },
  });
}

export async function logDocumentUpload(
  request: NextRequest,
  actorEmail: string,
  actorId: string,
  actorRole: string,
  tenantId: string,
  documentId: string,
  documentName: string
): Promise<void> {
  await logAuditEvent({
    tenantId,
    type: 'document_upload',
    action: `Document uploaded: ${documentName}`,
    actorEmail,
    actorId,
    actorRole,
    ipAddress: extractIpAddress(request),
    requestPath: extractRequestPath(request),
    metadata: {
      document_id: documentId,
      document_name: documentName,
    },
  });
}

export async function logDocumentDelete(
  request: NextRequest,
  actorEmail: string,
  actorId: string,
  actorRole: string,
  tenantId: string,
  documentId: string,
  documentName: string
): Promise<void> {
  await logAuditEvent({
    tenantId,
    type: 'document_delete',
    action: `Document deleted: ${documentName}`,
    actorEmail,
    actorId,
    actorRole,
    ipAddress: extractIpAddress(request),
    requestPath: extractRequestPath(request),
    metadata: {
      document_id: documentId,
      document_name: documentName,
    },
  });
}

export async function logRateLimitTrigger(
  request: NextRequest,
  actorId: string | null,
  tenantId: string,
  resource: string,
  remaining: number
): Promise<void> {
  await logAuditEvent({
    tenantId,
    type: 'rate_limit_trigger',
    action: `Rate limit exceeded for resource: ${resource}`,
    actorId: actorId || undefined,
    ipAddress: extractIpAddress(request),
    requestPath: extractRequestPath(request),
    metadata: {
      resource,
      remaining,
    },
  });
}

export async function logUnauthorizedTenantAccess(
  request: NextRequest,
  actorEmail: string,
  actorId: string,
  actorRole: string,
  attemptedTenantId: string,
  actualTenantId: string
): Promise<void> {
  await logAuditEvent({
    tenantId: actualTenantId,
    type: 'unauthorized_tenant_access',
    action: `Attempted unauthorized access to tenant: ${attemptedTenantId}`,
    actorEmail,
    actorId,
    actorRole,
    ipAddress: extractIpAddress(request),
    requestPath: extractRequestPath(request),
    metadata: {
      attempted_tenant_id: attemptedTenantId,
      actual_tenant_id: actualTenantId,
    },
  });
}

export async function logDeveloperRoleUpdate(
  request: NextRequest,
  actorEmail: string,
  actorId: string,
  tenantId: string,
  targetEmail: string,
  targetId: string,
  oldRole: string,
  newRole: string
): Promise<void> {
  await logAuditEvent({
    tenantId,
    type: 'developer_role_update',
    action: `Developer role updated: ${targetEmail}`,
    actorEmail,
    actorId,
    actorRole: 'super_admin',
    ipAddress: extractIpAddress(request),
    requestPath: extractRequestPath(request),
    metadata: {
      target_email: targetEmail,
      target_id: targetId,
      old_role: oldRole,
      new_role: newRole,
    },
  });
}

export async function logDataExport(
  request: NextRequest,
  actorEmail: string,
  actorId: string,
  actorRole: string,
  tenantId: string,
  exportType: string,
  recordCount: number
): Promise<void> {
  await logAuditEvent({
    tenantId,
    type: 'data_export',
    action: `Data export: ${exportType}`,
    actorEmail,
    actorId,
    actorRole,
    ipAddress: extractIpAddress(request),
    requestPath: extractRequestPath(request),
    metadata: {
      export_type: exportType,
      record_count: recordCount,
    },
  });
}
