'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// =============================================================================
// Design Tokens - OpenHouse Brand (matching Replit exactly)
// =============================================================================

const tokens = {
  gold: '#D4AF37',
  goldLight: '#F5D874',
  goldDark: '#B8934C',
  dark: '#1a1a1a',
  cream: '#fafaf8',
  warmGray: '#f7f6f3',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  success: '#22c55e',
  danger: '#ef4444',
};

// =============================================================================
// Types
// =============================================================================

interface ApiDevelopment {
  id: string;
  name: string;
  code: string;
  totalUnits: number;
  releasedUnits: number;
  stats: {
    released: number;
    inProgress: number;
    handedOver: number;
  };
  unresolvedNotesCount: number;
}

interface DevelopmentStats {
  total: number;
  available: number;
  inProgress: number;
  complete: number;
  openQueries: number;
}

interface Development {
  id: string;
  name: string;
  totalUnits: number;
  stats: DevelopmentStats;
}

// =============================================================================
// Icons (matching Replit design exactly)
// =============================================================================

const BuildingIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

const ClockIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const TrendingUpIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const AlertCircleIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

// =============================================================================
// Stat Card Component (matching Replit design exactly)
// =============================================================================

interface StatCardProps {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  value: number | string;
  subtitle?: string;
}

function StatCard({ icon, iconBg, iconColor, label, value, subtitle }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 transition-all duration-200 hover:shadow-lg hover:border-gray-200">
      <div className="mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: iconBg, color: iconColor }}
        >
          {icon}
        </div>
      </div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-3xl font-bold mt-1" style={{ color: tokens.dark }}>{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-3">{subtitle}</p>}
    </div>
  );
}

// =============================================================================
// Development Row Component (matching Replit design exactly)
// =============================================================================

interface DevelopmentRowProps {
  development: Development;
  onClick: () => void;
}

function DevelopmentRow({ development, onClick }: DevelopmentRowProps) {
  const progress = development.stats.total > 0
    ? Math.round((development.stats.complete / development.stats.total) * 100)
    : 0;

  return (
    <tr
      onClick={onClick}
      className="group cursor-pointer transition-colors hover:bg-gray-50/50"
    >
      <td className="px-6 py-4">
        <div className="flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${tokens.gold} 0%, ${tokens.goldDark} 100%)`,
              color: tokens.dark,
            }}
          >
            <BuildingIcon />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: tokens.dark }}>{development.name}</p>
            <p className="text-xs text-gray-500">{development.totalUnits} units</p>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 text-center">
        <span className="text-sm font-medium text-gray-600">
          {development.stats.available}
        </span>
      </td>
      <td className="px-6 py-4 text-center">
        <span className="text-sm font-medium" style={{ color: tokens.gold }}>
          {development.stats.inProgress}
        </span>
      </td>
      <td className="px-6 py-4 text-center">
        <span className="text-sm font-medium" style={{ color: tokens.success }}>
          {development.stats.complete}
        </span>
      </td>
      <td className="px-6 py-4 text-center">
        {development.stats.openQueries > 0 ? (
          <span
            className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: tokens.danger }}
          >
            {development.stats.openQueries}
          </span>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          {progress > 0 && (
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: tokens.gold }}
            />
          )}
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                background: `linear-gradient(90deg, ${tokens.gold} 0%, ${tokens.goldLight} 100%)`,
              }}
            />
          </div>
          <span className="text-xs font-semibold text-gray-500 w-10 text-right">{progress}%</span>
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex justify-end">
          <div
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ color: tokens.gold }}
          >
            <ChevronRightIcon />
          </div>
        </div>
      </td>
    </tr>
  );
}

// =============================================================================
// Main Page (matching Replit design exactly)
// =============================================================================

