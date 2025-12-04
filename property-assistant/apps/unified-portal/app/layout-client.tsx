'use client';

import { ReactNode, useState, useEffect } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { DevelopmentProvider } from '@/contexts/DevelopmentContext';
import { ToastProvider } from '@/components/ui/Toast';

export function LayoutClient({
  children,
}: {
  children: ReactNode;
}) {
  const [authContext, setAuthContext] = useState({
    userRole: null as any,
    tenantId: null as string | null,
    adminId: null as string | null,
    email: null as string | null,
    isLoading: false,
  });

  // Auth context is loaded client-side after login
  // The layout initializes with empty context to avoid webpack conflicts
  useEffect(() => {
    // This effect is intentionally minimal to avoid triggering webpack issues
    // Session data is loaded after successful login and stored in context
  }, []);

  return (
    <AuthProvider value={authContext}>
      <DevelopmentProvider>
        <ToastProvider />
        {children}
      </DevelopmentProvider>
    </AuthProvider>
  );
}
