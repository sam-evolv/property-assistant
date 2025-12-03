import { db } from '@openhouse/db/client';
import { tenants } from '@openhouse/db/schema';
import { eq } from 'drizzle-orm';

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  brand?: Record<string, any>;
  contact?: Record<string, any>;
}

function hostToSlug(host: string): string {
  if (!host) return 'openhouse-ai';
  
  const cleanHost = host.split(':')[0];
  
  if (cleanHost === 'localhost' || cleanHost === '127.0.0.1') {
    return 'openhouse-ai';
  }
  
  const parts = cleanHost.split('.');
  if (parts.length > 1) {
    return parts[0];
  }
  
  return 'openhouse-ai';
}

export async function resolveTenantFromHost(host: string): Promise<Tenant | null> {
  const slug = hostToSlug(host);
  return resolveTenantBySlug(slug);
}

export async function resolveTenantBySlug(slug: string): Promise<Tenant | null> {
  if (!slug || slug === '127') slug = 'openhouse-ai';
  
  try {
    const result = await db
      .select()
      .from(tenants)
      .where(eq(tenants.slug, slug))
      .limit(1);
    
    if (!result || result.length === 0) {
      return null;
    }
    
    return result[0] as Tenant;
  } catch (error) {
    console.error('Error resolving tenant:', error);
    return null;
  }
}

export async function resolveTenantFromRequest(headers: Headers): Promise<Tenant | null> {
  const xTenant = headers.get('x-tenant');
  if (xTenant) {
    return resolveTenantBySlug(xTenant);
  }
  
  const host = headers.get('host') || '';
  return resolveTenantFromHost(host);
}

export function getTenantId(headers: Headers): Promise<string | null> {
  return resolveTenantFromRequest(headers).then(tenant => tenant?.id || null);
}
