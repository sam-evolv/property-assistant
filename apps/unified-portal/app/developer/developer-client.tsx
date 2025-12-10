'use client';

import { useEffect, useState, memo, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Users, Building2, FileCheck, TrendingUp, ArrowRight, AlertCircle, ChevronRight, FileText, Settings, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { ChartLoadingSkeleton } from '@/components/ui/ChartLoadingSkeleton';

const TopQuestionsChart = dynamic(
  () => import('./dashboard-charts').then(mod => ({ default: mod.TopQuestionsChart })),
  { ssr: false, loading: () => <ChartLoadingSkeleton height={280} /> }
);

const OnboardingFunnelChart = dynamic(
  () => import('./dashboard-charts').then(mod => ({ default: mod.OnboardingFunnelChart })),
  { ssr: false, loading: () => <ChartLoadingSkeleton height={200} /> }
);

const ChatActivityChart = dynamic(
  () => import('./dashboard-charts').then(mod => ({ default: mod.ChatActivityChart })),
  { ssr: false, loading: () => <ChartLoadingSkeleton height={200} /> }
);

interface DashboardData {
  kpis: {
    onboardingRate: { value: number; label: string; description: string; suffix: string };
    engagementRate: { value: number; label: string; description: string; suffix: string; growth?: number };
    documentCoverage: { value: number; label: string; description: string; suffix: string };
    mustReadCompliance: { value: number; label: string; description: string; suffix: string };
  };
  questionTopics: Array<{ topic: string; label: string; count: number }>;
  chatActivity: Array<{ date: string; count: number }>;
  onboardingFunnel: Array<{ stage: string; count: number; colour: string }>;
  unansweredQueries: Array<{ question: string; topic: string; date: string }>;
  houseTypeEngagement: Array<{ houseType: string; activeUsers: number; messageCount: number }>;
  summary: {
    totalUnits: number;
    registeredHomeowners: number;
    activeHomeowners: number;
    totalMessages: number;
    messageGrowth: number;
    totalDocuments: number;
  };
}

function KpiCard({ 
  icon: Icon, 
  iconColour, 
  value, 
  label, 
  description, 
  suffix = '', 
  growth,
  isDarkMode 
}: { 
  icon: any; 
  iconColour: string; 
  value: number; 
  label: string; 
  description: string; 
  suffix?: string;
  growth?: number;
  isDarkMode: boolean;
}) {
  const cardBg = isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white/80 border-gray-200';
  const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
  const secondaryText = isDarkMode ? 'text-gray-300' : 'text-gray-600';

  return (
    <div className={`rounded-xl border p-6 backdrop-blur-sm transition hover:shadow-md ${cardBg}`}>
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
          <Icon className={`w-5 h-5 ${iconColour}`} />
        </div>
        {growth !== undefined && (
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
            growth >= 0 
              ? 'text-green-600 bg-green-500/10' 
              : 'text-red-600 bg-red-500/10'
          }`}>
            {growth >= 0 ? '+' : ''}{growth}%
          </span>
        )}
      </div>
      <p className={`${secondaryText} text-xs uppercase tracking-wide mb-1`}>{label}</p>
      <p className={`text-3xl font-bold ${textColor}`}>
        {value}{suffix}
      </p>
      <p className={`${secondaryText} text-xs mt-2`}>{description}</p>
    </div>
  );
}

function UnansweredQueriesCard({ 
  queries, 
  isDarkMode 
}: { 
  queries: Array<{ question: string; topic: string; date: string }>; 
  isDarkMode: boolean;
}) {
  const cardBg = isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white/80 border-gray-200';
  const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
  const secondaryText = isDarkMode ? 'text-gray-300' : 'text-gray-600';

  if (queries.length === 0) {
    return (
      <div className={`rounded-xl border p-6 backdrop-blur-sm ${cardBg}`}>
        <div className="flex items-center gap-2 mb-4">
          <AlertCircle className="w-5 h-5 text-amber-500" />
          <h2 className={`text-lg font-semibold ${textColor}`}>Knowledge Gaps</h2>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className={`p-3 rounded-full ${isDarkMode ? 'bg-green-900/30' : 'bg-green-100'} mb-3`}>
            <FileCheck className="w-6 h-6 text-green-600" />
          </div>
          <p className={`font-medium ${textColor}`}>All questions answered</p>
          <p className={`text-sm ${secondaryText}`}>Your documentation is covering queries well</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border p-6 backdrop-blur-sm ${cardBg}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-amber-500" />
          <h2 className={`text-lg font-semibold ${textColor}`}>Knowledge Gaps</h2>
        </div>
        <span className={`text-xs ${secondaryText}`}>{queries.length} queries need attention</span>
      </div>
      <div className="space-y-3">
        {queries.map((query, index) => (
          <div 
            key={index} 
            className={`p-3 rounded-lg ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}
          >
            <p className={`text-sm ${textColor} line-clamp-2`}>{query.question}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-xs px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-100 text-amber-700'}`}>
                {query.topic}
              </span>
            </div>
          </div>
        ))}
      </div>
      <p className={`text-xs ${secondaryText} mt-4`}>
        Consider uploading more documents on these topics
      </p>
    </div>
  );
}

