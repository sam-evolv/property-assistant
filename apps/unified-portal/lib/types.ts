export type AdminRole = 'super_admin' | 'developer' | 'admin' | 'tenant_admin';

export interface AdminSession {
  id: string;
  email: string;
  role: AdminRole;
  roles: AdminRole[];
  tenantId: string;
}
