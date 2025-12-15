'use client';

import { ReactNode, Suspense } from 'react';
import { CurrentContextProvider } from '@/contexts/CurrentContext';
import { ProjectContextProvider } from '@/contexts/ProjectContext';
import { AdminEnterpriseNav } from './nav-client';

interface SuperLayoutClientProps {
  children: ReactNode;
}

export function SuperLayoutClient({ children }: SuperLayoutClientProps) {
  return (
    <CurrentContextProvider>
      <Suspense fallback={null}>
        <ProjectContextProvider>
          <div className="flex h-screen bg-gray-50">
            <AdminEnterpriseNav />
            <main className="flex-1 overflow-y-auto">
              {children}
            </main>
          </div>
        </ProjectContextProvider>
      </Suspense>
    </CurrentContextProvider>
  );
}
