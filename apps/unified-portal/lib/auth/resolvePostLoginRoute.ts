import type { AdminRole } from '../types';

export type RouteResolution = {
  route: string;
  reason: string;
};

export function resolvePostLoginRoute(role: AdminRole | null | undefined): RouteResolution {
  if (!role) {
    return {
      route: '/access-pending',
      reason: 'No role assigned - account not provisioned'
    };
  }

  switch (role) {
    case 'super_admin':
      return {
        route: '/super',
        reason: 'Super admin landing'
      };
    
    case 'developer':
    case 'admin':
    case 'tenant_admin':
      return {
        route: '/developer',
        reason: 'Developer dashboard landing'
      };
    
    default:
      return {
        route: '/access-pending',
        reason: `Unknown role: ${role}`
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
  const defaultRoute = resolvePostLoginRoute(role).route;
  
  if (attemptedPath.startsWith('/super') && role !== 'super_admin') {
    return defaultRoute;
  }
  
  if (attemptedPath.startsWith('/admin') && role !== 'super_admin') {
    return defaultRoute;
  }
  
  return defaultRoute;
}
