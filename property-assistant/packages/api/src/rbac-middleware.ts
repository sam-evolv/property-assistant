import { Permission, requirePermission, hasPermission } from '../../../lib/rbac';
import { getTenancyContext, TenancyContext } from '../../../lib/tenancy-context';

export interface RBACOptions {
  requiredPermission?: Permission;
  requiredPermissions?: Permission[];
  allowSuperAdminBypass?: boolean;
}

export type RouteHandler<T = any> = (
  request: any,
  context?: T
) => Promise<any>;

export type RBACRouteHandler<T = any> = (
  request: any,
  tenancyContext: TenancyContext,
  context?: T
) => Promise<any>;

export function withRBAC<T = any>(
  handler: RBACRouteHandler<T>,
  options: RBACOptions
): RouteHandler<T> {
  return async (request: any, context?: T): Promise<any> => {
    const { NextResponse } = await import('next/server');
    
    try {
      const tenancyContext = await getTenancyContext(request);

      if (!tenancyContext) {
        return NextResponse.json(
          { error: 'Unauthorized - No valid session found' },
          { status: 401 }
        );
      }

      if (options.allowSuperAdminBypass && tenancyContext.role === 'super_admin') {
        return await handler(request, tenancyContext, context);
      }

      if (options.requiredPermission) {
        try {
          requirePermission(tenancyContext, options.requiredPermission);
        } catch (error) {
          return NextResponse.json(
            { 
              error: 'Forbidden - Insufficient permissions',
              required: options.requiredPermission,
              userRole: tenancyContext.role
            },
            { status: 403 }
          );
        }
      }

      if (options.requiredPermissions && options.requiredPermissions.length > 0) {
        const hasAllPermissions = options.requiredPermissions.every(permission =>
          hasPermission(tenancyContext, permission)
        );

        if (!hasAllPermissions) {
          return NextResponse.json(
            { 
              error: 'Forbidden - Insufficient permissions',
              required: options.requiredPermissions,
              userRole: tenancyContext.role
            },
            { status: 403 }
          );
        }
      }

      return await handler(request, tenancyContext, context);
    } catch (error: any) {
      console.error('[RBAC Middleware] Error:', error);
      
      if (error.code === 'INSUFFICIENT_SCOPE' || error.code === 'CROSS_TENANT_ACCESS_BLOCKED') {
        return NextResponse.json(
          { error: error.message || 'Forbidden' },
          { status: 403 }
        );
      }

      if (error.code === 'TENANT_NOT_FOUND' || error.code === 'INVALID_TENANT') {
        return NextResponse.json(
          { error: error.message || 'Tenant not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

export function requireAdminPermissions(handler: RBACRouteHandler): RouteHandler {
  return withRBAC(handler, {
    requiredPermissions: ['view_analytics', 'view_system_logs'],
    allowSuperAdminBypass: true,
  });
}

export function requireDocumentManagement(handler: RBACRouteHandler): RouteHandler {
  return withRBAC(handler, {
    requiredPermission: 'manage_documents',
  });
}

export function requireTenantManagement(handler: RBACRouteHandler): RouteHandler {
  return withRBAC(handler, {
    requiredPermission: 'manage_tenants',
  });
}

export function requireDevelopmentManagement(handler: RBACRouteHandler): RouteHandler {
  return withRBAC(handler, {
    requiredPermission: 'manage_developments',
  });
}

export function requireViewAnalytics(handler: RBACRouteHandler): RouteHandler {
  return withRBAC(handler, {
    requiredPermission: 'view_analytics',
  });
}
