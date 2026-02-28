'use client';

import {
  Layers,
  Users,
  CheckCircle,
  PhoneForwarded,
  AlertTriangle,
  ZapOff,
  MonitorOff,
  Volume2,
  Receipt,
  Plus,
  Lightbulb,
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
  detail?: string;
}

interface FlowCard {
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  iconGradientFrom: string;
  iconGradientTo: string;
  iconColor: string;
  badge: string;
  badgeBg: string;
  badgeText: string;
  started: number;
  resolved: string;
  steps: number;
}

interface Insight {
  text: string;
}

// ---------------------------------------------------------------------------
// Static demo data
// ---------------------------------------------------------------------------

const statCards: StatCard[] = [
  {
    label: 'Active Flows',
    value: '5',
    icon: Layers,
    iconBg: 'bg-[#D4AF37]/10',
    iconColor: 'text-[#D4AF37]',
  },
  {
    label: 'Customers Used',
    value: '847',
    icon: Users,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-500',
    detail: 'lifetime completions',
  },
  {
    label: 'Self-Resolved',
    value: '78%',
    icon: CheckCircle,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-500',
  },
  {
    label: 'Escalated',
    value: '22%',
    icon: PhoneForwarded,
    iconBg: 'bg-red-50',
    iconColor: 'text-red-500',
  },
];

const flowCards: FlowCard[] = [
  {
    name: 'Inverter Error Light',
    description:
      'Guides customer through AC isolator check, restart procedure, and escalation.',
    icon: AlertTriangle,
    iconGradientFrom: 'from-red-100',
    iconGradientTo: 'to-red-200',
    iconColor: 'text-red-600',
    badge: 'Live',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-800',
    started: 342,
    resolved: '81%',
    steps: 3,
  },
  {
    name: 'No Power Generating',
    description:
      'Walks customer through meter check, inverter status, and generation troubleshooting steps.',
    icon: ZapOff,
    iconGradientFrom: 'from-amber-100',
    iconGradientTo: 'to-amber-200',
    iconColor: 'text-amber-600',
    badge: 'Live',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-800',
    started: 218,
    resolved: '72%',
    steps: 5,
  },
  {
    name: 'Display Not Responding',
    description:
      'Helps diagnose unresponsive inverter display with reset instructions and firmware guidance.',
    icon: MonitorOff,
    iconGradientFrom: 'from-blue-100',
    iconGradientTo: 'to-blue-200',
    iconColor: 'text-blue-600',
    badge: 'Live',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-800',
    started: 156,
    resolved: '85%',
    steps: 4,
  },
  {
    name: 'Unusual Noise',
    description:
      'Guides customer through identifying noise source, checking fan operation, and documenting the issue.',
    icon: Volume2,
    iconGradientFrom: 'from-violet-100',
    iconGradientTo: 'to-violet-200',
    iconColor: 'text-violet-600',
    badge: 'Live',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-800',
    started: 89,
    resolved: '64%',
    steps: 4,
  },
  {
    name: 'Energy Bill Concerns',
    description:
      'Helps customer compare expected vs actual savings with generation data and usage tips.',
    icon: Receipt,
    iconGradientFrom: 'from-emerald-100',
    iconGradientTo: 'to-emerald-200',
    iconColor: 'text-emerald-600',
    badge: 'Live',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-800',
    started: 42,
    resolved: '91%',
    steps: 3,
  },
];

const performanceData = [
  { name: 'Inverter Error Light', rate: 81 },
  { name: 'No Power Generating', rate: 72 },
  { name: 'Display Not Responding', rate: 85 },
  { name: 'Unusual Noise', rate: 64 },
  { name: 'Energy Bill Concerns', rate: 91 },
];