function QuickActionsCard({
  summary,
  isDarkMode
}: {
  summary: DashboardData['summary'];
  isDarkMode: boolean;
}) {
  const cardBg = isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white/80 border-gray-200';
  const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
  const secondaryText = isDarkMode ? 'text-gray-300' : 'text-gray-600';
  const buttonClass = isDarkMode
    ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
    : 'border-gray-300 text-gray-700 hover:bg-gray-100';

  const unregisteredUnits = summary.totalUnits - summary.registeredHomeowners;

  const actions = [
    {
      href: '/developer/documents',
      icon: FileText,
      label: 'Manage Documents',
      description: `${summary.totalDocuments} documents uploaded`,
      show: true,
    },
    {
      href: '/developer/homeowners',
      icon: Users,
      label: unregisteredUnits > 0 ? `${unregisteredUnits} Units Awaiting Registration` : 'View Homeowners',
      description: unregisteredUnits > 0 ? 'Send QR codes to complete onboarding' : 'All units registered',
      show: true,
      highlight: unregisteredUnits > 0,
    },
    {
      href: '/developer/insights',
      icon: Sparkles,
      label: 'AI Insights',
      description: 'View detailed analytics',
      show: true,
    },
  ];

  return (
    <div className={`rounded-xl border p-6 backdrop-blur-sm ${cardBg}`}>
      <h2 className={`text-lg font-semibold ${textColor} mb-4`}>Quick Actions</h2>
      <div className="space-y-3">
        {actions.filter(a => a.show).map((action, index) => (
          <Link key={index} href={action.href}>
            <button className={`w-full flex items-center justify-between p-4 rounded-lg border transition ${buttonClass} ${
              action.highlight ? 'border-amber-500/50 bg-amber-500/5' : ''
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  <action.icon className={`w-4 h-4 ${action.highlight ? 'text-amber-500' : ''}`} />
                </div>
                <div className="text-left">
                  <span className={`text-sm font-medium block ${action.highlight ? 'text-amber-500' : ''}`}>
                    {action.label}
                  </span>
                  <span className={`text-xs ${secondaryText}`}>{action.description}</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4" />
            </button>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function DeveloperDashboardClient({ 
  developerName = 'Developer', 
  isDarkMode = false, 
  tenantId 
}: { 
  developerName?: string; 
  isDarkMode?: boolean; 
  tenantId?: string 
}) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await fetch('/api/analytics/developer/dashboard');
        if (!response.ok) {
          throw new Error('Failed to fetch dashboard data');
        }
        const dashboardData = await response.json();
        setData(dashboardData);
      } catch (err) {
        console.error('Dashboard fetch error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  const bgColor = isDarkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-gray-50 to-white';
  const cardBg = isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white/80 border-gray-200';
  const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
  const secondaryText = isDarkMode ? 'text-gray-300' : 'text-gray-600';

  if (loading) {
    return (
      <div className={`min-h-full flex flex-col ${bgColor}`}>
        <div className="px-8 py-8 flex-1">
          <div className="max-w-7xl mx-auto space-y-8">
            <div className="h-12 bg-gray-300 rounded-lg animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-gray-300 rounded-xl animate-pulse" />)}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-80 bg-gray-300 rounded-xl animate-pulse" />
              <div className="h-80 bg-gray-300 rounded-xl animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={`min-h-full flex flex-col ${bgColor}`}>
        <div className="px-8 py-8 flex-1 flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className={textColor}>Failed to load dashboard</p>
            <p className={secondaryText}>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-full flex flex-col ${bgColor}`}>
      <div className={`border-b ${isDarkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-white/50'} px-8 py-6 backdrop-blur-sm`}>
        <div className="max-w-7xl mx-auto">
          <h1 className={`text-3xl font-bold ${textColor}`}>Developer Dashboard</h1>
          <p className={`${secondaryText} text-sm mt-1`}>
            Real-time insights to help you improve your homeowner experience
          </p>
        </div>
      </div>

      <div className="px-8 py-8 flex-1">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard 
              icon={Users}
              iconColour="text-gold-500"
              value={data.kpis.onboardingRate.value}
              label={data.kpis.onboardingRate.label}
              description={data.kpis.onboardingRate.description}
              suffix={data.kpis.onboardingRate.suffix}
              isDarkMode={isDarkMode}
            />
            <KpiCard 
              icon={TrendingUp}
              iconColour="text-green-500"
              value={data.kpis.engagementRate.value}
              label={data.kpis.engagementRate.label}
              description={data.kpis.engagementRate.description}
              suffix={data.kpis.engagementRate.suffix}
              growth={data.kpis.engagementRate.growth}
              isDarkMode={isDarkMode}
            />
            <KpiCard 
              icon={FileText}
              iconColour="text-blue-500"
              value={data.kpis.documentCoverage.value}
              label={data.kpis.documentCoverage.label}
              description={data.kpis.documentCoverage.description}
              suffix={data.kpis.documentCoverage.suffix}
              isDarkMode={isDarkMode}
            />
            <KpiCard 
              icon={FileCheck}
              iconColour="text-purple-500"
              value={data.kpis.mustReadCompliance.value}
              label={data.kpis.mustReadCompliance.label}
              description={data.kpis.mustReadCompliance.description}
              suffix={data.kpis.mustReadCompliance.suffix}
              isDarkMode={isDarkMode}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className={`rounded-xl border p-6 backdrop-blur-sm ${cardBg}`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className={`text-lg font-semibold ${textColor}`}>What Homeowners Ask About</h2>
                <span className={`text-xs ${secondaryText}`}>Last 30 days</span>
              </div>
              {data.questionTopics.length > 0 ? (
                <TopQuestionsChart data={data.questionTopics} isDarkMode={isDarkMode} />
              ) : (
                <div className="flex items-center justify-center h-64">
                  <p className={secondaryText}>No questions recorded yet</p>
                </div>
              )}
              <p className={`text-xs ${secondaryText} mt-4`}>
                Focus documentation on the most asked topics
              </p>
            </div>

            <div className={`rounded-xl border p-6 backdrop-blur-sm ${cardBg}`}>
              <h2 className={`text-lg font-semibold ${textColor} mb-4`}>Onboarding Funnel</h2>
              <OnboardingFunnelChart data={data.onboardingFunnel} isDarkMode={isDarkMode} />
              <p className={`text-xs ${secondaryText} mt-4`}>
                Track homeowner progression from unit creation to active engagement
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className={`rounded-xl border p-6 backdrop-blur-sm lg:col-span-2 ${cardBg}`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className={`text-lg font-semibold ${textColor}`}>Chat Activity</h2>
                <span className={`text-xs ${secondaryText}`}>Last 30 days</span>
              </div>
              {data.chatActivity.length > 0 ? (
                <ChatActivityChart data={data.chatActivity} isDarkMode={isDarkMode} />
              ) : (
                <div className="flex items-center justify-center h-48">
                  <p className={secondaryText}>No chat activity recorded yet</p>
                </div>
              )}
            </div>

            <UnansweredQueriesCard queries={data.unansweredQueries} isDarkMode={isDarkMode} />
          </div>

          <QuickActionsCard summary={data.summary} isDarkMode={isDarkMode} />
        </div>
      </div>
    </div>
  );
}
