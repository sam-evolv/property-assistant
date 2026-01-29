'use client';

import { ReactNode, useEffect, useState } from 'react';
import { DeveloperLayoutWithSidebar } from './layout-sidebar';
import { CurrentContextProvider } from '@/contexts/CurrentContext';
import { AuthProvider, type AdminRole } from '@/contexts/AuthContext';

interface DeveloperLayoutProviderProps {
  children: ReactNode;
  session: {
    id: string;
    email: string;
    role: string;
    tenantId: string;
    displayName?: string | null;
  } | null;
}

export function DeveloperLayoutProvider({ children, session }: DeveloperLayoutProviderProps) {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const authValue = session ? {
    userRole: session.role as AdminRole,
    tenantId: session.tenantId,
    adminId: session.id,
    email: session.email,
    displayName: session.displayName || null,
    isLoading: false,
  } : {
    userRole: null,
    tenantId: null,
    adminId: null,
    email: null,
    displayName: null,
    isLoading: !isHydrated,
  };

  return (
    <AuthProvider value={authValue}>
      <CurrentContextProvider>
        <DeveloperLayoutWithSidebar>{children}</DeveloperLayoutWithSidebar>
      </CurrentContextProvider>
    </AuthProvider>
  );
}
