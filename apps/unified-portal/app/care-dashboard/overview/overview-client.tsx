'use client';

import { useState, useEffect } from 'react';
import {
  Sun,
  CheckCircle,
  MessageCircle,
  Layers,
  PhoneOff,
  DollarSign,
  ChevronRight,
  AlertTriangle,
  Info,
  Clock,
  Inbox,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OverviewProps {
  totalInstallations: number;
  portalActive: number;
  queriesThisWeek: number;
  aiResolved: number;
  openEscalations: number;
  recentActivity: Array<{ query_text: string; created_at: string; customer_name: string; escalated: boolean; resolved: boolean }>;
  topIssues: Array<{ category: string; count: number }>;
  error?: string;
}

interface StatCard {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  detail: string;
  trend?: string;
}

interface AttentionItem {
  severity: 'critical' | 'warning' | 'info';
  message: string;
}

interface TopIssue {
  label: string;
  count: number;
}

interface ActivityItem {
  dotColor: string;
  message: string;
  time: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const severityConfig: Record<
  AttentionItem['severity'],
  { borderColor: string; bg: string; icon: React.ComponentType<{ className?: string }>; iconColor: string; label: string; labelColor: string }
> = {
  critical: {
    borderColor: 'border-l-red-500',
    bg: 'bg-red-50/40',
    icon: AlertTriangle,
    iconColor: 'text-red-500',
    label: 'Critical',
    labelColor: 'text-red-600 bg-red-50',
  },
  warning: {
    borderColor: 'border-l-amber-500',
    bg: 'bg-amber-50/40',
    icon: AlertTriangle,
    iconColor: 'text-amber-500',
    label: 'Warning',
    labelColor: 'text-amber-600 bg-amber-50',
  },
  info: {
    borderColor: 'border-l-blue-500',
    bg: 'bg-blue-50/40',
    icon: Info,
    iconColor: 'text-blue-500',
    label: 'Info',
    labelColor: 'text-blue-600 bg-blue-50',
  },
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-IE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatCategoryLabel(category: string): string {
  return category
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CareOverviewClient(props: OverviewProps) {
  const {
    totalInstallations,
    portalActive,
    queriesThisWeek,
    aiResolved,
    openEscalations,
    recentActivity: recentActivityData,
    topIssues: topIssuesData,
    error,
  } = props;

  const [currentTime, setCurrentTime] = useState<string>('');
  const [roiOpen, setRoiOpen] = useState(false);
  const [calloutRate, setCalloutRate] = useState(50);
  const [avgCalloutCost, setAvgCalloutCost] = useState(150);

  useEffect(() => {
    setCurrentTime(formatTime(new Date()));
    const interval = setInterval(() => {
      setCurrentTime(formatTime(new Date()));
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Persist ROI assumptions in localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('care-roi-assumptions');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.calloutRate) setCalloutRate(parsed.calloutRate);
        if (parsed.avgCalloutCost) setAvgCalloutCost(parsed.avgCalloutCost);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('care-roi-assumptions', JSON.stringify({ calloutRate, avgCalloutCost }));
    } catch {}
  }, [calloutRate, avgCalloutCost]);

  // Build stat cards from props
  const aiResolvedPercent = queriesThisWeek > 0 ? Math.round((aiResolved / queriesThisWeek) * 100) : 0;
  const activationRate = totalInstallations > 0 ? Math.round((portalActive / totalInstallations) * 100) : 0;
  const avgPerDay = queriesThisWeek > 0 ? Math.round(queriesThisWeek / 7) : 0;

  const statCards: StatCard[] = [
    {
      label: 'Total Installations',
      value: totalInstallations.toLocaleString(),
      icon: Sun,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-500',
      detail: 'all time',
    },
    {
      label: 'Portal Active',
      value: portalActive.toLocaleString(),
      icon: CheckCircle,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-500',
      detail: `${activationRate}% activation rate`,
    },
    {
      label: 'Queries (7D)',
      value: queriesThisWeek.toLocaleString(),
      icon: MessageCircle,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-500',
      detail: `avg ${avgPerDay}/day`,
    },
    {
      label: 'Resolved by AI',
      value: `${aiResolvedPercent}%`,
      icon: Layers,
      iconBg: 'bg-violet-50',
      iconColor: 'text-violet-500',
      detail: `${aiResolved} of ${queriesThisWeek}`,
    },
    {
      label: 'Issues Resolved Without Contact',
      value: aiResolved.toLocaleString(),
      icon: PhoneOff,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-500',
      detail: 'this week',
    },
  ];

  // Build attention items from props
  const unactivatedPortals = totalInstallations - portalActive;
  const attentionItems: AttentionItem[] = [];
  if (openEscalations > 0) {
    attentionItems.push({ severity: 'critical', message: `${openEscalations} open escalation${openEscalations !== 1 ? 's' : ''} awaiting action` });
  }
  if (unactivatedPortals > 0) {
    attentionItems.push({ severity: 'info', message: `${unactivatedPortals} unactivated portal${unactivatedPortals !== 1 ? 's' : ''}` });
  }

  // Build top issues from props
  const topIssues: TopIssue[] = topIssuesData.map((i) => ({
    label: formatCategoryLabel(i.category),
    count: i.count,
  }));
  const maxIssueCount = topIssues.length > 0 ? Math.max(...topIssues.map((i) => i.count)) : 1;

  // Build recent activity from props
  const recentActivity: ActivityItem[] = recentActivityData.map((item) => ({
    dotColor: item.escalated ? 'bg-red-500' : item.resolved ? 'bg-emerald-500' : 'bg-blue-500',
    message: `${item.customer_name}: ${item.query_text}`,
    time: timeAgo(item.created_at),
  }));

  // Compute savings estimate from editable assumptions
  const savingsEstimate = Math.round(aiResolved * (calloutRate / 100) * avgCalloutCost);

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50/50 px-6 py-8 lg:px-10">
        <div className="mx-8 mt-6 rounded-xl border border-red-200 bg-red-50/60 p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-red-800">Error loading data</h3>
          <p className="text-xs text-red-600 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 px-6 py-8 lg:px-10">
      {/* ----------------------------------------------------------------- */}
      {/* Page Header                                                        */}
      {/* ----------------------------------------------------------------- */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight text-gray-900">
            Overview
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Monitor installations, support metrics, and team performance
          </p>
        </div>
        <div className="flex-shrink-0">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-500 shadow-sm">
            <Clock className="h-3.5 w-3.5 text-gray-400" />
            Last updated: Today, {currentTime || '--:--'}
          </span>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Stat Cards                                                         */}
      {/* ----------------------------------------------------------------- */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="group relative rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-px hover:shadow-md"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${card.iconBg}`}>
                  <Icon className={`h-[18px] w-[18px] ${card.iconColor}`} />
                </div>
                {card.trend && (
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                    {card.trend}
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold tracking-tight text-gray-900">
                {card.value}
              </p>
              <p className="mt-0.5 text-xs font-medium text-gray-500">
                {card.label}
              </p>
              <p className="mt-1 text-[11px] text-gray-400">{card.detail}</p>
            </div>
          );
        })}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* ROI Calculator Banner                                              */}
      {/* ----------------------------------------------------------------- */}
      <div className="mb-6 rounded-xl border border-emerald-500/[0.12] bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-500 shadow-sm">
            <DollarSign className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-500">
              Estimated Savings This Week
            </p>
            <p className="mt-1 text-4xl font-black text-emerald-800">
              &euro;{savingsEstimate.toLocaleString()}
            </p>
            <p className="mt-1 text-sm text-emerald-700/70">
              {aiResolved} issues resolved &times; {calloutRate}% callout rate &times; &euro;{avgCalloutCost} avg cost
            </p>
          </div>
          <div className="flex-shrink-0">
            <button
              type="button"
              onClick={() => setRoiOpen(!roiOpen)}
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white/80 px-4 py-2 text-sm font-medium text-emerald-700 shadow-sm transition-all hover:bg-white hover:shadow-md"
            >
              {roiOpen ? 'Close' : 'Edit assumptions'}
              <ChevronRight className={`h-4 w-4 transition-transform ${roiOpen ? 'rotate-90' : ''}`} />
            </button>
          </div>
        </div>
        {roiOpen && (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3 border-t border-emerald-200/50 pt-4">
            <div>
              <label className="block text-xs font-semibold text-emerald-600 mb-1">Issues resolved (read-only)</label>
              <div className="rounded-lg border border-emerald-200 bg-white/60 px-3 py-2 text-sm font-semibold text-emerald-800">{aiResolved}</div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-emerald-600 mb-1">% that would be callouts</label>
              <input
                type="number"
                min={0}
                max={100}
                value={calloutRate}
                onChange={(e) => setCalloutRate(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-800 outline-none focus:ring-2 focus:ring-emerald-300"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-emerald-600 mb-1">Average callout cost (&euro;)</label>
              <input
                type="number"
                min={0}
                value={avgCalloutCost}
                onChange={(e) => setAvgCalloutCost(Math.max(0, Number(e.target.value) || 0))}
                className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-800 outline-none focus:ring-2 focus:ring-emerald-300"
              />
            </div>
          </div>
        )}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Two-column: Needs Attention + Top Issues                           */}
      {/* ----------------------------------------------------------------- */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Needs Attention */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Needs Attention</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {attentionItems.length === 0 ? (
              <div className="px-5 py-6 text-center">
                <CheckCircle className="mx-auto h-6 w-6 text-emerald-400 mb-1" />
                <p className="text-sm text-gray-500">Nothing needs attention right now</p>
              </div>
            ) : (
              attentionItems.map((item) => {
                const config = severityConfig[item.severity];
                const SeverityIcon = config.icon;
                return (
                  <button
                    key={item.message}
                    type="button"
                    className={`flex w-full items-center gap-3 border-l-[3px] px-5 py-4 text-left transition-colors hover:bg-gray-50 ${config.borderColor}`}
                  >
                    <SeverityIcon className={`h-4 w-4 flex-shrink-0 ${config.iconColor}`} />
                    <span className="flex-1 text-sm text-gray-700">{item.message}</span>
                    <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${config.labelColor}`}>
                      {config.label}
                    </span>
                    <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-300" />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Top Issues This Week */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Top Issues This Week</h2>
          </div>
          <div className="space-y-3 p-5">
            {topIssues.length === 0 ? (
              <div className="py-4 text-center">
                <Inbox className="mx-auto h-6 w-6 text-gray-300 mb-1" />
                <p className="text-sm text-gray-500">No issues recorded yet</p>
              </div>
            ) : (
              topIssues.map((issue) => {
                const widthPercent = Math.round((issue.count / maxIssueCount) * 100);
                return (
                  <div key={issue.label}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm text-gray-700">{issue.label}</span>
                      <span className="text-xs font-semibold text-gray-500">
                        {issue.count}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${widthPercent}%`,
                          background: 'linear-gradient(90deg, #D4AF37, #e8c94b)',
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Recent Activity Feed                                               */}
      {/* ----------------------------------------------------------------- */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Recent Activity</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {recentActivity.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <Inbox className="mx-auto h-6 w-6 text-gray-300 mb-1" />
              <p className="text-sm text-gray-500">No recent activity</p>
            </div>
          ) : (
            recentActivity.map((item, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-gray-50/60"
              >
                <span
                  className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${item.dotColor}`}
                  aria-hidden="true"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700">{item.message}</p>
                </div>
                <span className="flex-shrink-0 whitespace-nowrap text-xs text-gray-400">
                  {item.time}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
