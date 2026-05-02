'use client';

import { useEffect, useState } from 'react';
import {
  MessageSquare, Sparkles, AlertTriangle, Clock, Smile,
  Thermometer, Sun, FileText, Battery, HelpCircle, ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { StatCard, StatCardGrid } from '@/components/ui/StatCard';

interface Pattern {
  icon: typeof Thermometer;
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
}

interface TopicRow {
  label: string;
  percentage: number;
}

interface KnowledgeGap {
  question: string;
  askedByCount: number;
  status: 'none' | 'partial';
  actions: Array<{ label: string; href: string; primary?: boolean }>;
}

const PATTERNS: Pattern[] = [
  {
    icon: Thermometer,
    title: 'Defrost cycle queries spiked on Mitsubishi Ecodan installs',
    description:
      '18 customers asked about defrost cycles in the last 30 days, 83% on Mitsubishi Ecodan systems installed between Oct 2025 and Jan 2026. Consider updating commissioning checklist or scheduling targeted customer education.',
    actionLabel: 'View affected installs',
    actionHref: '/care-dashboard/installations?filter=mitsubishi-ecodan',
  },
  {
    icon: Sun,
    title: 'Solar underperformance reports clustering in Douglas',
    description:
      '7 homeowners across Douglas (Willow Heights, Birch Lane, Ash Close) reported lower-than-expected November generation. Pattern suggests potential shading issue common to the area or seasonal tilt optimisation needed.',
    actionLabel: 'View cluster',
    actionHref: '/care-dashboard/installations?area=douglas',
  },
  {
    icon: FileText,
    title: 'BER certificate requests top the support queue',
    description:
      'BER cert requests account for 34% of all customer queries over the last 90 days. Strong candidate for automated delivery at handover rather than on-demand.',
    actionLabel: 'Automate BER delivery',
    actionHref: '/care-dashboard/communications?template=ber-automation',
  },
  {
    icon: Battery,
    title: 'Battery firmware query resolved by assistant 96% of the time',
    description:
      'The guided flow for Huawei LUNA2000 firmware update questions has a 96% first-response resolution rate. No installer callouts have been triggered from this topic in 60 days.',
    actionLabel: 'View flow',
    actionHref: '/care-dashboard/diagnostics?flow=huawei-luna2000-firmware',
  },
];

const TOP_TOPICS: TopicRow[] = [
  { label: 'BER Certificate Requests', percentage: 34 },
  { label: 'Inverter Error Codes', percentage: 18 },
  { label: 'Defrost Cycles', percentage: 12 },
  { label: 'Warranty Queries', percentage: 11 },
  { label: 'App Login Issues', percentage: 9 },
  { label: 'Performance Questions', percentage: 8 },
  { label: 'Other', percentage: 8 },
];

const KNOWLEDGE_GAPS: KnowledgeGap[] = [
  {
    question: 'Why does my heat pump sound louder in the morning?',
    askedByCount: 4,
    status: 'none',
    actions: [
      { label: 'Upload documentation', href: '/care-dashboard/archive', primary: true },
      { label: 'Create guided flow', href: '/care-dashboard/diagnostics' },
    ],
  },
  {
    question: 'Can I charge my EV from my solar panels only?',
    askedByCount: 6,
    status: 'partial',
    actions: [{ label: 'Refine answer', href: '/care-dashboard/archive', primary: true }],
  },
];

function buildWeeklyBriefing(installerName: string): string {
  return `This week, ${installerName} handled 42 customer queries across 12 active installations. The assistant resolved 32 of these without human involvement, estimated saving 6 technician callouts. Three customers flagged satisfaction concerns — all three were followed up by your team and resolved. Pattern detection surfaced one new trend worth reviewing: defrost cycle queries are rising on Mitsubishi Ecodan systems, suggesting a possible commissioning checklist gap.`;
}

export default function CareInsightsPage() {
  const [installerName, setInstallerName] = useState<string>('SE Systems');
  useEffect(() => {
    let cancelled = false;
    fetch('/api/care-dashboard/brand')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { name?: string | null } | null) => {
        if (cancelled || !d?.name) return;
        setInstallerName(d.name);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const weeklyBriefing = buildWeeklyBriefing(installerName);
  return (
    <div className="min-h-full bg-gray-50">
      <div className="p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 rounded-lg bg-[#D4AF37]/10">
                  <TrendingUp className="w-4 h-4 text-[#D4AF37]" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">AI Insights</h1>
              </div>
              <p className="text-sm text-gray-500">
                Patterns, gaps, and trends detected across your customer queries.
              </p>
            </div>
          </div>

          {/* Section 1: Headline stats */}
          <StatCardGrid columns={5}>
            <StatCard
              label="Customer Queries (Month)"
              value={147}
              icon={MessageSquare}
              iconColor="text-[#D4AF37]"
            />
            <StatCard
              label="AI-Resolved Without Callout"
              value="112"
              description="76% resolved by assistant"
              icon={Sparkles}
              iconColor="text-emerald-500"
            />
            <StatCard
              label="Escalated to Technician"
              value={24}
              icon={AlertTriangle}
              iconColor="text-amber-500"
            />
            <StatCard
              label="Avg Resolution Time"
              value="4m 12s"
              icon={Clock}
              iconColor="text-blue-500"
            />
            <StatCard
              label="Satisfaction Rate"
              value="92%"
              icon={Smile}
              iconColor="text-emerald-500"
            />
          </StatCardGrid>

          {/* Section 2: Pattern Detection */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Pattern Detection</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Trends surfaced from the last 90 days of customer conversations.
                </p>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#D4AF37] bg-[#D4AF37]/10 px-2 py-1 rounded-full">
                <Sparkles className="w-3 h-3" />
                {PATTERNS.length} patterns
              </span>
            </div>
            <div className="divide-y divide-gray-100">
              {PATTERNS.map((p, i) => {
                const Icon = p.icon;
                return (
                  <div
                    key={i}
                    className="flex items-start gap-4 p-5 border-l-4 border-[#D4AF37] hover:bg-gray-50/60 transition-colors"
                  >
                    <div className="p-2.5 rounded-lg bg-[#D4AF37]/10 flex-shrink-0">
                      <Icon className="w-5 h-5 text-[#D4AF37]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-gray-900 leading-snug">
                        {p.title}
                      </h4>
                      <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">
                        {p.description}
                      </p>
                      <a
                        href={p.actionHref}
                        className="inline-flex items-center gap-1 mt-3 text-xs font-semibold text-[#D4AF37] hover:text-[#B8934C] transition-colors"
                      >
                        {p.actionLabel}
                        <ChevronRight className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 3: Top Topics */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Top Topics</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Share of customer queries by topic over the last 90 days.
              </p>
            </div>
            <div className="space-y-3">
              {TOP_TOPICS.map((t, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-48 flex-shrink-0">
                    <p className="text-sm text-gray-700 truncate">{t.label}</p>
                  </div>
                  <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden relative">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${t.percentage}%`,
                        background: 'linear-gradient(90deg, #D4AF37, #B8934C)',
                      }}
                    />
                  </div>
                  <div className="w-12 flex-shrink-0 text-right">
                    <span className="text-sm font-semibold text-gray-900">{t.percentage}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 4: Knowledge Gaps */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Knowledge Gaps</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Questions the assistant couldn&apos;t confidently answer in the last 30 days.
              </p>
            </div>
            <div className="divide-y divide-gray-100">
              {KNOWLEDGE_GAPS.map((g, i) => (
                <div key={i} className="flex items-start gap-4 p-5 hover:bg-gray-50/60 transition-colors">
                  <div className="p-2.5 rounded-lg bg-amber-50 flex-shrink-0">
                    <HelpCircle className="w-5 h-5 text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-gray-900 leading-snug">
                      &ldquo;{g.question}&rdquo;
                    </h4>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs text-gray-500">
                        Asked by {g.askedByCount} customers
                      </span>
                      <span className="text-gray-300">&middot;</span>
                      <span
                        className={`text-xs font-medium ${
                          g.status === 'none' ? 'text-red-600' : 'text-amber-600'
                        }`}
                      >
                        {g.status === 'none' ? 'No confident answer available' : 'Partial answer available'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      {g.actions.map((a, j) => (
                        <a
                          key={j}
                          href={a.href}
                          className={
                            a.primary
                              ? 'inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#D4AF37] text-white hover:bg-[#B8934C] transition-colors'
                              : 'inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:border-[#D4AF37]/50 hover:text-[#D4AF37] transition-colors'
                          }
                        >
                          {a.label}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 5: Weekly Briefing */}
          <div className="bg-white rounded-xl border-2 border-[#D4AF37]/30 shadow-sm p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-[#D4AF37]/5 to-transparent rounded-bl-full pointer-events-none" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-lg bg-[#D4AF37]/10">
                  <Sparkles className="w-5 h-5 text-[#D4AF37]" />
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#D4AF37]">
                    Weekly Briefing
                  </span>
                  <h3 className="text-base font-semibold text-gray-900 mt-0.5">
                    Your week in Care
                  </h3>
                </div>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{weeklyBriefing}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
