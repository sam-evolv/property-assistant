import { NextRequest } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { db } from '@openhouse/db/client';
import { admins, homeowners, units, developments } from '@openhouse/db/schema';
import { eq, and } from 'drizzle-orm';

export type UserRole = 'homeowner' | 'developer' | 'admin' | 'super_admin';
export type TenancyScope = 'unit' | 'development' | 'tenant' | 'global';

export interface TenancyContext {
  userId: string;
  email: string;
  role: UserRole;
  tenantId: string;
  developmentId?: string;
  unitId?: string;
  houseTypeCode?: string;
  scope: TenancyScope;
  impersonatedBy?: string;
}

export class TenancyError extends Error {
  constructor(
    public code: 'TENANT_NOT_FOUND' | 'INVALID_TENANT' | 'INSUFFICIENT_SCOPE' | 'CROSS_TENANT_ACCESS_BLOCKED' | 'UNAUTHORIZED',
    message: string
  ) {
    super(message);
    this.name = 'TenancyError';
  }
}

interface GetTenancyContextOptions {
  requireRole?: UserRole[];
  requireTenant?: boolean;
  allowImpersonation?: boolean;
}

async function resolveTenantFromHeaders(headers: Headers): Promise<string | null> {
  const xTenant = headers.get('x-tenant');
  if (xTenant) {
    const tenant = await db.query.tenants.findFirst({
      where: (tenants, { eq }) => eq(tenants.slug, xTenant),
      columns: { id: true },
    });
    return tenant?.id || null;
  }

  const host = headers.get('host') || '';
  const cleanHost = host.split(':')[0];
  
  if (cleanHost === 'localhost' || cleanHost === '127.0.0.1') {
    const defaultTenant = await db.query.tenants.findFirst({
      where: (tenants, { eq }) => eq(tenants.slug, 'openhouse-ai'),
      columns: { id: true },
    });
    return defaultTenant?.id || null;
  }

  const subdomain = cleanHost.split('.')[0];
  const tenant = await db.query.tenants.findFirst({
    where: (tenants, { eq }) => eq(tenants.slug, subdomain),
    columns: { id: true },
  });
  
  return tenant?.id || null;
}

async function resolveHomeownerContext(email: string, tenantId: string | null): Promise<TenancyContext | null> {
  const homeowner = await db.query.homeowners.findFirst({
    where: eq(homeowners.email, email),
    columns: {
      id: true,
      email: true,
      tenant_id: true,
      development_id: true,
      house_type: true,
    },
  });

  if (!homeowner) return null;

  if (tenantId && homeowner.tenant_id !== tenantId) {
    throw new TenancyError('CROSS_TENANT_ACCESS_BLOCKED', 'Homeowner does not belong to this tenant');
  }

  return {
    userId: homeowner.id,
    email: homeowner.email,
    role: 'homeowner',
    tenantId: homeowner.tenant_id,
    developmentId: homeowner.development_id,
    houseTypeCode: homeowner.house_type || undefined,
    scope: 'unit',
  };
}

async function resolveAdminContext(email: string, tenantId: string | null): Promise<TenancyContext | null> {
  const admin = await db.query.admins.findFirst({
    where: eq(admins.email, email),
    columns: {
      id: true,
      email: true,
      role: true,
      tenant_id: true,
    },
  });

  if (!admin) return null;

  const role = admin.role as UserRole;

  if (role === 'super_admin') {
    return {
      userId: admin.id,
      email: admin.email,
      role: 'super_admin',
      tenantId: tenantId || admin.tenant_id,
      scope: 'global',
    };
  }

  if (tenantId && admin.tenant_id !== tenantId) {
    throw new TenancyError('CROSS_TENANT_ACCESS_BLOCKED', 'Admin does not belong to this tenant');
  }

  const scope: TenancyScope = role === 'developer' ? 'development' : 'tenant';

  return {
    userId: admin.id,
    email: admin.email,
    role,
    tenantId: admin.tenant_id,
    scope,
  };
}

export async function getTenancyContext(
  request?: NextRequest,
  options: GetTenancyContextOptions = {}
): Promise<TenancyContext> {
  const { requireRole, requireTenant = true, allowImpersonation = false } = options;

  try {
    const supabase = createServerComponentClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user?.email) {
      throw new TenancyError('UNAUTHORIZED', 'No authenticated session found');
    }

    const email = session.user.email;
    const headers = request?.headers || new Headers();
    const tenantId = requireTenant ? await resolveTenantFromHeaders(headers) : null;

    if (requireTenant && !tenantId) {
      throw new TenancyError('TENANT_NOT_FOUND', 'Unable to resolve tenant from request');
    }

    let context: TenancyContext | null = null;

    context = await resolveAdminContext(email, tenantId);
    
    if (!context) {
      context = await resolveHomeownerContext(email, tenantId);
    }

    if (!context) {
      throw new TenancyError('UNAUTHORIZED', 'User not found in admins or homeowners');
    }

    if (requireRole && !requireRole.includes(context.role)) {
      throw new TenancyError(
        'INSUFFICIENT_SCOPE',
        `Required role: ${requireRole.join(' or ')}, got: ${context.role}`
      );
    }

    return context;
  } catch (error) {
    if (error instanceof TenancyError) {
      throw error;
    }
    console.error('[Tenancy] Error getting context:', error);
    throw new TenancyError('INVALID_TENANT', 'Failed to resolve tenancy context');
  }
}

export function canAccessTenant(context: TenancyContext, targetTenantId: string): boolean {
  if (context.role === 'super_admin') return true;
  return context.tenantId === targetTenantId;
}

export async function canAccessDevelopment(
  context: TenancyContext,
  developmentId: string
): Promise<boolean> {
  if (context.role === 'super_admin') return true;

  const development = await db.query.developments.findFirst({
    where: eq(developments.id, developmentId),
    columns: {
      tenant_id: true,
      developer_user_id: true,
    },
  });

  if (!development) return false;

  if (development.tenant_id !== context.tenantId) return false;

  if (context.role === 'developer') {
    return development.developer_user_id === context.userId;
  }

  if (context.role === 'homeowner' && context.developmentId) {
    return context.developmentId === developmentId;
  }

  return context.role === 'admin';
}

export async function canAccessUnit(context: TenancyContext, unitId: string): Promise<boolean> {
  if (context.role === 'super_admin') return true;

  const unit = await db.query.units.findFirst({
    where: eq(units.id, unitId),
    columns: {
      tenant_id: true,
      development_id: true,
    },
  });

  if (!unit) return false;

  if (unit.tenant_id !== context.tenantId) return false;

  if (context.role === 'homeowner') {
    return context.unitId === unitId;
  }

  if (context.role === 'developer') {
    return canAccessDevelopment(context, unit.development_id);
  }

  return context.role === 'admin';
}

export function getTenantIdFromContext(context: TenancyContext): string {
  return context.tenantId;
}

export function getDevelopmentIdFromContext(context: TenancyContext): string | undefined {
  return context.developmentId;
}

export function getUnitIdFromContext(context: TenancyContext): string | undefined {
  return context.unitId;
}
