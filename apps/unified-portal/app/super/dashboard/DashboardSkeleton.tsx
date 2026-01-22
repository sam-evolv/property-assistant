'use client';

import { cn } from '@/lib/utils';

function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('bg-white rounded-xl border border-neutral-200 p-5 animate-pulse', className)}>
      <div className="flex items-start justify-between mb-4">
        <div className="h-3 w-20 bg-neutral-200 rounded" />
        <div className="h-8 w-8 bg-neutral-100 rounded-lg" />
      </div>
      <div className="h-8 w-28 bg-neutral-200 rounded mb-4" />
      <div className="h-10 w-full bg-neutral-100 rounded" />
    </div>
  );
}

function SkeletonChart({ className }: { className?: string }) {
  return (
    <div className={cn('bg-white rounded-xl border border-neutral-200 p-6 animate-pulse', className)}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="h-5 w-32 bg-neutral-200 rounded mb-2" />
          <div className="h-3 w-48 bg-neutral-100 rounded" />
        </div>
        <div className="h-8 w-24 bg-neutral-100 rounded-lg" />
      </div>
      <div className="h-64 bg-neutral-50 rounded-lg flex items-end justify-around p-4">
        {[40, 65, 45, 80, 55, 70, 50].map((h, i) => (
          <div
            key={i}
            className="w-8 bg-neutral-200 rounded-t"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function SkeletonActivity() {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-6 animate-pulse">
      <div className="flex items-center justify-between mb-6">
        <div className="h-5 w-32 bg-neutral-200 rounded" />
        <div className="h-4 w-16 bg-neutral-100 rounded" />
      </div>
      <div className="space-y-6">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex gap-4">
            <div className="w-9 h-9 rounded-full bg-neutral-200 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 bg-neutral-200 rounded" />
              <div className="h-3 w-1/2 bg-neutral-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="p-8 min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="mb-8 animate-pulse">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-64 bg-neutral-200 rounded mb-2" />
            <div className="h-4 w-48 bg-neutral-100 rounded" />
          </div>
          <div className="flex gap-3">
            <div className="h-9 w-24 bg-neutral-200 rounded-lg" />
            <div className="h-9 w-32 bg-brand-500/20 rounded-lg" />
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <SkeletonChart />
        <SkeletonChart />
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SkeletonChart className="h-full" />
        </div>
        <SkeletonActivity />
      </div>
    </div>
  );
}

export default DashboardSkeleton;
