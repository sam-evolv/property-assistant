/**
 * SAFE CLIENT MODULE
 * 
 * Provides safe wrappers for all backend calls that:
 * - Never throw undefined errors
 * - Always return valid objects (even on failure)
 * - Log failures for debugging
 * - Prevent SSR hydration mismatches
 */

import { logger } from '@openhouse/api/logger';

export interface SafeResponse<T> {
  data: T | null;
  error: Error | null;
  success: boolean;
}

export interface TenantData {
  id: string;
  name: string;
  slug: string;
  theme: Record<string, any>;
}

export interface DeveloperData {
  id: string;
  name: string;
  email: string;
  tenant_id: string;
  role: string;
}

export interface DevelopmentData {
  id: string;
  name: string;
  tenant_id: string;
  address: string | null;
  description: string | null;
}

export interface HouseData {
  id: string;
  unit_number: string;
  development_id: string;
  house_type_code: string | null;
  status: string;
}

export interface DocumentData {
  id: string;
  title: string;
  tenant_id: string;
  development_id: string | null;
  file_path: string;
  created_at: string;
}

const SAFE_DEFAULTS = {
  tenant: (): TenantData => ({
    id: '',
    name: 'Unknown Tenant',
    slug: 'unknown',
    theme: {},
  }),
  developer: (): DeveloperData => ({
    id: '',
    name: 'Unknown Developer',
    email: '',
    tenant_id: '',
    role: 'developer',
  }),
  development: (): DevelopmentData => ({
    id: '',
    name: 'Unknown Development',
    tenant_id: '',
    address: null,
    description: null,
  }),
  house: (): HouseData => ({
    id: '',
    unit_number: 'Unknown',
    development_id: '',
    house_type_code: null,
    status: 'available',
  }),
  document: (): DocumentData => ({
    id: '',
    title: 'Untitled',
    tenant_id: '',
    development_id: null,
    file_path: '',
    created_at: new Date().toISOString(),
  }),
};

/**
 * Safe wrapper for fetch calls
 * Prevents undefined errors and hydration mismatches
 */
async function safeFetch<T>(
  url: string,
  options?: RequestInit,
  fallback?: T
): Promise<SafeResponse<T>> {
  const isBrowser = typeof window !== 'undefined';
  
  if (!isBrowser) {
    logger.warn('[SafeClient] Prevented SSR fetch', { url });
    return {
      data: fallback || null,
      error: new Error('SSR fetch prevented'),
      success: false,
    };
  }

  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      data,
      error: null,
      success: true,
    };
  } catch (error) {
    logger.error('[SafeClient] Fetch failed', { url, error });
    
    return {
      data: fallback || null,
      error: error instanceof Error ? error : new Error(String(error)),
      success: false,
    };
  }
}

/**
 * Safe tenant fetcher
 */
export async function safeFetchTenant(tenantId: string): Promise<SafeResponse<TenantData>> {
  if (!tenantId) {
    logger.warn('[SafeClient] safeFetchTenant called with empty tenantId');
    return {
      data: SAFE_DEFAULTS.tenant(),
      error: new Error('Missing tenant ID'),
      success: false,
    };
  }

  return safeFetch<TenantData>(
    `/api/tenants/${tenantId}`,
    undefined,
    SAFE_DEFAULTS.tenant()
  );
}

/**
 * Safe developer fetcher
 */
export async function safeFetchDeveloper(developerId: string): Promise<SafeResponse<DeveloperData>> {
  if (!developerId) {
    logger.warn('[SafeClient] safeFetchDeveloper called with empty developerId');
    return {
      data: SAFE_DEFAULTS.developer(),
      error: new Error('Missing developer ID'),
      success: false,
    };
  }

  return safeFetch<DeveloperData>(
    `/api/developers/${developerId}`,
    undefined,
    SAFE_DEFAULTS.developer()
  );
}

/**
 * Safe development fetcher
 */
export async function safeFetchDevelopment(developmentId: string): Promise<SafeResponse<DevelopmentData>> {
  if (!developmentId) {
    logger.warn('[SafeClient] safeFetchDevelopment called with empty developmentId');
    return {
      data: SAFE_DEFAULTS.development(),
      error: new Error('Missing development ID'),
      success: false,
    };
  }

  return safeFetch<DevelopmentData>(
    `/api/developments/${developmentId}`,
    undefined,
    SAFE_DEFAULTS.development()
  );
}

/**
 * Safe houses fetcher
 */
export async function safeFetchHouses(developmentId: string): Promise<SafeResponse<HouseData[]>> {
  if (!developmentId) {
    logger.warn('[SafeClient] safeFetchHouses called with empty developmentId');
    return {
      data: [],
      error: new Error('Missing development ID'),
      success: false,
    };
  }

  return safeFetch<HouseData[]>(
    `/api/developments/${developmentId}/houses`,
    undefined,
    []
  );
}

/**
 * Safe documents fetcher
 */
export async function safeFetchDocuments(params: {
  tenantId?: string;
  developmentId?: string;
  limit?: number;
}): Promise<SafeResponse<DocumentData[]>> {
  const queryParams = new URLSearchParams();
  
  if (params.tenantId) queryParams.set('tenant_id', params.tenantId);
  if (params.developmentId) queryParams.set('development_id', params.developmentId);
  if (params.limit) queryParams.set('limit', String(params.limit));

  return safeFetch<DocumentData[]>(
    `/api/documents?${queryParams.toString()}`,
    undefined,
    []
  );
}

/**
 * Safe analytics fetcher
 */
export async function safeFetchAnalytics(params: {
  tenantId?: string;
  developmentId?: string;
  type?: string;
}): Promise<SafeResponse<any>> {
  const queryParams = new URLSearchParams();
  
  if (params.tenantId) queryParams.set('tenant_id', params.tenantId);
  if (params.developmentId) queryParams.set('development_id', params.developmentId);
  if (params.type) queryParams.set('type', params.type);

  return safeFetch<any>(
    `/api/analytics?${queryParams.toString()}`,
    undefined,
    { data: null, metrics: {} }
  );
}

/**
 * Check if we're in a safe client environment
 */
export function isSafeEnvironment(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Get safe error message
 */
export function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
