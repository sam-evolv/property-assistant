'use client';

/**
 * HARDENED AUTH CONTEXT
 * 
 * Provides safe authentication state with:
 * - No undefined errors
 * - Safe default fallbacks
 * - Diagnostic logging
 * - Hydration safety
 */

import { createContext, useContext, ReactNode, useEffect, useState } from 'react';

export type AdminRole = 'super_admin' | 'developer' | 'admin';

export interface AuthContextType {
  userRole: AdminRole | null;
  tenantId: string | null;
  adminId: string | null;
  email: string | null;
  isLoading: boolean;
  isHydrated: boolean;
}

const DEFAULT_AUTH_STATE: AuthContextType = {
  userRole: null,
  tenantId: null,
  adminId: null,
  email: null,
  isLoading: false,
  isHydrated: false,
};

const AuthContext = createContext<AuthContextType>(DEFAULT_AUTH_STATE);

export function AuthProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: Omit<AuthContextType, 'isHydrated'>;
}) {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    console.log('[AuthContext] Hydrating', {
      userRole: value.userRole,
      tenantId: value.tenantId,
      adminId: value.adminId,
      email: value.email,
    });
    setIsHydrated(true);
  }, [value]);

  const contextValue: AuthContextType = {
    ...value,
    isHydrated,
  };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  
  if (!context) {
    console.warn('[AuthContext] useAuth called outside AuthProvider - returning safe defaults');
    return DEFAULT_AUTH_STATE;
  }
  
  return context;
}

/**
 * Safe hook that only returns auth data after hydration
 */
export function useSafeAuth(): AuthContextType {
  const auth = useAuth();
  
  if (!auth.isHydrated) {
    console.log('[AuthContext] Waiting for hydration');
    return {
      ...DEFAULT_AUTH_STATE,
      isLoading: true,
      isHydrated: false,
    };
  }
  
  return auth;
}

/**
 * Hook that throws if not authenticated (for protected routes)
 */
export function useRequireAuth(): Exclude<AuthContextType, { adminId: null }> {
  const auth = useSafeAuth();
  
  if (!auth.isHydrated) {
    console.log('[AuthContext] Waiting for hydration in protected route');
    throw new Error('Auth not hydrated');
  }
  
  if (!auth.adminId) {
    console.warn('[AuthContext] Unauthorized access attempt');
    throw new Error('Authentication required');
  }
  
  return auth as Exclude<AuthContextType, { adminId: null }>;
}
