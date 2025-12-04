import { NextRequest } from 'next/server';
import { db } from '@openhouse/db/client';
import { admins, developments } from '@openhouse/db/schema';
import { eq } from 'drizzle-orm';
import { resolveTenantFromRequest } from './tenancy';

export type AdminRole = 'super_admin' | 'developer' | 'admin';

export interface AdminContext {
  id: string;
  email: string;
  role: AdminRole;
  tenantId: string;
}

export async function getAdminFromEmail(email: string): Promise<AdminContext | null> {
  const admin = await db.query.admins.findFirst({
    where: eq(admins.email, email),
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
}

export async function getAdminContext(request: NextRequest): Promise<AdminContext | null> {
  const authEmail = request.headers.get('x-admin-email');
  
  if (!authEmail) {
    console.warn('[RBAC] No admin email found in request headers');
    return null;
  }

  return getAdminFromEmail(authEmail);
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

export function canAccessAllTenants(context: AdminContext | null): boolean {
  return isSuperAdmin(context);
}

export function canAccessTenant(context: AdminContext | null, tenantId: string): boolean {
  if (!context) return false;
  
  if (isSuperAdmin(context)) return true;
  
  return context.tenantId === tenantId;
}

export async function canAccessDevelopment(
  context: AdminContext | null,
  developmentId: string
): Promise<boolean> {
  if (!context) return false;
  
  if (isSuperAdmin(context)) return true;
  
  const development = await db.query.developments.findFirst({
    where: (developments, { eq }) => eq(developments.id, developmentId),
    columns: {
      tenant_id: true,
      developer_user_id: true,
    },
  });

  if (!development) return false;
  
  if (isDeveloper(context)) {
    return development.developer_user_id === context.id && development.tenant_id === context.tenantId;
  }
  
  return development.tenant_id === context.tenantId;
}

export interface CreateAdminParams {
  email: string;
  role: AdminRole;
  tenantId: string;
}

export async function createAdmin(params: CreateAdminParams): Promise<AdminContext> {
  const [admin] = await db
    .insert(admins)
    .values({
      email: params.email,
      role: params.role,
      tenant_id: params.tenantId,
    })
    .returning();

  return {
    id: admin.id,
    email: admin.email,
    role: admin.role as AdminRole,
    tenantId: admin.tenant_id,
  };
}

export async function getDevelopersByTenant(tenantId: string) {
  return db.query.admins.findMany({
    where: (admins, { eq, and }) =>
      and(
        eq(admins.tenant_id, tenantId),
        eq(admins.role, 'developer')
      ),
    columns: {
      id: true,
      email: true,
      role: true,
      created_at: true,
    },
  });
}

export async function getAllDevelopers() {
  return db.query.admins.findMany({
    where: (admins, { eq }) => eq(admins.role, 'developer'),
    columns: {
      id: true,
      email: true,
      role: true,
      tenant_id: true,
      created_at: true,
    },
    with: {
      tenant: {
        columns: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });
}

export async function getDevelopmentsByDeveloper(developerId: string) {
  return db.query.developments.findMany({
    where: (developments, { eq }) => eq(developments.developer_user_id, developerId),
    with: {
      tenant: {
        columns: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });
}
