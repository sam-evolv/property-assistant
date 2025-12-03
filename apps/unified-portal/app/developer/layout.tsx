'use client';

import { DeveloperLayoutWithSidebar } from './layout-sidebar';

export default function DeveloperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DeveloperLayoutWithSidebar>{children}</DeveloperLayoutWithSidebar>;
}
