import { NextRequest } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { db } from '@openhouse/db/client';
import { admins, developments } from '@openhouse/db/schema';
import { eq } from 'drizzle-orm';

export type AdminRole = 'super_admin' | 'developer' | 'admin';

export interface AdminContext {
  id: string;
  email: string;
  role: AdminRole;
  tenantId: string;
}

async function getSupabaseClient() {
  return createServerComponentClient({ cookies });
}

export async function getAdminContextFromSession(): Promise<AdminContext | null> {
  try {
    const supabase = await getSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user?.email) {
      return null;
    }

    const admin = await db.query.admins.findFirst({
      where: eq(admins.email, user.email),
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
  } catch (error) {
    console.error('[API_AUTH] Failed to get admin context:', error);
    return null;
  }
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

export function isEnterpriseUser(context: AdminContext | null): boolean {
  return context?.role === 'super_admin' || context?.role === 'admin';
}

export async function assertSuperAdmin(): Promise<AdminContext> {
  const context = await getAdminContextFromSession();
  
  if (!context) {
    throw new Error('Unauthorized: No valid session');
  }
  
  if (!isSuperAdmin(context)) {
    throw new Error('Forbidden: Super admin access required');
  }
  
  return context;
}

export async function assertEnterpriseUser(): Promise<AdminContext> {
  const context = await getAdminContextFromSession();
  
  if (!context) {
    throw new Error('Unauthorized: No valid session');
  }
  
  if (!isEnterpriseUser(context)) {
    throw new Error('Forbidden: Enterprise access required');
  }
  
  return context;
}

export async function assertDeveloper(): Promise<AdminContext> {
  const context = await getAdminContextFromSession();
  
  if (!context) {
    throw new Error('Unauthorized: No valid session');
  }
  
  if (!isDeveloper(context) && !isEnterpriseUser(context)) {
    throw new Error('Forbidden: Developer access required');
  }
  
  return context;
}

export function enforceTenantScope(context: AdminContext | null, tenantId?: string): string {
  if (!context) {
    throw new Error('Unauthorized: No valid session');
  }

  if (isSuperAdmin(context)) {
    return tenantId || context.tenantId;
  }

  if (tenantId && tenantId !== context.tenantId) {
    throw new Error('Forbidden: Cannot access data from another tenant');
  }

  return context.tenantId;
}

export async function enforceDevelopmentScope(context: AdminContext | null, developmentId?: string): Promise<string | undefined> {
  if (!context) {
    throw new Error('Unauthorized: No valid session');
  }

  if (isSuperAdmin(context)) {
    return developmentId;
  }

  if (developmentId) {
    const development = await db.query.developments.findFirst({
      where: eq(developments.id, developmentId),
      columns: {
        id: true,
        tenant_id: true,
      },
    });

    if (!development) {
      throw new Error('Forbidden: Development not found');
    }

    if (development.tenant_id !== context.tenantId) {
      throw new Error('Forbidden: Cannot access data from another tenant\'s development');
    }

    return developmentId;
  }

  return undefined;
}

export function getEffectiveTenantId(context: AdminContext | null, requestedTenantId?: string): string | undefined {
  if (!context) {
    return undefined;
  }

  if (isSuperAdmin(context)) {
    return requestedTenantId;
  }

  return context.tenantId;
}
