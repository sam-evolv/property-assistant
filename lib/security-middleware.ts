import { NextRequest, NextResponse } from 'next/server';
import { getTenancyContext, TenancyContext, TenancyError, UserRole } from './tenancy-context';
import { enforceRBAC, Permission } from './rbac';

export interface SecurityOptions {
  requireRole?: UserRole[];
  requirePermission?: Permission;
  allowCrossTenant?: boolean;
  requireTenant?: boolean;
}

export interface SecureEndpointHandler<T = any> {
  (request: NextRequest, context: TenancyContext, params?: any): Promise<NextResponse<T>>;
}

export function secureEndpoint<T = any>(
  handler: SecureEndpointHandler<T>,
  options: SecurityOptions = {}
) {
  return async (request: NextRequest, params?: any): Promise<NextResponse> => {
    try {
      const context = await getTenancyContext(request, {
        requireRole: options.requireRole,
        requireTenant: options.requireTenant ?? true,
      });

      enforceRBAC(context, {
        requiredRole: options.requireRole,
        requiredPermission: options.requirePermission,
        allowCrossTenant: options.allowCrossTenant,
      });

      return await handler(request, context, params);
    } catch (error) {
      if (error instanceof TenancyError) {
        const statusCode = error.code === 'UNAUTHORIZED' ? 401 : 403;
        return NextResponse.json(
          {
            error: error.message,
            code: error.code,
          },
          { status: statusCode }
        );
      }

      console.error('[Security Middleware] Unexpected error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

export function requireSuperAdmin() {
  return secureEndpoint(
    async (req, ctx, params) => {
      throw new Error('Handler not implemented');
    },
    { requireRole: ['super_admin'] }
  );
}

export function requireAdmin() {
  return secureEndpoint(
    async (req, ctx, params) => {
      throw new Error('Handler not implemented');
    },
    { requireRole: ['admin', 'super_admin'] }
  );
}

export function requireDeveloper() {
  return secureEndpoint(
    async (req, ctx, params) => {
      throw new Error('Handler not implemented');
    },
    { requireRole: ['developer', 'admin', 'super_admin'] }
  );
}

export function requireHomeowner() {
  return secureEndpoint(
    async (req, ctx, params) => {
      throw new Error('Handler not implemented');
    },
    { requireRole: ['homeowner'] }
  );
}

export async function requireTenantAccess(
  context: TenancyContext,
  targetTenantId: string
): Promise<void> {
  if (context.role === 'super_admin') return;
  
  if (context.tenantId !== targetTenantId) {
    throw new TenancyError(
      'CROSS_TENANT_ACCESS_BLOCKED',
      `Access denied to tenant: ${targetTenantId}`
    );
  }
}

export async function requireDevelopmentAccess(
  context: TenancyContext,
  developmentId: string
): Promise<void> {
  const { canAccessDevelopment } = await import('./tenancy-context');
  
  const hasAccess = await canAccessDevelopment(context, developmentId);
  
  if (!hasAccess) {
    throw new TenancyError(
      'CROSS_TENANT_ACCESS_BLOCKED',
      `Access denied to development: ${developmentId}`
    );
  }
}

export async function requireUnitAccess(
  context: TenancyContext,
  unitId: string
): Promise<void> {
  const { canAccessUnit } = await import('./tenancy-context');
  
  const hasAccess = await canAccessUnit(context, unitId);
  
  if (!hasAccess) {
    throw new TenancyError(
      'CROSS_TENANT_ACCESS_BLOCKED',
      `Access denied to unit: ${unitId}`
    );
  }
}

export function getEffectiveTenantId(
  context: TenancyContext,
  requestedTenantId?: string
): string | undefined {
  if (context.role === 'super_admin') {
    return requestedTenantId;
  }
  
  return context.tenantId;
}

export function getEffectiveDevelopmentId(
  context: TenancyContext,
  requestedDevelopmentId?: string
): string | undefined {
  if (context.role === 'super_admin') {
    return requestedDevelopmentId;
  }
  
  if (context.role === 'homeowner') {
    return context.developmentId;
  }
  
  return requestedDevelopmentId;
}
