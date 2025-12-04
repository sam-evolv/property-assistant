'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { TenantConfig } from './tenant';

interface TenantContextType {
  tenant: TenantConfig | null;
  tenantSlug: string | null;
  isLoading: boolean;
}

const TenantContext = createContext<TenantContextType>({
  tenant: null,
  tenantSlug: null,
  isLoading: true,
});

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}

interface TenantProviderProps {
  children: React.ReactNode;
  initialTenant?: TenantConfig | null;
  initialSlug?: string | null;
}

export function TenantProvider({ children, initialTenant, initialSlug }: TenantProviderProps) {
  const [tenant, setTenant] = useState<TenantConfig | null>(initialTenant || null);
  const [tenantSlug, setTenantSlug] = useState<string | null>(initialSlug || null);
  const [isLoading, setIsLoading] = useState(!initialTenant);

  useEffect(() => {
    if (initialTenant) {
      setTenant(initialTenant);
      setIsLoading(false);
      return;
    }

    async function fetchTenant() {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        let slug = urlParams.get('tenant');

        if (!slug) {
          const hostname = window.location.hostname;
          if (hostname !== 'localhost' && !hostname.startsWith('localhost:')) {
            const parts = hostname.split('.');
            if (parts.length >= 2) {
              slug = parts[0];
            }
          }
        }

        if (slug) {
          setTenantSlug(slug);
          const response = await fetch(`/api/tenant?slug=${slug}`);
          if (response.ok) {
            const data = await response.json();
            setTenant(data.tenant);
          }
        }
      } catch (error) {
        console.error('Error fetching tenant:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchTenant();
  }, [initialTenant]);

  return (
    <TenantContext.Provider value={{ tenant, tenantSlug, isLoading }}>
      {children}
    </TenantContext.Provider>
  );
}
