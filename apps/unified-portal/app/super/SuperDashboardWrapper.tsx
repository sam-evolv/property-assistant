'use client';

import dynamic from 'next/dynamic';

function DashboardSkeleton() {
  return (
    <div className="p-8 min-h-screen bg-neutral-50">
      <div className="max-w-[1600px] mx-auto animate-pulse">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="h-8 w-64 bg-neutral-200 rounded-lg mb-2" />
            <div className="h-4 w-96 bg-neutral-100 rounded" />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-neutral-200 p-6 h-24" />
          ))}
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 h-96" />
      </div>
    </div>
  );
}

const SuperDashboard = dynamic(
  () => import('./SuperDashboard').then((mod) => ({ default: mod.SuperDashboard })),
  { ssr: false, loading: () => <DashboardSkeleton /> }
);

export default function SuperDashboardWrapper() {
  return <SuperDashboard />;
}
