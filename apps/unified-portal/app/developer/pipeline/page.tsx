'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// =============================================================================
// Design Tokens - OpenHouse Brand
// =============================================================================

const tokens = {
  // Brand Colors
  gold: '#D4AF37',
  goldLight: '#F5D874',
  goldDark: '#B8934C',
  dark: '#1a1a1a',
  darker: '#0f0f0f',
  cream: '#fafaf8',
  warmGray: '#f7f6f3',

  // Text
  textPrimary: '#1a1a1a',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',

  // Status
  success: '#22c55e',
  warning: '#f97316',
  danger: '#ef4444',

  // Borders
  border: 'rgba(0,0,0,0.05)',
  borderLight: '#e5e7eb',
};

// =============================================================================
// Types
// =============================================================================

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
  code: string;
  totalUnits: number;
  stats: DevelopmentStats;
}

// =============================================================================
// Icons
// =============================================================================

const BuildingIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
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

const AlertIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const ClockIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

// =============================================================================
// Sparkline Component
// =============================================================================

function Sparkline({ color = tokens.gold }: { color?: string }) {
  return (
    <svg viewBox="0 0 100 30" className="w-full h-8">
      <path
        d="M0,25 Q20,20 40,22 T60,18 T80,15 T100,10"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        style={{
          strokeDasharray: 100,
          strokeDashoffset: 0,
          animation: 'drawLine 1.2s ease forwards',
        }}
      />
    </svg>
  );
}

// =============================================================================
// Stat Card Component
// =============================================================================

interface StatCardProps {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: number | string;
  badge?: { text: string; color: string };
  subtitle?: string;
  sparkline?: boolean;
  sparklineColor?: string;
}

function StatCard({ icon, iconBg, label, value, badge, subtitle, sparkline, sparklineColor }: StatCardProps) {
  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 p-5 transition-all duration-200 hover:-translate-y-0.5"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: iconBg }}
        >
          {icon}
        </div>
        {badge && (
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ backgroundColor: `${badge.color}15`, color: badge.color }}
          >
            {badge.text}
          </span>
        )}
      </div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-3xl font-bold mt-1" style={{ color: tokens.dark }}>{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-4">{subtitle}</p>}
      {sparkline && (
        <div className="mt-4 h-8">
          <Sparkline color={sparklineColor} />
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Development Row Component
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
      className="group cursor-pointer transition-all duration-150"
      style={{
        background: 'linear-gradient(90deg, #ffffff 0%, #ffffff 100%)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'linear-gradient(90deg, #fdfcfa 0%, #ffffff 100%)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'linear-gradient(90deg, #ffffff 0%, #ffffff 100%)';
      }}
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
        <span className="text-sm font-medium" style={{ color: tokens.textSecondary }}>
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
            className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold text-white"
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
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                background: `linear-gradient(90deg, ${tokens.gold} 0%, ${tokens.goldLight} 100%)`,
              }}
            />
          </div>
          <span className="text-xs font-semibold text-gray-500 w-8">{progress}%</span>
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex justify-end">
          <div
            className="opacity-0 group-hover:opacity-100 transform translate-x-1 group-hover:translate-x-0 transition-all"
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
// Main Page
// =============================================================================

export default function PipelinePage() {
  const router = useRouter();
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Aggregate stats
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

        const devs = data.developments || [];
        setDevelopments(devs);

        // Calculate aggregate stats
        const stats = devs.reduce((acc: DevelopmentStats, dev: Development) => ({
          total: acc.total + (dev.stats?.total || dev.totalUnits || 0),
          available: acc.available + (dev.stats?.available || 0),
          inProgress: acc.inProgress + (dev.stats?.inProgress || 0),
          complete: acc.complete + (dev.stats?.complete || 0),
          openQueries: acc.openQueries + (dev.stats?.openQueries || 0),
        }), { total: 0, available: 0, inProgress: 0, complete: 0, openQueries: 0 });

        setAggregateStats(stats);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error');
      } finally {
        setIsLoading(false);
      }
    }
    fetchDevelopments();
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: tokens.cream, fontFamily: "'DM Sans', sans-serif" }}>
        <style jsx global>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');`}</style>
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

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: tokens.cream, fontFamily: "'DM Sans', sans-serif" }}>
        <style jsx global>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');`}</style>
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
    <div className="min-h-screen" style={{ backgroundColor: tokens.cream, fontFamily: "'DM Sans', sans-serif" }}>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        @keyframes drawLine {
          from { stroke-dashoffset: 100; }
          to { stroke-dashoffset: 0; }
        }
      `}</style>

      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: tokens.dark }}>Sales Pipeline</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {developments.length} development{developments.length !== 1 ? 's' : ''} · {aggregateStats.total} total units
            </p>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-5 gap-5 mb-8">
          <StatCard
            icon={<BuildingIcon />}
            iconBg={tokens.warmGray}
            label="Total Units"
            value={aggregateStats.total}
            sparkline
            sparklineColor={tokens.gold}
          />
          <StatCard
            icon={<ClockIcon />}
            iconBg="#fef3c7"
            label="Available"
            value={aggregateStats.available}
            subtitle="Ready for sale"
          />
          <StatCard
            icon={<TrendingUpIcon />}
            iconBg="#e0f2fe"
            label="In Progress"
            value={aggregateStats.inProgress}
            badge={{ text: '↑ 12%', color: tokens.success }}
            subtitle="vs last month"
          />
          <StatCard
            icon={<CheckCircleIcon />}
            iconBg="#dcfce7"
            label="Complete"
            value={aggregateStats.complete}
            sparkline
            sparklineColor={tokens.success}
          />
          <StatCard
            icon={<AlertIcon />}
            iconBg="#fee2e2"
            label="Open Queries"
            value={aggregateStats.openQueries}
            badge={aggregateStats.openQueries > 0 ? { text: `${Math.min(aggregateStats.openQueries, 3)} urgent`, color: tokens.danger } : undefined}
            subtitle={aggregateStats.openQueries > 0 ? 'Awaiting response' : 'All clear'}
          />
        </div>

        {/* Table Card */}
        <div
          className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
        >
          {/* Table Header */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold" style={{ color: tokens.dark }}>All Developments</h2>
              <span
                className="text-xs px-2.5 py-1 rounded-full"
                style={{ backgroundColor: tokens.warmGray, color: tokens.textMuted }}
              >
                {developments.length} developments
              </span>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: `${tokens.warmGray}80` }}>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Development
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Available
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    In Progress
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Complete
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Queries
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider w-40">
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
