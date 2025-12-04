/**
 * SAFE AUTH CLIENT MODULE
 * 
 * Provides JWT refresh loops and safe Supabase client creation that:
 * - Detects expired JWTs
 * - Refreshes silently
 * - Retries original requests
 * - Never throws undefined session errors
 */

import { logger } from '@openhouse/api/logger';

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: {
    id: string;
    email?: string;
  };
}

export interface SafeAuthResponse<T> {
  data: T | null;
  error: Error | null;
  session: AuthSession | null;
}

/**
 * Check if JWT is expired or about to expire (within 5 minutes)
 */
export function isJWTExpired(expiresAt: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  const buffer = 5 * 60; // 5 minutes
  return now >= (expiresAt - buffer);
}

/**
 * Safely refresh JWT token
 */
export async function safeRefreshToken(refreshToken: string): Promise<SafeAuthResponse<AuthSession>> {
  try {
    logger.info('[SafeAuth] Attempting token refresh');
    
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    const session = await response.json();
    
    logger.info('[SafeAuth] Token refresh successful');
    
    return {
      data: session,
      error: null,
      session,
    };
  } catch (error) {
    logger.error('[SafeAuth] Token refresh failed', { error });
    
    return {
      data: null,
      error: error instanceof Error ? error : new Error(String(error)),
      session: null,
    };
  }
}

/**
 * Safe auth client wrapper for API calls
 * Automatically refreshes expired tokens and retries
 */
export async function safeAuthFetch<T>(
  url: string,
  options?: RequestInit,
  session?: AuthSession | null
): Promise<SafeAuthResponse<T>> {
  // Check if session exists and is valid
  if (!session) {
    logger.warn('[SafeAuth] No session provided to safeAuthFetch');
    return {
      data: null,
      error: new Error('No active session'),
      session: null,
    };
  }

  // Check if token needs refresh
  if (isJWTExpired(session.expires_at)) {
    logger.info('[SafeAuth] Token expired, attempting refresh');
    
    const refreshResult = await safeRefreshToken(session.refresh_token);
    
    if (refreshResult.error || !refreshResult.session) {
      logger.error('[SafeAuth] Token refresh failed, cannot continue request');
      return {
        data: null,
        error: new Error('Session expired and refresh failed'),
        session: null,
      };
    }
    
    // Use refreshed session
    session = refreshResult.session;
  }

  // Make the actual request
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options?.headers,
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      // Check if it's a 401 - might need another refresh attempt
      if (response.status === 401) {
        logger.warn('[SafeAuth] Got 401, attempting one more token refresh');
        
        const refreshResult = await safeRefreshToken(session.refresh_token);
        
        if (refreshResult.error || !refreshResult.session) {
          throw new Error('Authentication failed after refresh attempt');
        }
        
        // Retry with new token
        const retryResponse = await fetch(url, {
          ...options,
          headers: {
            ...options?.headers,
            Authorization: `Bearer ${refreshResult.session.access_token}`,
          },
        });

        if (!retryResponse.ok) {
          throw new Error(`HTTP ${retryResponse.status}: ${retryResponse.statusText}`);
        }

        const data = await retryResponse.json();
        
        return {
          data,
          error: null,
          session: refreshResult.session,
        };
      }

      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      data,
      error: null,
      session,
    };
  } catch (error) {
    logger.error('[SafeAuth] Request failed', { url, error });
    
    return {
      data: null,
      error: error instanceof Error ? error : new Error(String(error)),
      session,
    };
  }
}

/**
 * Create a safe Supabase client wrapper
 * This prevents "cannot read properties of undefined" errors
 */
export function createSafeAuthClient() {
  let currentSession: AuthSession | null = null;

  return {
    getSession: async () => {
      if (!currentSession) {
        logger.warn('[SafeAuth] No cached session available');
        return { data: null, error: new Error('No session') };
      }

      // Check if session is expired
      if (isJWTExpired(currentSession.expires_at)) {
        const refreshResult = await safeRefreshToken(currentSession.refresh_token);
        
        if (refreshResult.session) {
          currentSession = refreshResult.session;
          return { data: refreshResult.session, error: null };
        }
        
        return { data: null, error: refreshResult.error };
      }

      return { data: currentSession, error: null };
    },

    setSession: (session: AuthSession | null) => {
      currentSession = session;
      logger.info('[SafeAuth] Session updated', { 
        hasSession: !!session,
        userId: session?.user?.id 
      });
    },

    fetch: async <T>(url: string, options?: RequestInit) => {
      return safeAuthFetch<T>(url, options, currentSession);
    },

    isAuthenticated: () => {
      return currentSession !== null && !isJWTExpired(currentSession.expires_at);
    },
  };
}

/**
 * Global safe auth client instance
 * Use this instead of direct Supabase client when possible
 */
export const safeAuthClient = createSafeAuthClient();
