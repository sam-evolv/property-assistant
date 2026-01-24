'use client';

import { ReactNode } from 'react';
import { BottomNav } from '@/components/pre-handover/BottomNav';

export default function PreHandoverLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FAF8F3] to-[#F5F1EA]">
      {children}
      <BottomNav />
    </div>
  );
}
