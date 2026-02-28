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
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
// Static demo data
// ---------------------------------------------------------------------------

const statCards: StatCard[] = [
  {
    label: 'Total Installations',
    value: '1,247',
    icon: Sun,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-500',
    detail: 'all time',
  },
  {
    label: 'Portal Active',
    value: '943',
    icon: CheckCircle,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-500',
    detail: '76% activation rate',
    trend: '+12%',
  },
  {
    label: 'Queries (7D)',
    value: '284',
    icon: MessageCircle,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-500',
    detail: 'avg 41/day',
    trend: '+8%',
  },
  {
    label: 'Resolved by AI',
    value: '89%',
    icon: Layers,
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-500',
    detail: '253 of 284',
  },
  {
    label: 'Issues Resolved Without Contact',
    value: '253',
    icon: PhoneOff,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-500',
    detail: 'this month',
  },
];

const attentionItems: AttentionItem[] = [
  { severity: 'critical', message: '3 open escalations awaiting assignment' },
  { severity: 'warning', message: '12 firmware updates available' },
  { severity: 'info', message: '47 unactivated portals' },
];

const topIssues: TopIssue[] = [
  { label: 'Inverter Error Light', count: 42 },
  { label: 'Energy Bill Concerns', count: 31 },
  { label: 'No Power Generating', count: 28 },
  { label: 'Display Issues', count: 19 },
  { label: 'Unusual Noise', count: 12 },
];

const recentActivity: ActivityItem[] = [
  {
    dotColor: 'bg-emerald-500',
    message: 'Mary Murphy completed Inverter Error diagnostic \u2014 resolved',
    time: '14 min ago',
  },
  {
    dotColor: 'bg-blue-500',
    message: 'Colm Fitzgerald asked: What does the green light mean?',
    time: '32 min ago',
  },
  {
    dotColor: 'bg-red-500',
    message: 'Escalation #412 created \u2014 Siobh\u00e1n Kelleher inverter fault',
    time: '1 hour ago',
  },
  {
    dotColor: 'bg-emerald-500',
    message: 'P\u00e1draig O\u2019Sullivan activated Care portal',
    time: '2 hours ago',
  },
  {
    dotColor: 'bg-purple-500',
    message: 'Brendan Daly viewed: Solar Panel Cleaning Guide',
    time: '3 hours ago',
  },
];

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CareOverviewClient() {
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    setCurrentTime(formatTime(new Date()));
    const interval = setInterval(() => {
      setCurrentTime(formatTime(new Date()));
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const maxIssueCount = Math.max(...topIssues.map((i) => i.count));

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
              Estimated Savings This Month
            </p>
            <p className="mt-1 text-4xl font-black text-emerald-800">
              &euro;18,975
            </p>
            <p className="mt-1 text-sm text-emerald-700/70">
              253 issues resolved &times; 50% callout rate &times; &euro;150 avg cost
            </p>
          </div>
          <div className="flex-shrink-0">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white/80 px-4 py-2 text-sm font-medium text-emerald-700 shadow-sm transition-all hover:bg-white hover:shadow-md"
            >
              Edit assumptions
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
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
            {attentionItems.map((item) => {
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
            })}
          </div>
        </div>

        {/* Top Issues This Week */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Top Issues This Week</h2>
          </div>
          <div className="space-y-3 p-5">
            {topIssues.map((issue) => {
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
            })}
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
          {recentActivity.map((item, idx) => (
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
          ))}
        </div>
      </div>
    </div>
  );
}
