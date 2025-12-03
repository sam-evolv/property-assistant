import { TenancyContext, UserRole, TenancyError } from './tenancy-context';

export type Permission = 
  | 'view_analytics'
  | 'view_developments'
  | 'view_units'
  | 'view_homeowners'
  | 'view_documents'
  | 'view_chat_history'
  | 'view_system_logs'
  | 'manage_developments'
  | 'manage_units'
  | 'manage_homeowners'
  | 'manage_documents'
  | 'manage_chat'
  | 'manage_training'
  | 'manage_tenants'
  | 'manage_admins'
  | 'impersonate_users'
  | 'cross_tenant_access';

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  homeowner: [
    'view_documents',
    'view_chat_history',
  ],
  developer: [
    'view_analytics',
    'view_developments',
    'view_units',
    'view_homeowners',
    'view_documents',
    'view_chat_history',
    'manage_developments',
    'manage_units',
    'manage_homeowners',
    'manage_documents',
    'manage_training',
  ],
  admin: [
    'view_analytics',
    'view_developments',
    'view_units',
    'view_homeowners',
    'view_documents',
    'view_chat_history',
    'view_system_logs',
    'manage_developments',
    'manage_units',
    'manage_homeowners',
    'manage_documents',
    'manage_chat',
    'manage_training',
    'manage_admins',
  ],
  super_admin: [
    'view_analytics',
    'view_developments',
    'view_units',
    'view_homeowners',
    'view_documents',
    'view_chat_history',
    'view_system_logs',
    'manage_developments',
    'manage_units',
    'manage_homeowners',
    'manage_documents',
    'manage_chat',
    'manage_training',
    'manage_tenants',
    'manage_admins',
    'impersonate_users',
    'cross_tenant_access',
  ],
};

export function hasPermission(context: TenancyContext, permission: Permission): boolean {
  const rolePermissions = ROLE_PERMISSIONS[context.role] || [];
  return rolePermissions.includes(permission);
}

export function requirePermission(context: TenancyContext, permission: Permission): void {
  if (!hasPermission(context, permission)) {
    throw new TenancyError(
      'INSUFFICIENT_SCOPE',
      `Permission denied: ${permission} required for role ${context.role}`
    );
  }
}

export function requireRole(context: TenancyContext, roles: UserRole[]): void {
  if (!roles.includes(context.role)) {
    throw new TenancyError(
      'INSUFFICIENT_SCOPE',
      `Required role: ${roles.join(' or ')}, got: ${context.role}`
    );
  }
}

export function canViewCrossTenantData(context: TenancyContext): boolean {
  return hasPermission(context, 'cross_tenant_access');
}

export function canManageTenants(context: TenancyContext): boolean {
  return hasPermission(context, 'manage_tenants');
}

export function canImpersonateUsers(context: TenancyContext): boolean {
  return hasPermission(context, 'impersonate_users');
}

export function isSuperAdmin(context: TenancyContext): boolean {
  return context.role === 'super_admin';
}

export function isAdmin(context: TenancyContext): boolean {
  return context.role === 'admin' || context.role === 'super_admin';
}

export function isDeveloper(context: TenancyContext): boolean {
  return context.role === 'developer';
}

export function isHomeowner(context: TenancyContext): boolean {
  return context.role === 'homeowner';
}

export interface RBACMiddlewareOptions {
  requiredRole?: UserRole[];
  requiredPermission?: Permission;
  allowCrossTenant?: boolean;
}

export function enforceRBAC(
  context: TenancyContext,
  options: RBACMiddlewareOptions
): void {
  if (options.requiredRole) {
    requireRole(context, options.requiredRole);
  }

  if (options.requiredPermission) {
    requirePermission(context, options.requiredPermission);
  }

  if (options.allowCrossTenant && !canViewCrossTenantData(context)) {
    throw new TenancyError(
      'CROSS_TENANT_ACCESS_BLOCKED',
      'Cross-tenant access requires super_admin role'
    );
  }
}
