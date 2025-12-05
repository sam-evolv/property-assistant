'use client';

import { ReactNode } from 'react';
import { CurrentContextProvider } from '@/contexts/CurrentContext';
import { AdminEnterpriseNav } from './nav-client';

interface SuperLayoutClientProps {
  children: ReactNode;
}

export function SuperLayoutClient({ children }: SuperLayoutClientProps) {
  return (
    <CurrentContextProvider>
      <div className="flex h-screen bg-gray-50">
        <AdminEnterpriseNav />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </CurrentContextProvider>
  );
}
