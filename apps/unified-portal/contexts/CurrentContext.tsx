'use client';

/**
 * CURRENT CONTEXT
 * 
 * Global tenant/development context for the developer dashboard.
 * Provides:
 * - Current tenant ID (from auth context)
 * - Archive scope (ALL_SCHEMES or specific SCHEME)
 * - localStorage persistence per tenant
 * - Safe hydration handling
 */

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { 
  ArchiveScope, 
  createAllSchemesScope, 
  createSchemeScope, 
  scopeToString, 
  stringToScope,
  isAllSchemes,
  getSchemeId
} from '@/lib/archive-scope';

export interface CurrentContextValue {
  tenantId: string | null;
  archiveScope: ArchiveScope;
  developmentId: string | null;
  setArchiveScope: (scope: ArchiveScope) => void;
  setDevelopmentId: (id: string | null) => void;
  isHydrated: boolean;
  isLoading: boolean;
}

const DEFAULT_ARCHIVE_SCOPE = createAllSchemesScope();

const DEFAULT_CURRENT_STATE: CurrentContextValue = {
  tenantId: null,
  archiveScope: DEFAULT_ARCHIVE_SCOPE,
  developmentId: null,
  setArchiveScope: () => {
    console.warn('[CurrentContext] setArchiveScope called before provider initialized');
  },
  setDevelopmentId: () => {
    console.warn('[CurrentContext] setDevelopmentId called before provider initialized');
  },
  isHydrated: false,
  isLoading: true,
};

const CurrentContext = createContext<CurrentContextValue>(DEFAULT_CURRENT_STATE);

const STORAGE_KEY_PREFIX = 'current-scope-';

function getStorageKey(tenantId: string): string {
  return `${STORAGE_KEY_PREFIX}${tenantId}`;
}

function loadFromStorage(tenantId: string | null): ArchiveScope {
  if (!tenantId || typeof window === 'undefined') return DEFAULT_ARCHIVE_SCOPE;
  try {
    const stored = localStorage.getItem(getStorageKey(tenantId));
    console.log('[CurrentContext] Loaded from storage:', { tenantId, storedValue: stored });
    return stringToScope(stored);
  } catch (e) {
    console.warn('[CurrentContext] Failed to load from localStorage:', e);
    return DEFAULT_ARCHIVE_SCOPE;
  }
}

function saveToStorage(tenantId: string | null, scope: ArchiveScope): void {
  if (!tenantId || typeof window === 'undefined') return;
  try {
    const key = getStorageKey(tenantId);
    const value = scopeToString(scope);
    localStorage.setItem(key, value);
    console.log('[CurrentContext] Saved to storage:', { tenantId, scope: value });
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
  
  const initialScope = initialDevelopmentId 
    ? createSchemeScope(initialDevelopmentId) 
    : DEFAULT_ARCHIVE_SCOPE;
  
  const [archiveScope, setArchiveScopeState] = useState<ArchiveScope>(initialScope);
  const [previousTenantId, setPreviousTenantId] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (tenantId !== previousTenantId) {
      if (previousTenantId !== null && tenantId !== null) {
        console.log('[CurrentContext] Tenant changed, resetting scope to ALL_SCHEMES', {
          from: previousTenantId,
          to: tenantId,
        });
        setArchiveScopeState(DEFAULT_ARCHIVE_SCOPE);
      }
      
      if (tenantId) {
        const storedScope = loadFromStorage(tenantId);
        setArchiveScopeState(storedScope);
      } else {
        setArchiveScopeState(DEFAULT_ARCHIVE_SCOPE);
      }
      
      setPreviousTenantId(tenantId);
    }
    
    setIsHydrated(true);
    setIsLoading(false);
    
    console.log('[CurrentContext] Hydrated', {
      tenantId,
      archiveScope: scopeToString(archiveScope),
    });
  }, [tenantId, previousTenantId]);

  const setArchiveScope = useCallback((scope: ArchiveScope) => {
    console.log('[CurrentContext] Scope changed:', { 
      from: scopeToString(archiveScope), 
      to: scopeToString(scope) 
    });
    setArchiveScopeState(scope);
    saveToStorage(tenantId, scope);
  }, [tenantId, archiveScope]);

  const setDevelopmentId = useCallback((id: string | null) => {
    const newScope = id ? createSchemeScope(id) : createAllSchemesScope();
    setArchiveScope(newScope);
  }, [setArchiveScope]);

  const developmentId = getSchemeId(archiveScope);

  const value: CurrentContextValue = {
    tenantId,
    archiveScope,
    developmentId,
    setArchiveScope,
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

export function useCurrentContext(): CurrentContextValue {
  const context = useContext(CurrentContext);
  
  if (context === undefined) {
    throw new Error('useCurrentContext must be used within a CurrentContextProvider');
  }
  
  return context;
}

export function useSafeCurrentContext(): CurrentContextValue {
  const context = useContext(CurrentContext);
  
  if (!context || !context.isHydrated) {
    return DEFAULT_CURRENT_STATE;
  }
  
  return context;
}

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
