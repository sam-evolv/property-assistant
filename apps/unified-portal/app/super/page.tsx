import { Suspense } from 'react';
import { requireRole } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import nextDynamic from 'next/dynamic';

export const dynamic = 'force-dynamic';

// Loading skeleton for the dashboard
function DashboardSkeleton() {
  return (
    <div className="p-8 min-h-screen bg-neutral-50">
      <div className="max-w-[1600px] mx-auto animate-pulse">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="h-8 w-64 bg-neutral-200 rounded-lg mb-2" />
            <div className="h-4 w-96 bg-neutral-100 rounded" />
          </div>
          <div className="flex gap-3">
            <div className="h-10 w-28 bg-neutral-200 rounded-lg" />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-neutral-200 p-6">
              <div className="h-4 w-24 bg-neutral-100 rounded mb-3" />
              <div className="h-8 w-20 bg-neutral-200 rounded" />
            </div>
          ))}
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl border border-neutral-200 h-80" />
          <div className="bg-white rounded-xl border border-neutral-200 h-80" />
        </div>

        {/* Bottom Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-neutral-200 h-96" />
          <div className="bg-white rounded-xl border border-neutral-200 h-96" />
          <div className="bg-white rounded-xl border border-neutral-200 h-96" />
        </div>
      </div>
    </div>
  );
}

const SuperDashboard = nextDynamic(
  () => import('./SuperDashboard').then((mod) => ({ default: mod.SuperDashboard })),
  {
    ssr: false,
    loading: () => <DashboardSkeleton />,
  }
);

export default async function AdminEnterprisePage() {
  try {
    await requireRole(['super_admin', 'admin']);
  } catch (error) {
    redirect('/unauthorized');
  }

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <SuperDashboard />
    </Suspense>
  );
}
