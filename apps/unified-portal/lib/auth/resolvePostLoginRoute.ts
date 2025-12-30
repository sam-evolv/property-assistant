import type { AdminRole } from '../types';

export type RouteResolution = {
  route: string;
  reason: string;
  effectiveRole: AdminRole | null;
  allRoles: AdminRole[];
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
  
  console.log('[ROLE_PRECEDENCE] Multiple roles detected:', roles, '-> landing role:', sorted[0]);
  return sorted[0];
}

export function resolvePostLoginRoute(roleOrRoles: AdminRole | AdminRole[] | null | undefined): RouteResolution {
  let allRoles: AdminRole[] = [];
  
  if (!roleOrRoles) {
    return {
      route: '/access-pending',
      reason: 'No role assigned - account not provisioned',
      effectiveRole: null,
      allRoles: []
    };
  }
  
  if (Array.isArray(roleOrRoles)) {
    allRoles = roleOrRoles;
  } else {
    allRoles = [roleOrRoles];
  }
  
  const effectiveRole = getEffectiveRole(allRoles);
  
  if (!effectiveRole) {
    return {
      route: '/access-pending',
      reason: 'No valid role found',
      effectiveRole: null,
      allRoles
    };
  }

  switch (effectiveRole) {
    case 'super_admin':
      return {
        route: '/super',
        reason: 'Super admin landing (only role)',
        effectiveRole,
        allRoles
      };
    
    case 'developer':
      return {
        route: '/developer',
        reason: 'Developer dashboard landing (highest precedence)',
        effectiveRole,
        allRoles
      };
    
    case 'admin':
    case 'tenant_admin':
      return {
        route: '/developer',
        reason: 'Admin/tenant_admin defaults to developer dashboard',
        effectiveRole,
        allRoles
      };
    
    default:
      return {
        route: '/access-pending',
        reason: `Unknown role: ${effectiveRole}`,
        effectiveRole: null,
        allRoles
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

export function isAnyRoleAllowedForPath(roles: AdminRole[], pathname: string): boolean {
  if (!roles || roles.length === 0) {
    return false;
  }
  
  for (const role of roles) {
    const allowedPaths = getRoleAllowedPaths(role);
    if (allowedPaths.some(path => pathname.startsWith(path))) {
      return true;
    }
  }
  
  return false;
}

export function isRoleAllowedForPath(role: AdminRole, pathname: string): boolean {
  const allowedPaths = getRoleAllowedPaths(role);
  return allowedPaths.some(path => pathname.startsWith(path));
}

export function getRedirectForUnauthorizedAccess(roles: AdminRole[], attemptedPath: string): string {
  const { route: defaultRoute } = resolvePostLoginRoute(roles);
  return defaultRoute;
}
