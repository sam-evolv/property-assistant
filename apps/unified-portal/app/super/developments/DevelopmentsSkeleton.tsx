'use client';

import { cn } from '@/lib/utils';

export function DevelopmentsSkeleton() {
  return (
    <div className="p-8 min-h-screen bg-neutral-50">
      <div className="max-w-7xl mx-auto">
        {/* Header skeleton */}
        <div className="flex items-center justify-between mb-8 animate-pulse">
          <div>
            <div className="h-8 w-64 bg-neutral-200 rounded-lg mb-2" />
            <div className="h-4 w-96 bg-neutral-100 rounded" />
          </div>
          <div className="flex gap-3">
            <div className="h-10 w-24 bg-neutral-200 rounded-lg" />
            <div className="h-10 w-40 bg-brand-100 rounded-lg" />
          </div>
        </div>

        {/* Stats skeleton */}
        <div className="grid grid-cols-4 gap-4 mb-8 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-neutral-200 p-6">
              <div className="h-4 w-24 bg-neutral-100 rounded mb-3" />
              <div className="h-8 w-16 bg-neutral-200 rounded" />
            </div>
          ))}
        </div>

        {/* List skeleton */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden animate-pulse">
          <div className="px-6 py-4 border-b border-neutral-100">
            <div className="h-5 w-32 bg-neutral-200 rounded" />
          </div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="px-6 py-4 border-b border-neutral-100 last:border-0">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-neutral-100 rounded-lg" />
                <div className="flex-1">
                  <div className="h-4 w-48 bg-neutral-200 rounded mb-2" />
                  <div className="h-3 w-32 bg-neutral-100 rounded" />
                </div>
                <div className="h-6 w-16 bg-neutral-100 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
