'use client';

import { ReactNode, Suspense } from 'react';
import { CurrentContextProvider } from '@/contexts/CurrentContext';
import { ProjectContextProvider } from '@/contexts/ProjectContext';
import { AdminEnterpriseNav, SuperMobileNav } from './nav-client';

interface SuperLayoutClientProps {
  children: ReactNode;
}

export function SuperLayoutClient({ children }: SuperLayoutClientProps) {
  return (
    <CurrentContextProvider>
      <Suspense fallback={null}>
        <ProjectContextProvider>
          <div className="flex h-screen bg-black">
            <AdminEnterpriseNav />
            <div className="flex-1 flex flex-col overflow-hidden">
              <SuperMobileNav />
              <main className="flex-1 overflow-auto bg-gradient-to-br from-white via-grey-50 to-white">
                {children}
              </main>
            </div>
          </div>
        </ProjectContextProvider>
      </Suspense>
    </CurrentContextProvider>
  );
}
