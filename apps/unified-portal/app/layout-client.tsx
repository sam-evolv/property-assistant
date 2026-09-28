'use client';

import { ReactNode } from 'react';
import dynamic from 'next/dynamic';

// Shown (server-rendered) while the client-only provider chunk loads, so a
// cold load paints a quiet branded spinner instead of a blank white page.
function AppShellLoader() {
  return (
    <div
      role="status"
      aria-label="Loading"
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        className="animate-spin"
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          border: '2.5px solid rgba(212, 175, 55, 0.2)',
          borderTopColor: '#D4AF37',
        }}
      />
    </div>
  );
}

const LayoutProviders = dynamic(
  () => import('./layout-providers').then((mod) => mod.LayoutProviders),
  {
    ssr: false,
    loading: AppShellLoader
  }
);

export function LayoutClient({ children }: { children: ReactNode }) {
  return <LayoutProviders>{children}</LayoutProviders>;
}
