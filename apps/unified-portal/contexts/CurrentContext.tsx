'use client';

/**
 * CURRENT CONTEXT
 * 
 * Global tenant/development context for the developer dashboard.
 * Provides:
 * - Current tenant ID (from auth context)
 * - Current development ID (user-selectable)
 * - localStorage persistence per tenant
 * - Safe hydration handling
 */

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from './AuthContext';

export interface CurrentContextValue {
  tenantId: string | null;
  developmentId: string | null; // null represents "All schemes"
  setDevelopmentId: (id: string | null) => void;
  isHydrated: boolean;
  isLoading: boolean;
}

const DEFAULT_CURRENT_STATE: CurrentContextValue = {
  tenantId: null,
  developmentId: null,
  setDevelopmentId: () => {
    console.warn('[CurrentContext] setDevelopmentId called before provider initialized');
  },
  isHydrated: false,
  isLoading: true,
};

const CurrentContext = createContext<CurrentContextValue>(DEFAULT_CURRENT_STATE);

const STORAGE_KEY_PREFIX = 'current-dev-';

function getStorageKey(tenantId: string): string {
  return `${STORAGE_KEY_PREFIX}${tenantId}`;
}

function loadFromStorage(tenantId: string | null): string | null {
  if (!tenantId || typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(getStorageKey(tenantId));
    console.log('[CurrentContext] Loaded from storage:', { tenantId, storedDevId: stored });
    return stored;
  } catch (e) {
    console.warn('[CurrentContext] Failed to load from localStorage:', e);
    return null;
  }
}

function saveToStorage(tenantId: string | null, developmentId: string | null): void {
  if (!tenantId || typeof window === 'undefined') return;
  try {
    const key = getStorageKey(tenantId);
    if (developmentId) {
      localStorage.setItem(key, developmentId);
    } else {
      localStorage.removeItem(key);
    }
    console.log('[CurrentContext] Saved to storage:', { tenantId, developmentId });
  } catch (e) {
    console.warn('[CurrentContext] Failed to save to localStorage:', e);
  }
}

export interface CurrentContextProviderProps {
  children: ReactNode;
  initialDevelopmentId?: string | null;
}

export function CurrentContextProvider({
  children,
  initialDevelopmentId = null,
}: CurrentContextProviderProps) {
  const auth = useAuth();
  const tenantId = auth.tenantId;
  
  const [developmentId, setDevelopmentIdState] = useState<string | null>(initialDevelopmentId);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load from localStorage on mount
  useEffect(() => {
    if (tenantId) {
      const storedDevId = loadFromStorage(tenantId);
      if (storedDevId) {
        setDevelopmentIdState(storedDevId);
      }
    }
    setIsHydrated(true);
    setIsLoading(false);
    
    console.log('[CurrentContext] Hydrated', {
      tenantId,
      developmentId: developmentId || loadFromStorage(tenantId),
    });
  }, [tenantId]);

  // Save to localStorage when development changes
  const setDevelopmentId = useCallback((id: string | null) => {
    console.log('[CurrentContext] Development changed:', { from: developmentId, to: id });
    setDevelopmentIdState(id);
    saveToStorage(tenantId, id);
  }, [tenantId, developmentId]);

  const value: CurrentContextValue = {
    tenantId,
    developmentId,
    setDevelopmentId,
    isHydrated,
    isLoading,
  };

  return (
    <CurrentContext.Provider value={value}>
      {children}
    </CurrentContext.Provider>
  );
}

/**
 * Hook to access the current tenant/development context
 * @throws Error if used outside CurrentContextProvider
 */
export function useCurrentContext(): CurrentContextValue {
  const context = useContext(CurrentContext);
  
  if (context === undefined) {
    throw new Error('useCurrentContext must be used within a CurrentContextProvider');
  }
  
  return context;
}

/**
 * Safe hook that returns default values if not hydrated
 */
export function useSafeCurrentContext(): CurrentContextValue {
  const context = useContext(CurrentContext);
  
  if (!context || !context.isHydrated) {
    return DEFAULT_CURRENT_STATE;
  }
  
  return context;
}

/**
 * Hook that requires a development to be selected
 */
export function useRequireDevelopment(): CurrentContextValue & { developmentId: string } {
  const context = useCurrentContext();
  
  if (!context.isHydrated) {
    throw new Error('Context not hydrated');
  }
  
  if (!context.developmentId) {
    throw new Error('Development selection required');
  }
  
  return context as CurrentContextValue & { developmentId: string };
}