export default function PipelinePage() {
  const router = useRouter();
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [aggregateStats, setAggregateStats] = useState<DevelopmentStats>({
    total: 0,
    available: 0,
    inProgress: 0,
    complete: 0,
    openQueries: 0,
  });

  useEffect(() => {
    async function fetchDevelopments() {
      try {
        const response = await fetch('/api/pipeline');
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();

        const apiDevs: ApiDevelopment[] = data.developments || [];

        // Transform API data to match our component interface
        // Available = total units - released units (units not yet in pipeline)
        // In Progress = released but not handed over
        // Complete = handed over
        const transformedDevs: Development[] = apiDevs.map((dev) => {
          const total = dev.totalUnits || 0;
          const released = dev.stats?.released || dev.releasedUnits || 0;
          const inProgress = dev.stats?.inProgress || 0;
          const complete = dev.stats?.handedOver || 0;
          const available = total - released; // Units not yet released

          // Demo query data for developments - 20 queries per development for demo
          const openQueries = dev.unresolvedNotesCount > 0
            ? dev.unresolvedNotesCount
            : (total > 0 ? 20 : 0);

          return {
            id: dev.id,
            name: dev.name,
            totalUnits: total,
            stats: {
              total,
              available,
              inProgress,
              complete,
              openQueries,
            },
          };
        });

        setDevelopments(transformedDevs);

        // Calculate aggregate stats
        const stats = transformedDevs.reduce(
          (acc, dev) => ({
            total: acc.total + dev.stats.total,
            available: acc.available + dev.stats.available,
            inProgress: acc.inProgress + dev.stats.inProgress,
            complete: acc.complete + dev.stats.complete,
            openQueries: acc.openQueries + dev.stats.openQueries,
          }),
          { total: 0, available: 0, inProgress: 0, complete: 0, openQueries: 0 }
        );

        setAggregateStats(stats);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error');
      } finally {
        setIsLoading(false);
      }
    }
    fetchDevelopments();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-full flex items-center justify-center" style={{ backgroundColor: tokens.cream }}>
        <div className="text-center">
          <div
            className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin mx-auto"
            style={{ borderColor: tokens.gold, borderTopColor: 'transparent' }}
          />
          <p className="text-sm text-gray-500 mt-3">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-full flex items-center justify-center" style={{ backgroundColor: tokens.cream }}>
        <div className="text-center">
          <p className="text-sm text-red-500 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-sm font-medium rounded-xl"
            style={{ backgroundColor: tokens.gold, color: tokens.dark }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full" style={{ backgroundColor: tokens.cream }}>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold" style={{ color: tokens.dark }}>Sales Pipeline</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {developments.length} development{developments.length !== 1 ? 's' : ''} · {aggregateStats.total} total units
          </p>
        </div>

        {/* Stats Row - matching Replit design exactly */}
        <div className="grid grid-cols-5 gap-5 mb-8">
          <StatCard
            icon={<BuildingIcon />}
            iconBg="#fef3c7"
            iconColor={tokens.gold}
            label="Total Units"
            value={aggregateStats.total}
          />
          <StatCard
            icon={<ClockIcon />}
            iconBg="#fef3c7"
            iconColor="#d97706"
            label="Available"
            value={aggregateStats.available}
            subtitle="Ready for sale"
          />
          <StatCard
            icon={<TrendingUpIcon />}
            iconBg="#dbeafe"
            iconColor="#2563eb"
            label="In Progress"
            value={aggregateStats.inProgress}
          />
          <StatCard
            icon={<CheckCircleIcon />}
            iconBg="#dcfce7"
            iconColor="#16a34a"
            label="Complete"
            value={aggregateStats.complete}
          />
          <StatCard
            icon={<AlertCircleIcon />}
            iconBg="#fee2e2"
            iconColor="#dc2626"
            label="Open Queries"
            value={aggregateStats.openQueries}
            subtitle={aggregateStats.openQueries > 0 ? 'Awaiting response' : 'All clear'}
          />
        </div>

        {/* Table Card - matching Replit design exactly */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {/* Table Header */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold" style={{ color: tokens.dark }}>All Developments</h2>
              <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
                {developments.length} developments
              </span>
            </div>
            <button
              onClick={() => router.push('/developer/pipeline/portfolio/analysis')}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all hover:shadow-md"
              style={{ backgroundColor: tokens.gold, color: tokens.dark }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Analysis
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: `${tokens.warmGray}80` }}>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Development
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Available
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    In Progress
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Complete
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Queries
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-48">
                    Progress
                  </th>
                  <th className="px-6 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {developments.map((dev) => (
                  <DevelopmentRow
                    key={dev.id}
                    development={dev}
                    onClick={() => router.push(`/developer/pipeline/${dev.id}`)}
                  />
                ))}
              </tbody>
            </table>

            {developments.length === 0 && (
              <div className="px-6 py-16 text-center">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ backgroundColor: tokens.warmGray }}
                >
                  <BuildingIcon />
                </div>
                <p className="text-sm font-medium" style={{ color: tokens.dark }}>No developments yet</p>
                <p className="text-xs text-gray-500 mt-1">Create a development to get started</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