const insights: Insight[] = [
  {
    text: 'Energy Bill Concerns has the highest resolution rate at 91% \u2014 customers find it very helpful',
  },
  {
    text: 'Unusual Noise has the lowest resolution rate at 64% \u2014 consider adding audio recording step',
  },
  {
    text: '342 customers have used Inverter Error Light \u2014 your most popular flow',
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DiagnosticFlowsClient() {
  return (
    <div className="min-h-screen bg-gray-50/50 px-6 py-8 lg:px-10">
      {/* ----------------------------------------------------------------- */}
      {/* Page Header                                                        */}
      {/* ----------------------------------------------------------------- */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight text-gray-900">
            Diagnostic Flows
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage self-service troubleshooting flows for customers
          </p>
        </div>
        <div className="flex-shrink-0">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-[#D4AF37] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#c5a132] hover:shadow-md"
          >
            <Plus className="h-4 w-4" />
            Create New Flow
          </button>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Stat Cards                                                         */}
      {/* ----------------------------------------------------------------- */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="group relative rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-px hover:shadow-md"
            >
              <div className="mb-3 flex items-center justify-between">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-lg ${card.iconBg}`}
                >
                  <Icon className={`h-[18px] w-[18px] ${card.iconColor}`} />
                </div>
              </div>
              <p className="text-2xl font-bold tracking-tight text-gray-900">
                {card.value}
              </p>
              <p className="mt-0.5 text-xs font-medium text-gray-500">
                {card.label}
              </p>
              {card.detail && (
                <p className="mt-1 text-[11px] text-gray-400">{card.detail}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Flow Cards Grid                                                    */}
      {/* ----------------------------------------------------------------- */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {flowCards.map((flow) => {
          const Icon = flow.icon;
          return (
            <div
              key={flow.name}
              className="group relative cursor-pointer overflow-hidden rounded-xl border border-gray-200 bg-white p-[22px] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#D4AF37] hover:shadow-md"
            >
              {/* Gold gradient overlay on hover */}
              <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-[#D4AF37]/0 to-[#D4AF37]/0 transition-all duration-200 group-hover:from-[#D4AF37]/[0.02] group-hover:to-[#D4AF37]/[0.06]" />

              <div className="relative">
                {/* Icon + Badge Row */}
                <div className="mb-3 flex items-start justify-between">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${flow.iconGradientFrom} ${flow.iconGradientTo}`}
                  >
                    <Icon className={`h-5 w-5 ${flow.iconColor}`} />
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${flow.badgeBg} ${flow.badgeText}`}
                  >
                    {flow.badge}
                  </span>
                </div>

                {/* Name + Description */}
                <h3 className="font-bold text-gray-900">{flow.name}</h3>
                <p className="mt-1 text-sm leading-relaxed text-gray-500">
                  {flow.description}
                </p>

                {/* Stats Row */}
                <div className="mt-4 flex items-center gap-4 border-t border-gray-100 pt-3">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-semibold text-gray-700">
                      {flow.started}
                    </span>
                    <span className="text-[11px] text-gray-400">started</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-semibold text-gray-700">
                      {flow.resolved}
                    </span>
                    <span className="text-[11px] text-gray-400">resolved</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-semibold text-gray-700">
                      {flow.steps}
                    </span>
                    <span className="text-[11px] text-gray-400">steps</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Create New Flow Card */}
        <div className="group flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white p-[22px] transition-all duration-200 hover:border-[#D4AF37] hover:text-[#D4AF37]">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 transition-colors group-hover:bg-[#D4AF37]/10">
            <Plus className="h-6 w-6 text-gray-400 transition-colors group-hover:text-[#D4AF37]" />
          </div>
          <p className="mt-3 text-sm font-semibold text-gray-500 transition-colors group-hover:text-[#D4AF37]">
            Create New Flow
          </p>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Flow Performance Panel                                             */}
      {/* ----------------------------------------------------------------- */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-6 text-base font-semibold text-gray-900">
          Flow Performance
        </h2>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Left: Resolution by Flow */}
          <div>
            <h3 className="mb-4 text-sm font-semibold text-gray-700">
              Resolution by Flow
            </h3>
            <div className="space-y-4">
              {performanceData.map((item) => (
                <div key={item.name}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-sm text-gray-700">{item.name}</span>
                    <span className="text-xs font-semibold text-gray-500">
                      {item.rate}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${item.rate}%`,
                        background:
                          'linear-gradient(90deg, #D4AF37, #e8c94b)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Insights */}
          <div>
            <h3 className="mb-4 text-sm font-semibold text-gray-700">
              Insights
            </h3>
            <div className="space-y-3">
              {insights.map((insight, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 rounded-lg bg-gray-50 p-3.5"
                >
                  <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                  <p className="text-sm leading-relaxed text-gray-600">
                    {insight.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
