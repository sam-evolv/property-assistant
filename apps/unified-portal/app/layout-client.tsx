'use client';

import { ReactNode } from 'react';
import dynamic from 'next/dynamic';

const LayoutProviders = dynamic(
  () => import('./layout-providers').then((mod) => mod.LayoutProviders),
  { 
    ssr: false,
    loading: () => null
  }
);

export function LayoutClient({ children }: { children: ReactNode }) {
  return <LayoutProviders>{children}</LayoutProviders>;
}
