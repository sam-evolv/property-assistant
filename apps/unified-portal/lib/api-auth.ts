import { NextRequest } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { db } from '@openhouse/db/client';
import { admins, developments, units } from '@openhouse/db/schema';
import { eq, and } from 'drizzle-orm';
import { validateQRToken } from '@openhouse/api/qr-tokens';

export type AdminRole = 'super_admin' | 'developer' | 'admin';

// SECURITY: Structured violation logging for audit trails
export interface SecurityViolationContext {
  request_id: string;
  user_id?: string;
  developer_id?: string;
  tenant_id?: string;
  project_id?: string;
  unit_uid?: string;
  attempted_resource?: string;
  reason: string;
}

export function logSecurityViolation(context: SecurityViolationContext): void {
  // SECURITY: All isolation violations logged with structured context for audit
  console.error(
    `[SECURITY VIOLATION] ${context.reason}`,
    JSON.stringify({
      request_id: context.request_id,
      user_id: context.user_id || 'anonymous',
      developer_id: context.developer_id || null,
      tenant_id: context.tenant_id || null,
      project_id: context.project_id || null,
      unit_uid: context.unit_uid || null,
      attempted_resource: context.attempted_resource || null,
      timestamp: new Date().toISOString(),
    })
  );
}

export interface AdminContext {
  id: string;
  email: string;
  role: AdminRole;
  tenantId: string;
}

async function getSupabaseClient() {
  return createServerComponentClient({ cookies });
}

export async function getAdminContextFromSession(): Promise<AdminContext | null> {
  try {
    const supabase = await getSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user?.email) {
      return null;
    }

    const admin = await db.query.admins.findFirst({
      where: eq(admins.email, user.email),
      columns: {
        id: true,
        email: true,
        role: true,
        tenant_id: true,
      },
    });

    if (!admin) {
      return null;
    }

    return {
      id: admin.id,
      email: admin.email,
      role: admin.role as AdminRole,
      tenantId: admin.tenant_id,
    };
  } catch (error) {
    console.error('[API_AUTH] Failed to get admin context:', error);
    return null;
  }
}

export function isSuperAdmin(context: AdminContext | null): boolean {
  return context?.role === 'super_admin';
}

export function isDeveloper(context: AdminContext | null): boolean {
  return context?.role === 'developer';
}

export function isAdmin(context: AdminContext | null): boolean {
  return context?.role === 'admin';
}

export function isEnterpriseUser(context: AdminContext | null): boolean {
  return context?.role === 'super_admin' || context?.role === 'admin';
}

export async function assertSuperAdmin(): Promise<AdminContext> {
  const context = await getAdminContextFromSession();
  
  if (!context) {
    throw new Error('Unauthorized: No valid session');
  }
  
  if (!isSuperAdmin(context)) {
    throw new Error('Forbidden: Super admin access required');
  }
  
  return context;
}

export async function assertEnterpriseUser(): Promise<AdminContext> {
  const context = await getAdminContextFromSession();
  
  if (!context) {
    throw new Error('Unauthorized: No valid session');
  }
  
  if (!isEnterpriseUser(context)) {
    throw new Error('Forbidden: Enterprise access required');
  }
  
  return context;
}

export async function assertDeveloper(): Promise<AdminContext> {
  const context = await getAdminContextFromSession();
  
  if (!context) {
    throw new Error('Unauthorized: No valid session');
  }
  
  if (!isDeveloper(context) && !isEnterpriseUser(context)) {
    throw new Error('Forbidden: Developer access required');
  }
  
  return context;
}

// SECURITY: Fail-closed tenant scope enforcement with violation logging
export function enforceTenantScope(
  context: AdminContext | null, 
  tenantId?: string,
  requestId?: string
): string {
  if (!context) {
    throw new Error('Unauthorized: No valid session');
  }

  // SECURITY: Super admins can access any tenant
  if (isSuperAdmin(context)) {
    return tenantId || context.tenantId;
  }

  // SECURITY: Cross-tenant access forbidden for non-super-admins
  if (tenantId && tenantId !== context.tenantId) {
    logSecurityViolation({
      request_id: requestId || 'unknown',
      user_id: context.id,
      developer_id: context.id,
      tenant_id: context.tenantId,
      attempted_resource: `tenant:${tenantId}`,
      reason: 'Cross-tenant access attempt blocked',
    });
    throw new Error('Forbidden: Cannot access data from another tenant');
  }

  return context.tenantId;
}

// SECURITY: Fail-closed development scope enforcement with violation logging
export async function enforceDevelopmentScope(
  context: AdminContext | null, 
  developmentId?: string,
  requestId?: string
): Promise<string | undefined> {
  if (!context) {
    throw new Error('Unauthorized: No valid session');
  }

  // SECURITY: Super admins can access any development
  if (isSuperAdmin(context)) {
    return developmentId;
  }

  if (developmentId) {
    const development = await db.query.developments.findFirst({
      where: eq(developments.id, developmentId),
      columns: {
        id: true,
        tenant_id: true,
      },
    });

    if (!development) {
      logSecurityViolation({
        request_id: requestId || 'unknown',
        user_id: context.id,
        developer_id: context.id,
        tenant_id: context.tenantId,
        project_id: developmentId,
        reason: 'Access attempt to non-existent development',
      });
      throw new Error('Forbidden: Development not found');
    }

    // SECURITY: Cross-tenant development access forbidden
    if (development.tenant_id !== context.tenantId) {
      logSecurityViolation({
        request_id: requestId || 'unknown',
        user_id: context.id,
        developer_id: context.id,
        tenant_id: context.tenantId,
        project_id: developmentId,
        attempted_resource: `development:${developmentId}`,
        reason: 'Cross-tenant development access blocked',
      });
      throw new Error('Forbidden: Cannot access data from another tenant\'s development');
    }

    return developmentId;
  }

  return undefined;
}

