import type { AdminRole } from '../types';

export type RouteResolution = {
  route: string;
  reason: string;
  effectiveRole: AdminRole | null;
};

const ROLE_PRECEDENCE: Record<AdminRole, number> = {
  'developer': 1,
  'tenant_admin': 2,
  'admin': 3,
  'super_admin': 4,
};

export function getEffectiveRole(roles: AdminRole[]): AdminRole | null {
  if (!roles || roles.length === 0) {
    return null;
  }
  
  if (roles.length === 1) {
    return roles[0];
  }
  
  const sorted = [...roles].sort((a, b) => {
    const priorityA = ROLE_PRECEDENCE[a] ?? 999;
    const priorityB = ROLE_PRECEDENCE[b] ?? 999;
    return priorityA - priorityB;
  });
  
  console.log('[ROLE_PRECEDENCE] Multiple roles detected:', roles, '-> effective:', sorted[0]);
  return sorted[0];
}

export function resolvePostLoginRoute(roleOrRoles: AdminRole | AdminRole[] | null | undefined): RouteResolution {
  let effectiveRole: AdminRole | null = null;
  
  if (!roleOrRoles) {
    return {
      route: '/access-pending',
      reason: 'No role assigned - account not provisioned',
      effectiveRole: null
    };
  }
  
  if (Array.isArray(roleOrRoles)) {
    effectiveRole = getEffectiveRole(roleOrRoles);
  } else {
    effectiveRole = roleOrRoles;
  }
  
  if (!effectiveRole) {
    return {
      route: '/access-pending',
      reason: 'No valid role found',
      effectiveRole: null
    };
  }

  switch (effectiveRole) {
    case 'super_admin':
      return {
        route: '/super',
        reason: 'Super admin landing',
        effectiveRole
      };
    
    case 'developer':
      return {
        route: '/developer',
        reason: 'Developer dashboard landing (highest precedence)',
        effectiveRole
      };
    
    case 'admin':
    case 'tenant_admin':
      return {
        route: '/developer',
        reason: 'Admin/tenant_admin defaults to developer dashboard',
        effectiveRole
      };
    
    default:
      return {
        route: '/access-pending',
        reason: `Unknown role: ${effectiveRole}`,
        effectiveRole: null
      };
  }
}

export function getRoleAllowedPaths(role: AdminRole): string[] {
  switch (role) {
    case 'super_admin':
      return ['/super', '/developer', '/admin', '/portal'];
    
    case 'developer':
    case 'admin':
    case 'tenant_admin':
      return ['/developer', '/portal'];
    
    default:
      return [];
  }
}

export function isRoleAllowedForPath(role: AdminRole, pathname: string): boolean {
  const allowedPaths = getRoleAllowedPaths(role);
  return allowedPaths.some(path => pathname.startsWith(path));
}

export function getRedirectForUnauthorizedAccess(role: AdminRole, attemptedPath: string): string {
  const { route: defaultRoute } = resolvePostLoginRoute(role);
  
  if (attemptedPath.startsWith('/super') && role !== 'super_admin') {
    return defaultRoute;
  }
  
  if (attemptedPath.startsWith('/admin') && role !== 'super_admin') {
    return defaultRoute;
  }
  
  return defaultRoute;
}
