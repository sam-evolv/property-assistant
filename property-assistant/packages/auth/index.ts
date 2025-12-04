export { TenantProvider } from './TenantProvider';
export { getTenantContext, getTenantConfig } from './tenant';
export type { TenantConfig } from './tenant';

export function getTenantIdFromJWT(token: string | null | undefined): string | null {
  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.tenant_id || null;
  } catch (error) {
    console.error('Error parsing JWT:', error);
    return null;
  }
}

export function getTenantIdFromSubdomain(hostname: string): string | null {
  if (!hostname || hostname === 'localhost') return null;
  
  const parts = hostname.split('.');
  if (parts.length < 2) return null;
  
  return parts[0];
}

export async function getTenantId(
  req: Request,
  options?: { fromJWT?: boolean; fromSubdomain?: boolean }
): Promise<string | null> {
  const { fromJWT = true, fromSubdomain = true } = options || {};

  if (fromJWT) {
    const authHeader = req.headers.get('authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const tenantId = getTenantIdFromJWT(token);
      if (tenantId) return tenantId;
    }
  }

  if (fromSubdomain) {
    const hostname = req.headers.get('host') || '';
    const subdomain = getTenantIdFromSubdomain(hostname);
    if (subdomain) return subdomain;
  }

  return null;
}
