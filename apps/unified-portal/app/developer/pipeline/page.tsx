'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Building2,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

interface DevelopmentStats {
  released: number;
  inProgress: number;
  handedOver: number;
}

interface Development {
  id: string;
  name: string;
  code: string;
  address: string;
  isActive: boolean;
  totalUnits: number;
  releasedUnits: number;
  stats: DevelopmentStats;
  hasUnresolvedNotes: boolean;
  unresolvedNotesCount: number;
}

export default function PipelinePage() {
  const router = useRouter();
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDevelopments() {
      try {
        const response = await fetch('/api/pipeline');
        if (!response.ok) {
          throw new Error('Failed to fetch developments');
        }
        const data = await response.json();
        setDevelopments(data.developments || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    }

    fetchDevelopments();
  }, []);

  const handleRowClick = (developmentId: string) => {
    router.push(`/developer/pipeline/${developmentId}`);
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="min-h-full bg-[#F8FAFC]">
        <div className="p-6 lg:p-8">
          <div className="max-w-5xl mx-auto">
            {/* Header skeleton */}
            <div className="mb-8">
              <div className="h-7 w-40 bg-neutral-200 rounded animate-pulse mb-2" />
              <div className="h-4 w-64 bg-neutral-200 rounded animate-pulse" />
            </div>

            {/* Table skeleton */}
            <div className="bg-white rounded-lg border border-[#E2E8F0] overflow-hidden">
              <div className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
                <div className="h-4 w-24 bg-neutral-200 rounded animate-pulse" />
              </div>
              {[...Array(5)].map((_, i) => (
                <div key={i} className="px-4 py-4 border-b border-[#E2E8F0] last:border-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-neutral-200 rounded animate-pulse" />
                      <div>
                        <div className="h-4 w-32 bg-neutral-200 rounded animate-pulse mb-2" />
                        <div className="h-3 w-48 bg-neutral-200 rounded animate-pulse" />
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="h-4 w-16 bg-neutral-200 rounded animate-pulse" />
                      <div className="h-4 w-16 bg-neutral-200 rounded animate-pulse" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-full bg-[#F8FAFC] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-[#475569] text-sm">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 text-sm font-medium text-white bg-[#0EA5E9] rounded-lg hover:bg-[#0284C7] transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (developments.length === 0) {
    return (
      <div className="min-h-full bg-[#F8FAFC]">
        <div className="p-6 lg:p-8">
          <div className="max-w-5xl mx-auto">
            <div className="mb-8">
              <h1 className="text-xl font-semibold text-[#0F172A]">Sales Pipeline</h1>
              <p className="text-sm text-[#475569] mt-1">
                Track every unit from release to handover
              </p>
            </div>

            <div className="bg-white rounded-lg border border-[#E2E8F0] p-12 text-center">
              <Building2 className="w-10 h-10 text-[#94A3B8] mx-auto mb-3" />
              <p className="text-sm text-[#475569]">No developments found.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#F8FAFC]">
      <div className="p-6 lg:p-8">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-xl font-semibold text-[#0F172A]">Sales Pipeline</h1>
            <p className="text-sm text-[#475569] mt-1">
              Track every unit from release to handover
            </p>
          </div>

          {/* Development List */}
          <div className="bg-white rounded-lg border border-[#E2E8F0] overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-[1fr,100px,100px,100px,32px] gap-4 px-4 py-3 border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <div className="text-xs font-medium text-[#475569] uppercase tracking-wide">
                Development
              </div>
              <div className="text-xs font-medium text-[#475569] uppercase tracking-wide text-right">
                Released
              </div>
              <div className="text-xs font-medium text-[#475569] uppercase tracking-wide text-right">
                In Progress
              </div>
              <div className="text-xs font-medium text-[#475569] uppercase tracking-wide text-right">
                Handed Over
              </div>
              <div />
            </div>

            {/* Development Rows */}
            {developments.map((dev) => (
              <button
                key={dev.id}
                onClick={() => handleRowClick(dev.id)}
                className={cn(
                  'w-full grid grid-cols-[1fr,100px,100px,100px,32px] gap-4 px-4 py-4',
                  'border-b border-[#E2E8F0] last:border-0',
                  'hover:bg-[#F1F5F9] transition-colors text-left',
                  'focus:outline-none focus:bg-[#F1F5F9]'
                )}
              >
                {/* Development Info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#F1F5F9] flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-[#475569]" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-[#0F172A] truncate">
                        {dev.name}
                      </p>
                      {dev.hasUnresolvedNotes && (
                        <span className="flex-shrink-0 flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[#EF4444] text-white text-[11px] font-semibold">
                          {dev.unresolvedNotesCount}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#94A3B8] truncate">
                      {dev.totalUnits} total units
                      {dev.code && ` · ${dev.code}`}
                    </p>
                  </div>
                </div>

                {/* Released */}
                <div className="flex items-center justify-end">
                  <span className="text-sm font-medium text-[#0F172A]">
                    {dev.stats.released}
                  </span>
                </div>

                {/* In Progress */}
                <div className="flex items-center justify-end">
                  <span className="text-sm font-medium text-[#0EA5E9]">
                    {dev.stats.inProgress}
                  </span>
                </div>

                {/* Handed Over */}
                <div className="flex items-center justify-end">
                  {dev.stats.handedOver > 0 ? (
                    <span className="flex items-center gap-1 text-sm font-medium text-[#047857]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {dev.stats.handedOver}
                    </span>
                  ) : (
                    <span className="text-sm text-[#94A3B8]">—</span>
                  )}
                </div>

                {/* Chevron */}
                <div className="flex items-center justify-center">
                  <ChevronRight className="w-4 h-4 text-[#94A3B8]" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
