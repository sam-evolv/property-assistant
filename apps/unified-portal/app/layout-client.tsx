'use client';

import { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { isIOS } from '@/lib/platform';

const LayoutProviders = dynamic(
  () => import('./layout-providers').then((mod) => mod.LayoutProviders),
  { 
    ssr: false,
    loading: () => null
  }
);

export function LayoutClient({ children }: { children: ReactNode }) {
  return (
    <LayoutProviders>
      {children}
      {isIOS && (
        <div
          style={{
            position: "fixed",
            bottom: 12,
            right: 12,
            zIndex: 9999,
            padding: "6px 10px",
            background: "black",
            color: "white",
            fontSize: 12,
            borderRadius: 6,
            opacity: 0.85
          }}
        >
          iOS BUILD
        </div>
      )}
    </LayoutProviders>
  );
}
