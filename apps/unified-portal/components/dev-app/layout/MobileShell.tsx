'use client';

import { useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import TabBar from './TabBar';
import { BG } from '@/lib/dev-app/design-system';

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
    <div
      style={{
        height: '100dvh',
        background: BG,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <main
        style={{
          flex: 1,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorY: 'contain',
          paddingBottom: 'calc(84px + env(safe-area-inset-bottom, 0px))',
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
