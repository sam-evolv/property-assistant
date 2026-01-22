import { Suspense } from 'react';
import { requireRole } from '@/lib/supabase-server';
import { DashboardContent } from './DashboardContent';
import { DashboardSkeleton } from './DashboardSkeleton';

export const metadata = {
  title: 'Enterprise Dashboard | OpenHouse AI',
  description: 'Real-time overview of your property management platform',
};

export default async function SuperDashboardPage() {
  await requireRole(['super_admin', 'admin']);

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
