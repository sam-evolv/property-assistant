'use client';

import { useRouter } from 'next/navigation';
import MobileShell from '@/components/dev-app/layout/MobileShell';
import Header from '@/components/dev-app/layout/Header';
import ActivityFeed from '@/components/dev-app/activity/ActivityFeed';

export default function ActivityPage() {
  const router = useRouter();

  return (
    <MobileShell>
      <Header
        title="Activity"
        onNotificationTap={() => router.push('/dev-app/activity')}
      />
      <ActivityFeed />
    </MobileShell>
  );
}
