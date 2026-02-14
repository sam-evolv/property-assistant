'use client';

import { ReactNode, useState } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { DevelopmentProvider } from '@/contexts/DevelopmentContext';
import { ToastProvider } from '@/components/ui/Toast';

export function LayoutProviders({ children }: { children: ReactNode }) {
  const [authContext] = useState({
    userRole: null as any,
    tenantId: null as string | null,
    adminId: null as string | null,
    email: null as string | null,
    displayName: null as string | null,
    isLoading: false,
  });

  return (
    <AuthProvider value={authContext}>
      <DevelopmentProvider>
        <ToastProvider />
        {children}
      </DevelopmentProvider>
    </AuthProvider>
  );
}
