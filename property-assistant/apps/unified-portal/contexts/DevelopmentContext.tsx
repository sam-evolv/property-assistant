'use client';

/**
 * HARDENED DEVELOPMENT CONTEXT
 * 
 * Provides safe development state with:
 * - No undefined errors
 * - Safe default fallbacks
 * - Diagnostic logging
 * - Hydration safety
 */

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

interface DevelopmentContextType {
  developmentId: string | null;
  setDevelopmentId: (id: string | null) => void;
  isHydrated: boolean;
}

const DEFAULT_DEVELOPMENT_STATE: DevelopmentContextType = {
  developmentId: null,
  setDevelopmentId: () => {
    console.warn('[DevelopmentContext] setDevelopmentId called before provider initialized');
  },
  isHydrated: false,
};

const DevelopmentContext = createContext<DevelopmentContextType>(DEFAULT_DEVELOPMENT_STATE);

export function DevelopmentProvider({ 
  children,
  initialDevelopmentId,
}: { 
  children: ReactNode;
  initialDevelopmentId?: string | null;
}) {
  const [developmentId, setDevelopmentIdState] = useState<string | null>(
    initialDevelopmentId || null
  );
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    console.log('[DevelopmentContext] Hydrating', { 
      initialDevelopmentId,
      currentDevelopmentId: developmentId,
    });
    setIsHydrated(true);
  }, [initialDevelopmentId, developmentId]);

  const setDevelopmentId = (id: string | null) => {
    console.log('[DevelopmentContext] Development ID changed', { 
      from: developmentId, 
      to: id 
    });
    setDevelopmentIdState(id);
  };

  const value: DevelopmentContextType = {
    developmentId,
    setDevelopmentId,
    isHydrated,
  };

  return (
    <DevelopmentContext.Provider value={value}>
      {children}
    </DevelopmentContext.Provider>
  );
}

export function useDevelopment(): DevelopmentContextType {
  const context = useContext(DevelopmentContext);
  
  if (!context) {
    console.warn('[DevelopmentContext] useDevelopment called outside provider - returning safe defaults');
    return DEFAULT_DEVELOPMENT_STATE;
  }
  
  return context;
}

/**
 * Safe hook that only returns development data after hydration
 */
export function useSafeDevelopment(): DevelopmentContextType {
  const development = useDevelopment();
  
  if (!development.isHydrated) {
    console.log('[DevelopmentContext] Waiting for hydration');
    return DEFAULT_DEVELOPMENT_STATE;
  }
  
  return development;
}

/**
 * Hook that throws if no development is selected (for development-specific routes)
 */
export function useRequireDevelopment(): Exclude<DevelopmentContextType, { developmentId: null }> {
  const development = useSafeDevelopment();
  
  if (!development.isHydrated) {
    console.log('[DevelopmentContext] Waiting for hydration in protected route');
    throw new Error('Development context not hydrated');
  }
  
  if (!development.developmentId) {
    console.warn('[DevelopmentContext] No development selected');
    throw new Error('Development selection required');
  }
  
  return development as Exclude<DevelopmentContextType, { developmentId: null }>;
}
