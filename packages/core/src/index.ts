/**
 * OPENHOUSE CORE PACKAGE
 * 
 * Provides safe client wrappers, authentication utilities, and hydration tools
 * for building production-ready multi-tenant SaaS applications.
 */

export * from './safe-client';
export * from './auth-client';
export * from './hydration-logger';

export {
  safeFetchTenant,
  safeFetchDeveloper,
  safeFetchDevelopment,
  safeFetchHouses,
  safeFetchDocuments,
  safeFetchAnalytics,
  isSafeEnvironment,
  getSafeErrorMessage,
} from './safe-client';

export type {
  SafeResponse,
  TenantData,
  DeveloperData,
  DevelopmentData,
  HouseData,
  DocumentData,
} from './safe-client';

export {
  isJWTExpired,
  safeRefreshToken,
  safeAuthFetch,
  createSafeAuthClient,
  safeAuthClient,
} from './auth-client';

export type {
  AuthSession,
  SafeAuthResponse,
} from './auth-client';

export {
  hydrationLogger,
} from './hydration-logger';

export type {
  HydrationEvent,
} from './hydration-logger';
