'use client';

/**
 * HYDRATION CONTEXT
 * 
 * Provides a safe server-to-client data bridge that prevents:
 * - Hydration mismatches
 * - Undefined property access
 * - Race conditions between SSR and client rendering
 * - Late-loading identity data
 */

import { createContext, useContext, ReactNode, useEffect, useState } from 'react';

export interface HydrationData {
  tenant?: {
    id: string;
    name: string;
    slug: string;
    theme?: Record<string, any>;
  };
  developer?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  development?: {
    id: string;
    name: string;
    address?: string | null;
    description?: string | null;
  };
  user?: {
    id: string;
    email?: string;
  };
  timestamp: number;
}

interface HydrationContextType {
  data: HydrationData | null;
  isHydrated: boolean;
  error: Error | null;
}

const HydrationContext = createContext<HydrationContextType>({
  data: null,
  isHydrated: false,
  error: null,
});

export function HydrationProvider({
  children,
  serverData,
}: {
  children: ReactNode;
  serverData?: HydrationData;
}) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    try {
      console.log('[Hydration] Client hydration complete', {
        hasServerData: !!serverData,
        timestamp: serverData?.timestamp,
      });
      setIsHydrated(true);
    } catch (err) {
      console.error('[Hydration] Hydration error', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsHydrated(true); // Still mark as hydrated to prevent infinite loading
    }
  }, [serverData]);

  const value: HydrationContextType = {
    data: serverData || null,
    isHydrated,
    error,
  };

  return (
    <HydrationContext.Provider value={value}>
      {children}
    </HydrationContext.Provider>
  );
}

export function useHydration(): HydrationContextType {
  const context = useContext(HydrationContext);
  
  if (!context) {
    console.warn('[Hydration] useHydration called outside HydrationProvider - returning safe defaults');
    return {
      data: null,
      isHydrated: true,
      error: new Error('Used outside HydrationProvider'),
    };
  }
  
  return context;
}

/**
 * Safe hook that waits for hydration before returning data
 */
export function useHydrationData<T extends keyof HydrationData>(
  key: T
): HydrationData[T] | null {
  const { data, isHydrated } = useHydration();

  if (!isHydrated) {
    console.log('[Hydration] Data requested before hydration complete', key);
    return null;
  }

  return data?.[key] || null;
}

/**
 * Server component helper to create hydration data
 */
export function createHydrationData(data: Partial<HydrationData>): HydrationData {
  return {
    ...data,
    timestamp: Date.now(),
  };
}
