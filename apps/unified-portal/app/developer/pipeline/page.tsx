'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Building2,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Home,
  Clock,
  TrendingUp,
  MessageSquare,
  Sparkles,
  BarChart3,
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

function ProgressRing({ percentage, size = 44 }: { percentage: number; size?: number }) {
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          className="text-grey-100"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className={cn(
            "transition-all duration-500",
            percentage === 100 ? "text-emerald-500" : percentage > 0 ? "text-gold-500" : "text-grey-200"
          )}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] font-semibold text-grey-700">{percentage}%</span>
      </div>
    </div>
  );
}

function StatBadge({ value, label, variant }: { value: number; label: string; variant: 'progress' | 'complete' | 'total' }) {
  const styles = {
    progress: 'bg-amber-50 text-amber-700 border-amber-200/50',
    complete: 'bg-emerald-50 text-emerald-700 border-emerald-200/50',
    total: 'bg-grey-50 text-grey-600 border-grey-200/50',
  };

  return (
    <div className={cn(
      "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium",
      styles[variant]
    )}>
      <span className="font-semibold">{value}</span>
      <span className="text-[10px] opacity-80">{label}</span>
    </div>
  );
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

  // Calculate totals
  const totals = developments.reduce(
    (acc, dev) => ({
      units: acc.units + dev.totalUnits,
      released: acc.released + dev.stats.released,
      inProgress: acc.inProgress + dev.stats.inProgress,
      completed: acc.completed + dev.stats.handedOver,
    }),
    { units: 0, released: 0, inProgress: 0, completed: 0 }
  );

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="min-h-full bg-gradient-to-br from-grey-50 to-white">
        <div className="p-6 lg:p-8">
          <div className="max-w-5xl mx-auto">
            {/* Header skeleton */}
            <div className="mb-8">
              <div className="h-8 w-48 bg-grey-200 rounded-lg animate-pulse mb-3" />
              <div className="h-4 w-72 bg-grey-100 rounded animate-pulse" />
            </div>

            {/* Stats skeleton */}
            <div className="grid grid-cols-4 gap-4 mb-8">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 bg-white rounded-xl border border-grey-100 animate-pulse" />
              ))}
            </div>

            {/* Table skeleton */}
            <div className="bg-white rounded-xl border border-grey-100 overflow-hidden shadow-sm">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="px-5 py-5 border-b border-grey-50 last:border-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-11 w-11 bg-grey-100 rounded-xl animate-pulse" />
                      <div>
                        <div className="h-5 w-40 bg-grey-200 rounded animate-pulse mb-2" />
                        <div className="h-3 w-56 bg-grey-100 rounded animate-pulse" />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-20 bg-grey-100 rounded-lg animate-pulse" />
                      <div className="h-8 w-20 bg-grey-100 rounded-lg animate-pulse" />
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
      <div className="min-h-full bg-gradient-to-br from-grey-50 to-white flex items-center justify-center">
        <div className="text-center p-8">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <p className="text-grey-600 text-sm mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-sm font-medium text-white bg-grey-900 rounded-lg hover:bg-grey-800 transition-colors"
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
      <div className="min-h-full bg-gradient-to-br from-grey-50 to-white">
        <div className="p-6 lg:p-8">
          <div className="max-w-5xl mx-auto">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-grey-900">Sales Pipeline</h1>
              <p className="text-sm text-grey-500 mt-1">
                Track every unit from release to handover
              </p>
            </div>

            <div className="bg-white rounded-xl border border-grey-100 p-16 text-center shadow-sm">
              <div className="w-16 h-16 rounded-full bg-grey-100 flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-8 h-8 text-grey-400" />
              </div>
              <p className="text-base font-medium text-grey-700 mb-2">No developments found</p>
              <p className="text-sm text-grey-500">
                Create a development to start tracking your sales pipeline
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-grey-50 to-white">
      <div className="p-6 lg:p-8">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-grey-900">Sales Pipeline</h1>
              <span className="px-2.5 py-1 rounded-full bg-gold-100 text-gold-700 text-xs font-semibold">
                {developments.length} Development{developments.length !== 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-sm text-grey-500">
              Track every unit from release to handover across all your developments
            </p>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl border border-grey-100 p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center">
                  <Home className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-grey-900">{totals.units}</p>
                  <p className="text-xs text-grey-500">Total Units</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-grey-100 p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-500 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-grey-900">{totals.released}</p>
                  <p className="text-xs text-grey-500">Released</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-grey-100 p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-grey-900">{totals.inProgress}</p>
                  <p className="text-xs text-grey-500">In Progress</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-grey-100 p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-grey-900">{totals.completed}</p>
                  <p className="text-xs text-grey-500">Completed</p>
                </div>
              </div>
            </div>
          </div>

          {/* Development List */}
          <div className="bg-white rounded-xl border border-grey-100 overflow-hidden shadow-sm">
            {/* Table Header */}
            <div className="px-5 py-3 border-b border-grey-100 bg-grey-50/80">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-grey-500 uppercase tracking-wider">
                  Developments
                </span>
                <div className="flex items-center gap-6 text-xs font-semibold text-grey-500 uppercase tracking-wider">
                  <span className="w-24 text-center">Progress</span>
                  <span className="w-20 text-right">In Progress</span>
                  <span className="w-20 text-right">Completed</span>
                  <span className="w-8" />
                </div>
              </div>
            </div>

            {/* Development Rows */}
            {developments.map((dev, index) => {
              const completionPercent = dev.totalUnits > 0
                ? Math.round((dev.stats.handedOver / dev.totalUnits) * 100)
                : 0;

              return (
                <button
                  key={dev.id}
                  onClick={() => handleRowClick(dev.id)}
                  className={cn(
                    'w-full flex items-center justify-between px-5 py-4',
                    'border-b border-grey-50 last:border-0',
                    'hover:bg-gold-50/30 transition-all text-left',
                    'focus:outline-none focus:bg-gold-50/30',
                    index % 2 === 1 && 'bg-grey-50/30'
                  )}
                >
                  {/* Development Info */}
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-grey-100 to-grey-50 flex items-center justify-center border border-grey-200/50">
                      <Building2 className="w-5 h-5 text-grey-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-grey-900 truncate">
                          {dev.name}
                        </p>
                        {!dev.isActive && (
                          <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-grey-100 text-grey-500">
                            Inactive
                          </span>
                        )}
                        {dev.hasUnresolvedNotes && (
                          <span className="flex-shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-semibold">
                            <MessageSquare className="w-3 h-3" />
                            {dev.unresolvedNotesCount}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-grey-500 truncate">
                          {dev.totalUnits} unit{dev.totalUnits !== 1 ? 's' : ''}
                        </p>
                        {dev.code && (
                          <>
                            <span className="text-grey-300">·</span>
                            <span className="text-xs text-grey-400 font-mono">{dev.code}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-6">
                    {/* Progress Ring */}
                    <div className="w-24 flex justify-center">
                      <ProgressRing percentage={completionPercent} />
                    </div>

                    {/* In Progress */}
                    <div className="w-20 text-right">
                      {dev.stats.inProgress > 0 ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 text-xs font-semibold border border-amber-200/50">
                          <Clock className="w-3 h-3" />
                          {dev.stats.inProgress}
                        </span>
                      ) : (
                        <span className="text-sm text-grey-300">—</span>
                      )}
                    </div>

                    {/* Completed */}
                    <div className="w-20 text-right">
                      {dev.stats.handedOver > 0 ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200/50">
                          <CheckCircle2 className="w-3 h-3" />
                          {dev.stats.handedOver}
                        </span>
                      ) : (
                        <span className="text-sm text-grey-300">—</span>
                      )}
                    </div>

                    {/* Chevron */}
                    <div className="w-8 flex justify-center">
                      <ChevronRight className="w-5 h-5 text-grey-300 group-hover:text-grey-500 transition-colors" />
                    </div>
                  </div>
                </button>
              );
            })}

            {/* Table Footer */}
            <div className="px-5 py-3 border-t border-grey-100 bg-grey-50/50 flex items-center justify-between">
              <p className="text-xs text-grey-500">
                Showing {developments.length} development{developments.length !== 1 ? 's' : ''}
              </p>
              <div className="flex items-center gap-1 text-xs text-grey-400">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Powered by OpenHouse AI</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
