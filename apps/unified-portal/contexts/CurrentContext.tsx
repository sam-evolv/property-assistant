'use client';

/**
 * CURRENT CONTEXT
 * 
 * Global tenant/development context for the developer dashboard.
 * 
 * INVARIANTS:
 * - React state is the SINGLE source of truth for archive scope
 * - localStorage is WRITE-ONLY persistence (never overrides React state after init)
 * - scope shape: { mode: "ALL_SCHEMES" | "SCHEME", schemeId?, schemeName? }
 */

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
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
  developmentName: string | null;
  projectType: string | null;
  setArchiveScope: (scope: ArchiveScope) => void;
  setDevelopmentId: (id: string | null, name?: string | null, projectType?: string | null) => void;
  isHydrated: boolean;
  isLoading: boolean;
}

const DEFAULT_ARCHIVE_SCOPE = createAllSchemesScope();

const DEFAULT_CURRENT_STATE: CurrentContextValue = {
  tenantId: null,
  archiveScope: DEFAULT_ARCHIVE_SCOPE,
  developmentId: null,
  developmentName: null,
  projectType: null,
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

/**
 * WRITE-ONLY storage function
 * Storage is for persistence across sessions, NOT a source of truth
 */
function saveToStorage(tenantId: string | null, scope: ArchiveScope): void {
  if (!tenantId || typeof window === 'undefined') return;
  try {
    const key = getStorageKey(tenantId);
    const value = scopeToString(scope);
    localStorage.setItem(key, value);
    console.log('[CurrentContext] Persisted to storage:', { tenantId, scope: value });
  } catch (e) {
    console.warn('[CurrentContext] Failed to save to localStorage:', e);
  }
}

/**
 * Initial hydration ONLY - reads storage once at startup
 * After hydration, React state is the sole authority
 */
function loadInitialScope(tenantId: string | null): ArchiveScope {
  if (!tenantId || typeof window === 'undefined') return DEFAULT_ARCHIVE_SCOPE;
  try {
    const stored = localStorage.getItem(getStorageKey(tenantId));
    if (!stored) return DEFAULT_ARCHIVE_SCOPE;
    console.log('[CurrentContext] Initial hydration from storage:', stored);
    return stringToScope(stored);
  } catch (e) {
    console.warn('[CurrentContext] Failed to read initial storage:', e);
    return DEFAULT_ARCHIVE_SCOPE;
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
  
  // Track if we've done initial hydration (ONE-TIME read from storage)
  const hasHydratedRef = useRef(false);
  const hydratedTenantRef = useRef<string | null>(null);
  
  const initialScope = initialDevelopmentId 
    ? createSchemeScope(initialDevelopmentId) 
    : DEFAULT_ARCHIVE_SCOPE;
  
  const [archiveScope, setArchiveScopeState] = useState<ArchiveScope>(initialScope);
  const [developmentName, setDevelopmentName] = useState<string | null>(null);
  const [projectType, setProjectType] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // ONE-TIME hydration effect - reads storage ONLY on initial mount
  useEffect(() => {
    // Only hydrate once per tenant
    if (hasHydratedRef.current && hydratedTenantRef.current === tenantId) {
      return;
    }
    
    // If tenant changed, reset to ALL_SCHEMES (don't read from storage again)
    if (hasHydratedRef.current && hydratedTenantRef.current !== tenantId) {
      console.log('[CurrentContext] Tenant changed, resetting to ALL_SCHEMES', {
        from: hydratedTenantRef.current,
        to: tenantId,
      });
      setArchiveScopeState(DEFAULT_ARCHIVE_SCOPE);
      hydratedTenantRef.current = tenantId;
      return;
    }
    
    // Initial hydration - read from storage ONCE
    if (tenantId && !hasHydratedRef.current) {
      const storedScope = loadInitialScope(tenantId);
      console.log('[CurrentContext] Initial hydration:', scopeToString(storedScope));
      setArchiveScopeState(storedScope);
      hasHydratedRef.current = true;
      hydratedTenantRef.current = tenantId;
    }
    
    setIsHydrated(true);
    setIsLoading(false);
  }, [tenantId]);

  const setArchiveScope = useCallback((scope: ArchiveScope) => {
    console.log('[CurrentContext] Scope changed:', { 
      from: scopeToString(archiveScope), 
      to: scopeToString(scope) 
    });
    setArchiveScopeState(scope);
    saveToStorage(tenantId, scope);
  }, [tenantId, archiveScope]);

  const setDevelopmentId = useCallback((id: string | null, name?: string | null, devProjectType?: string | null) => {
    const newScope = id ? createSchemeScope(id) : createAllSchemesScope();
    setArchiveScope(newScope);
    setDevelopmentName(name || null);
    setProjectType(devProjectType || null);
  }, [setArchiveScope]);

  const developmentId = getSchemeId(archiveScope);

  const value: CurrentContextValue = {
    tenantId,
    archiveScope,
    developmentId,
    developmentName,
    projectType,
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
