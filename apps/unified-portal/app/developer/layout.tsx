'use client';

import { DeveloperLayoutWithSidebar } from './layout-sidebar';
import { CurrentContextProvider } from '@/contexts/CurrentContext';

export default function DeveloperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CurrentContextProvider>
      <DeveloperLayoutWithSidebar>{children}</DeveloperLayoutWithSidebar>
    </CurrentContextProvider>
  );
}
