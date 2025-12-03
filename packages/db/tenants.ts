import { db, tenants } from './client';
import { eq } from 'drizzle-orm';

interface TenantCache {
  data: any;
  timestamp: number;
}

const tenantCache = new Map<string, TenantCache>();
const CACHE_TTL = 60 * 1000;

export async function getTenantBySlug(slug: string) {
  const cached = tenantCache.get(slug);
  const now = Date.now();
  
  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    return cached.data;
  }
  
  try {
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.slug, slug))
      .limit(1);
    
    if (tenant) {
      tenantCache.set(slug, {
        data: tenant,
        timestamp: now,
      });
    }
    
    return tenant || null;
  } catch (error) {
    console.error('Error fetching tenant by slug:', error);
    return null;
  }
}

export async function getTenantById(id: string) {
  try {
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, id))
      .limit(1);
    
    return tenant || null;
  } catch (error) {
    console.error('Error fetching tenant by ID:', error);
    return null;
  }
}

export function clearTenantCache(slug?: string) {
  if (slug) {
    tenantCache.delete(slug);
  } else {
    tenantCache.clear();
  }
}
