import { headers } from 'next/headers';

export interface TenantConfig {
  id: string;
  name: string;
  slug: string;
  logo_url?: string | null;
  theme_color?: string | null;
  brand?: any;
  contact?: any;
  description?: string | null;
}

export function getTenantIdFromSubdomain(hostname: string): string | null {
  if (!hostname) return null;
  
  if (hostname === 'localhost' || hostname.startsWith('localhost:')) {
    return null;
  }
  
  const parts = hostname.split('.');
  if (parts.length < 2) return null;
  
  return parts[0];
}

export function getTenantSlugFromQuery(searchParams: URLSearchParams): string | null {
  return searchParams.get('tenant');
}

export function getTenantSlugFromHeader(headersList: Headers): string | null {
  return headersList.get('x-tenant');
}

export async function getTenantContext(req?: Request): Promise<{ slug: string | null; id: string | null }> {
  let slug: string | null = null;
  
  if (req) {
    const url = new URL(req.url);
    const hostname = url.hostname;
    
    slug = getTenantSlugFromQuery(url.searchParams);
    
    if (!slug) {
      slug = getTenantSlugFromHeader(req.headers);
    }
    
    if (!slug) {
      slug = getTenantIdFromSubdomain(hostname);
    }
  } else if (typeof window === 'undefined') {
    const headersList = headers();
    const host = headersList.get('host') || '';
    
    slug = headersList.get('x-tenant');
    
    if (!slug) {
      slug = getTenantIdFromSubdomain(host);
    }
  }
  
  return {
    slug,
    id: null,
  };
}

export async function getTenantConfig(tenantSlug: string): Promise<TenantConfig | null> {
  try {
    const { getTenantBySlug } = await import('@openhouse/db/tenants');
    return await getTenantBySlug(tenantSlug);
  } catch (error) {
    console.error('Error fetching tenant config:', error);
    return null;
  }
}
