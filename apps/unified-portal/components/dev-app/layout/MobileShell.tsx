'use client';

import { useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import TabBar from './TabBar';

interface MobileShellProps {
  children: React.ReactNode;
  unreadActivity?: number;
}

const TAB_ROUTES: Record<string, string> = {
  overview: '/dev-app/overview',
  developments: '/dev-app/developments',
  intelligence: '/dev-app/intelligence',
  activity: '/dev-app/activity',
};

function getActiveTab(pathname: string): string {
  if (pathname.includes('/intelligence')) return 'intelligence';
  if (pathname.includes('/developments')) return 'developments';
  if (pathname.includes('/activity')) return 'activity';
  return 'overview';
}

export default function MobileShell({ children, unreadActivity = 0 }: MobileShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const activeTab = getActiveTab(pathname);

  const handleTabChange = useCallback(
    (tab: string) => {
      const route = TAB_ROUTES[tab];
      if (route) router.push(route);
    },
    [router]
  );

  return (
    <div className="flex flex-col h-[100dvh] bg-white overflow-hidden">
      <main
        className="flex-1 overflow-y-auto overscroll-y-contain"
        style={{
          paddingBottom: 'calc(80px + var(--safe-bottom, env(safe-area-inset-bottom, 0px)))',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {children}
      </main>
      <TabBar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        unreadActivity={unreadActivity}
      />
    </div>
  );
}
