'use client';

import { ReactNode, useState, useEffect } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { DevelopmentProvider } from '@/contexts/DevelopmentContext';
import { ToastProvider } from '@/components/ui/Toast';

export function LayoutClient({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const authContext = {
    userRole: null as any,
    tenantId: null as string | null,
    adminId: null as string | null,
    email: null as string | null,
    isLoading: !mounted,
  };

  return (
    <AuthProvider value={authContext}>
      <DevelopmentProvider>
        <ToastProvider />
        <div suppressHydrationWarning>
          {children}
        </div>
      </DevelopmentProvider>
    </AuthProvider>
  );
}