// SECURITY: Verify unit belongs to expected development (purchaser isolation)
export async function enforceUnitDevelopmentScope(
  unitUid: string,
  expectedDevelopmentId: string,
  requestId: string
): Promise<boolean> {
  const unit = await db.query.units.findFirst({
    where: eq(units.unit_uid, unitUid),
    columns: {
      id: true,
      development_id: true,
    },
  });

  if (!unit) {
    logSecurityViolation({
      request_id: requestId,
      unit_uid: unitUid,
      project_id: expectedDevelopmentId,
      reason: 'Access attempt to non-existent unit',
    });
    return false;
  }

  // SECURITY: Cross-development unit access forbidden
  if (unit.development_id !== expectedDevelopmentId) {
    logSecurityViolation({
      request_id: requestId,
      unit_uid: unitUid,
      project_id: expectedDevelopmentId,
      attempted_resource: `unit:${unitUid}`,
      reason: 'Unit does not belong to claimed development - cross-project access blocked',
    });
    return false;
  }

  return true;
}

export function getEffectiveTenantId(context: AdminContext | null, requestedTenantId?: string): string | undefined {
  if (!context) {
    return undefined;
  }

  if (isSuperAdmin(context)) {
    return requestedTenantId;
  }

  return context.tenantId;
}

// SECURITY: Purchaser token validation result with security context
export interface PurchaserValidationResult {
  valid: boolean;
  unitUid: string | null;
  projectId: string | null;
  developmentId: string | null;
  tenantId: string | null;
  error?: string;
  error_code?: string;
}

// SECURITY: Validate purchaser token and enforce unit→development→tenant relationship
// Fail-closed: Any mismatch or missing relationship blocks access
export async function validatePurchaserAccess(
  token: string | null,
  claimedUnitUid: string | null,
  requestId: string
): Promise<PurchaserValidationResult> {
  // SECURITY: Fail-closed - missing credentials blocks access
  if (!token || !claimedUnitUid) {
    logSecurityViolation({
      request_id: requestId,
      unit_uid: claimedUnitUid || undefined,
      reason: 'Missing token or unit_uid in purchaser request',
    });
    return { 
      valid: false, 
      unitUid: null, 
      projectId: null, 
      developmentId: null, 
      tenantId: null,
      error: 'Authentication required',
      error_code: 'MISSING_CREDENTIALS',
    };
  }

  // Fetch unit with full relationship chain
  const unit = await db.query.units.findFirst({
    where: eq(units.unit_uid, claimedUnitUid),
    columns: {
      id: true,
      unit_uid: true,
      development_id: true,
      tenant_id: true,
    },
  });

  // SECURITY: Fail-closed - unit must exist
  if (!unit) {
    logSecurityViolation({
      request_id: requestId,
      unit_uid: claimedUnitUid,
      reason: 'Purchaser access attempt to non-existent unit',
    });
    return { 
      valid: false, 
      unitUid: null, 
      projectId: null, 
      developmentId: null, 
      tenantId: null,
      error: 'Unit not found',
      error_code: 'UNIT_NOT_FOUND',
    };
  }

  // SECURITY: Validate token using cryptographic verification
  // First try proper QR token validation (signature + expiry check)
  const payload = await validateQRToken(token);
  if (payload) {
    // SECURITY: Token's embedded unit_uid must match claimed unit_uid
    if (payload.supabaseUnitId !== claimedUnitUid) {
      logSecurityViolation({
        request_id: requestId,
        unit_uid: claimedUnitUid,
        attempted_resource: `token_unit:${payload.supabaseUnitId}`,
        reason: 'Token unit mismatch - cross-unit access attempt blocked',
      });
      return { 
        valid: false, 
        unitUid: null, 
        projectId: null, 
        developmentId: null, 
        tenantId: null,
        error: 'Invalid token for this unit',
        error_code: 'TOKEN_UNIT_MISMATCH',
      };
    }
    // Token validated cryptographically and matches claimed unit
    return {
      valid: true,
      unitUid: unit.unit_uid,
      projectId: unit.development_id,
      developmentId: unit.development_id,
      tenantId: unit.tenant_id,
    };
  }

  // Showhouse mode: token === unitUid (demo access)
  // SECURITY: Only allow if token exactly matches claimed unit_uid
  if (token === claimedUnitUid) {
    console.log(`[Auth] Showhouse mode access for unit ${claimedUnitUid} requestId=${requestId}`);
    return {
      valid: true,
      unitUid: unit.unit_uid,
      projectId: unit.development_id,
      developmentId: unit.development_id,
      tenantId: unit.tenant_id,
    };
  }

  // Token invalid and not showhouse mode
  logSecurityViolation({
    request_id: requestId,
    unit_uid: claimedUnitUid,
    reason: 'Invalid or expired token - access denied',
  });
  return { 
    valid: false, 
    unitUid: null, 
    projectId: null, 
    developmentId: null, 
    tenantId: null,
    error: 'Invalid or expired token',
    error_code: 'INVALID_TOKEN',
  };
}
