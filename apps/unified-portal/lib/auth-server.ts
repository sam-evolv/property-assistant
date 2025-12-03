import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAdminFromEmail, AdminRole } from '@openhouse/api/rbac';

export interface ServerAuthContext {
  userRole: AdminRole;
  tenantId: string;
  adminId: string;
  email: string;
}

export async function getServerAuthContext(): Promise<ServerAuthContext | null> {
  const headersList = headers();
  const authEmail = headersList.get('x-admin-email');

  if (!authEmail) {
    return null;
  }

  const adminContext = await getAdminFromEmail(authEmail);

  if (!adminContext) {
    return null;
  }

  return {
    userRole: adminContext.role,
    tenantId: adminContext.tenantId,
    adminId: adminContext.id,
    email: adminContext.email,
  };
}

export async function requireAuth(): Promise<ServerAuthContext> {
  const authContext = await getServerAuthContext();

  if (!authContext) {
    redirect('/login');
  }

  return authContext;
}

export async function requireRole(allowedRoles: AdminRole[]): Promise<ServerAuthContext> {
  const authContext = await requireAuth();

  if (!allowedRoles.includes(authContext.userRole)) {
    redirect('/unauthorized');
  }

  return authContext;
}
