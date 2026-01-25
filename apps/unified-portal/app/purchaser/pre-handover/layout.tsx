'use client';

import { ReactNode } from 'react';

export default function PreHandoverLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FAFAF8] to-[#F5F1EA]">
      {children}
    </div>
  );
}
