import { requireRole } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import nextDynamic from 'next/dynamic';
import { Suspense } from 'react';

// Skeleton for loading state
function DevelopersSkeleton() {
  return (
    <div className="p-6 lg:p-8 bg-neutral-50 min-h-screen animate-pulse">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header skeleton */}
        <div className="flex justify-between items-center">
          <div>
            <div className="h-8 w-64 bg-neutral-200 rounded-lg mb-2" />
            <div className="h-4 w-96 bg-neutral-200 rounded" />
          </div>
          <div className="h-10 w-36 bg-neutral-200 rounded-lg" />
        </div>
        {/* Stats skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-white rounded-xl border border-neutral-200" />
          ))}
        </div>
        {/* Table skeleton */}
        <div className="bg-white rounded-xl border border-neutral-200 h-96" />
      </div>
    </div>
  );
}

const DevelopersContent = nextDynamic(
  () => import('./DevelopersContent').then((mod) => ({ default: mod.DevelopersContent })),
  { ssr: false, loading: () => <DevelopersSkeleton /> }
);

export default async function DevelopersPage() {
  try {
    await requireRole(['super_admin', 'admin']);
  } catch (error) {
    redirect('/unauthorized');
  }

  return (
    <Suspense fallback={<DevelopersSkeleton />}>
      <DevelopersContent />
    </Suspense>
  );
}
