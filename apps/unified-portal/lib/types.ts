export type AdminRole = 'super_admin' | 'developer' | 'admin' | 'tenant_admin' | 'installer' | 'installer_admin';

export interface AdminSession {
  id: string;
  email: string;
  role: AdminRole;
  preferredRole?: AdminRole | null;
  tenantId: string;
  displayName?: string | null;
}
