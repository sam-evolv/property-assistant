'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  Users,
  Building2,
  FileCheck,
  TrendingUp,
  AlertCircle,
  FileText,
  Sparkles,
  Plus,
  Mail,
  Download,
  BarChart3,
  MessageSquare,
  Activity,
  Target,
  RefreshCw,
  Clock,
  Bell,
  ArrowRight,
  CheckCircle,
  ChevronRight,
} from 'lucide-react';

// UI Components
import { StatCard, StatCardGrid } from '@/components/ui/StatCard';
import { ProactiveAlertsWidget } from '@/components/ui/ProactiveAlerts';
import type { Alert, AlertItem } from '@/components/ui/ProactiveAlerts';
import { ActivityFeedWidget } from '@/components/ui/ActivityFeed';
import type { Activity as ActivityType } from '@/components/ui/ActivityFeed';
import { QuickActionsBar } from '@/components/ui/QuickActions';
import type { QuickAction } from '@/components/ui/QuickActions';
import {
  StatCardGridSkeleton,
  ChartSkeleton,
  CardSkeleton,
  ActivityFeedSkeleton,
} from '@/components/ui/Skeleton';
import { ChartLoadingSkeleton } from '@/components/ui/ChartLoadingSkeleton';
import { useAuth } from '@/contexts/AuthContext';

// Dynamic chart imports
const TopQuestionsChart = dynamic(
  () => import('../dashboard-charts').then(mod => ({ default: mod.TopQuestionsChart })),
  { ssr: false, loading: () => <ChartLoadingSkeleton height={280} /> }
);

const OnboardingFunnelChart = dynamic(
  () => import('../dashboard-charts').then(mod => ({ default: mod.OnboardingFunnelChart })),
  { ssr: false, loading: () => <ChartLoadingSkeleton height={200} /> }
);

const ChatActivityChart = dynamic(
  () => import('../dashboard-charts').then(mod => ({ default: mod.ChatActivityChart })),
  { ssr: false, loading: () => <ChartLoadingSkeleton height={200} /> }
);

// Types
interface DashboardData {
  requestId?: string;
  kpis: {
    onboardingRate: KpiData;
    engagementRate: KpiData;
    documentCoverage: KpiData;
    mustReadCompliance: KpiData;
  };
  questionTopics: Array<{ topic: string; label: string; count: number }>;
  chatActivity: Array<{ date: string; count: number }>;
  onboardingFunnel: Array<{ stage: string; count: number; colour: string }>;
  unansweredQueries: Array<{ question: string; topic: string; date: string }>;
  houseTypeEngagement: Array<{ houseType: string; activeUsers: number; messageCount: number }>;
  upcomingHandovers: Array<{ address: string; unit_uid: string | null; handover_date: string }>;
  recentEvents: Array<{ type: string; label: string; sublabel: string; date: string; link?: string }>;
  summary: {
    totalUnits: number;
    registeredHomeowners: number;
    activeHomeowners: number;
    totalMessages: number;
    messageGrowth: number;
    totalDocuments: number;
  };
}

interface KpiData {
  value: number;
  label: string;
  description: string;
  suffix: string;
  growth?: number;
  delta?: number;
  inactiveCount?: number;
  pendingCount?: number;
}

interface DashboardError {
  error: string;
  details?: string;
  requestId?: string;
}

// Convert dashboard data to sparkline format
function generateSparklineData(chatActivity: Array<{ date: string; count: number }>) {
  // Ensure we have at least 7 data points for a visible sparkline
  const data = chatActivity.slice(-7);
  if (data.length < 2) {
    // Generate sample data if not enough real data
    const now = new Date();
    return Array.from({ length: 7 }, (_, i) => ({
      value: Math.floor(Math.random() * 50) + 10,
      date: new Date(now.getTime() - (6 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    }));
  }
  return data.map(d => ({ value: d.count, date: d.date }));
}

// Generate proactive alerts — only actionable items the developer can fix
function generateAlerts(data: DashboardData): Alert[] {
  const alerts: Alert[] = [];

  // 1. Knowledge gaps — homeowners asked questions the AI couldn't answer
  // Action: upload the missing documents to Smart Archive
  if (data.unansweredQueries.length > 0) {
    const queryItems = data.unansweredQueries.slice(0, 5).map((q, i) => ({
      id: `query-${i}`,
      label: q.question.slice(0, 55) + (q.question.length > 55 ? '...' : ''),
      sublabel: `Topic: ${q.topic}`,
      link: '/developer/archive',
    }));
    alerts.push({
      id: 'knowledge-gaps',
      title: `${data.unansweredQueries.length} unanswered question${data.unansweredQueries.length > 1 ? 's' : ''}`,
      description: 'Homeowners asked these questions — upload docs to let the AI answer them',
      priority: data.unansweredQueries.length >= 5 ? 'critical' : 'warning',
      count: data.unansweredQueries.length,
      link: '/developer/archive',
      linkLabel: 'Upload Documents',
      items: queryItems,
    });
  }

  // 2. Upcoming handovers — units handing over in the next 60 days
  // Action: ensure all documents are uploaded before handover day
  const handovers = data.upcomingHandovers || [];
  if (handovers.length > 0) {
    const handoverItems = handovers.slice(0, 5).map((u, i) => {
      const date = new Date(u.handover_date);
      const daysUntil = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return {
        id: `handover-${i}`,
        label: u.address,
        sublabel: `Handover in ${daysUntil} day${daysUntil !== 1 ? 's' : ''} — ${date.toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })}`,
        link: u.unit_uid ? `/developer/homeowners/${u.unit_uid}` : '/developer/homeowners',
      };
    });
    const soonest = Math.ceil((new Date(handovers[0].handover_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    alerts.push({
      id: 'upcoming-handovers',
      title: `${handovers.length} upcoming handover${handovers.length > 1 ? 's' : ''}`,
      description: `Next handover in ${soonest} day${soonest !== 1 ? 's' : ''} — make sure all documents are uploaded`,
      priority: soonest <= 14 ? 'critical' : 'warning',
      count: handovers.length,
      link: '/developer/homeowners',
      linkLabel: 'View Units',
      items: handoverItems,
    });
  }

  // 3. Low document coverage — AI has nothing to pull from
  if (data.kpis.documentCoverage.value < 60) {
    alerts.push({
      id: 'low-coverage',
      title: 'Document coverage is low',
      description: `Only ${data.kpis.documentCoverage.value}% of house types have uploaded documents`,
      priority: 'info',
      link: '/developer/archive',
      linkLabel: 'Upload Documents',
    });
  }

  // All clear
  if (alerts.length === 0) {
    alerts.push({
      id: 'all-clear',
      title: 'All systems operational',
      description: 'No immediate action required',
      priority: 'ready',
    });
  }

  return alerts;
}

// Map recentEvents type to ActivityFeed type
const eventTypeMap: Record<string, 'user' | 'completion' | 'alert' | 'message'> = {
  registration: 'user',
  acknowledgment: 'completion',
  gap: 'alert',
  chat: 'message',
};

// Generate activity feed from real events returned by the API
function generateActivityFeed(data: DashboardData): ActivityType[] {
  const events = data.recentEvents || [];

  return events.slice(0, 8).map((event, index) => ({
    id: `event-${index}`,
    type: eventTypeMap[event.type] || 'message',
    title: event.label,
    description: event.sublabel,
    timestamp: new Date(event.date),
    link: event.link,
  }));
}

// Page Header Component
function PageHeader({ developerName }: { developerName: string }) {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-gray-900">
        {getGreeting()}, {developerName}
      </h1>
      <p className="text-sm text-gray-500 mt-1">
        Here's what's happening with your developments today
      </p>
    </div>
  );
}

// Quick Actions for the dashboard
function getQuickActions(
  onExport: () => void,
  onSendEmail: () => void
): QuickAction[] {
  return [
    {
      id: 'add-unit',
      label: 'Add Unit',
      icon: Plus,
      onClick: () => window.location.href = '/developer/homeowners',
      variant: 'primary',
    },
    {
      id: 'send-email',
      label: 'Send Email',
      icon: Mail,
      onClick: onSendEmail,
      shortcut: '⌘E',
    },
    {
      id: 'export',
      label: 'Export Report',
      icon: Download,
      onClick: onExport,
    },
    {
      id: 'analytics',
      label: 'View Analytics',
      icon: BarChart3,
      onClick: () => window.location.href = '/developer/analytics',
    },
  ];
}

// Main Dashboard Component
export default function DeveloperOverviewPage() {
  const { email, displayName: authDisplayName } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<DashboardError | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Use full name from signup if available, otherwise derive from email
  const displayName = authDisplayName || (email ? email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'there');

  const fetchDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await fetch('/api/analytics/developer/dashboard');
      const responseData = await response.json();

      if (!response.ok) {
        setError({
          error: responseData.error || `HTTP ${response.status}`,
          details: responseData.details || response.statusText,
          requestId: responseData.requestId,
        });
        return;
      }

      setData(responseData);
    } catch (err) {
      setError({
        error: 'Network error',
        details: err instanceof Error ? err.message : 'Failed to connect to server',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleExport = () => {
    // TODO: Implement export functionality
    console.log('Export clicked');
  };

  const handleSendEmail = () => {
    // TODO: Implement email functionality
    window.location.href = '/developer/homeowners';
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-full bg-gray-50 p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header skeleton */}
          <div className="mb-6">
            <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-2" />
            <div className="h-4 w-80 bg-gray-200 rounded animate-pulse" />
          </div>

          {/* Quick actions skeleton */}
          <div className="h-14 bg-white rounded-xl border border-gray-200 animate-pulse" />

          {/* Stats skeleton */}
          <StatCardGridSkeleton count={5} />

          {/* Alerts & Activity skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <CardSkeleton className="lg:col-span-2" />
            <CardSkeleton />
          </div>

          {/* Charts skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartSkeleton />
            <ChartSkeleton />
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="min-h-full bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            {error?.error || 'Failed to load dashboard'}
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            {error?.details || 'An unexpected error occurred.'}
          </p>
          {error?.requestId && (
            <p className="text-xs text-gray-400 font-mono mb-4">
              Request ID: {error.requestId}
            </p>
          )}
          <button
            onClick={() => fetchDashboard()}
            className="px-4 py-2 bg-gold-500 text-white font-medium rounded-lg hover:bg-gold-600 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const alerts = generateAlerts(data);
  const activities = generateActivityFeed(data);
  const sparklineData = generateSparklineData(data.chatActivity);
  const quickActions = getQuickActions(handleExport, handleSendEmail);

  // Calculate stats
  const totalMessages = data.summary.totalMessages;
  const messageGrowth = data.summary.messageGrowth;

  return (
    <div className="min-h-full bg-gray-50">
      <div className="p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header with refresh */}
          <div className="flex items-start justify-between">
            <PageHeader developerName={displayName} />
            <button
              onClick={() => fetchDashboard(true)}
              disabled={refreshing}
              className={cn(
                'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                'text-gray-600 hover:bg-gray-100',
                refreshing && 'opacity-50 cursor-not-allowed'
              )}
            >
              <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
              Refresh
            </button>
          </div>

          {/* Quick Actions Bar */}
          <QuickActionsBar actions={quickActions} />

          {/* Live Activity Pulse */}
          {data.summary.totalMessages > 0 && (
            <div className="flex items-center gap-2.5 w-fit bg-white border border-gray-200 rounded-full px-3.5 py-1.5 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              <span className="text-[12px] font-semibold text-green-600 uppercase tracking-wide">Live</span>
              <span className="h-3 w-px bg-gray-200" />
              <span className="text-[12px] text-gray-600">
                {data.summary.totalMessages.toLocaleString()} messages
              </span>
              {data.summary.activeHomeowners > 0 && (
                <>
                  <span className="h-3 w-px bg-gray-200" />
                  <span className="text-[12px] text-gray-600">
                    {data.summary.activeHomeowners} active homeowner{data.summary.activeHomeowners !== 1 ? 's' : ''}
                  </span>
                </>
              )}
              {data.questionTopics.length > 0 && (
                <>
                  <span className="h-3 w-px bg-gray-200" />
                  <span className="text-[12px] text-gray-500">
                    Top: {data.questionTopics[0].label}
                  </span>
                </>
              )}
            </div>
          )}

          {/* Proactive Alerts */}
          <ProactiveAlertsWidget alerts={alerts} />

          {/* Stat Cards with Sparklines */}
          <StatCardGrid columns={5}>
            <StatCard
              label="Total Units"
              value={data.summary.totalUnits}
              icon={Building2}
              iconColor="text-gold-500"
              sparklineData={sparklineData}
            />
            <StatCard
              label="Registered"
              value={data.summary.registeredHomeowners}
              icon={Users}
              iconColor="text-blue-500"
              trend={data.kpis.onboardingRate.delta}
              trendLabel="vs last month"
            />
            <StatCard
              label="Active (7d)"
              value={data.summary.activeHomeowners}
              icon={Activity}
              iconColor="text-green-500"
              trend={data.kpis.engagementRate.delta}
            />
            <StatCard
              label="Messages"
              value={totalMessages.toLocaleString()}
              icon={MessageSquare}
              iconColor="text-purple-500"
              trend={messageGrowth}
              sparklineData={sparklineData}
            />
            <StatCard
              label="Documents"
              value={data.summary.totalDocuments}
              icon={FileText}
              iconColor="text-cyan-500"
              description={`${data.kpis.documentCoverage.value}% coverage`}
            />
          </StatCardGrid>

          {/* Activity Feed */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ActivityFeedWidget
                activities={activities}
                title="Recent Activity"
                maxItems={6}
              />
            </div>

            {/* Quick Links Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Quick Links</h3>
              <div className="space-y-2">
                <Link
                  href="/developer/homeowners"
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-50">
                      <Users className="w-4 h-4 text-blue-500" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">Homeowners</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                </Link>
                <Link
                  href="/developer/archive"
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-50">
                      <FileText className="w-4 h-4 text-purple-500" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">Smart Archive</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                </Link>
                <Link
                  href="/developer/analytics"
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-50">
                      <BarChart3 className="w-4 h-4 text-green-500" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">Analytics</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                </Link>
                <Link
                  href="/developer/insights"
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gold-50">
                      <Sparkles className="w-4 h-4 text-gold-500" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">AI Insights</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                </Link>
              </div>
            </div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Questions Chart */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">What Homeowners Ask About</h3>
                  <p className="text-xs text-gray-500">Last 30 days</p>
                </div>
              </div>
              {data.questionTopics.length > 0 ? (
                <TopQuestionsChart data={data.questionTopics} isDarkMode={false} />
              ) : (
                <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
                  No questions recorded yet
                </div>
              )}
            </div>

            {/* Onboarding Funnel */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Onboarding Funnel</h3>
                  <p className="text-xs text-gray-500">User journey progression</p>
                </div>
              </div>
              <OnboardingFunnelChart data={data.onboardingFunnel} isDarkMode={false} />
            </div>
          </div>

          {/* Chat Activity Chart */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Chat Activity</h3>
                <p className="text-xs text-gray-500">Daily conversations over the last 30 days</p>
              </div>
              <Link
                href="/developer/analytics"
                className="text-xs font-medium text-gold-600 hover:text-gold-700 flex items-center gap-1"
              >
                View Details
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {data.chatActivity.length > 0 ? (
              <ChatActivityChart data={data.chatActivity} isDarkMode={false} />
            ) : (
              <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
                No chat activity recorded yet
              </div>
            )}
          </div>

          {/* Knowledge Gaps (Unanswered Queries) */}
          {data.unansweredQueries.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-amber-100">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Knowledge Gaps</h3>
                    <p className="text-xs text-gray-500">
                      {data.unansweredQueries.length} queries couldn't be answered
                    </p>
                  </div>
                </div>
                <Link
                  href="/developer/archive"
                  className="text-xs font-medium text-gold-600 hover:text-gold-700 flex items-center gap-1"
                >
                  Upload Documents
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="space-y-3">
                {data.unansweredQueries.slice(0, 5).map((query, index) => (
                  <div
                    key={index}
                    className="p-3 bg-gray-50 rounded-lg"
                  >
                    <p className="text-sm text-gray-900 line-clamp-2">{query.question}</p>
                    <span className="text-xs text-amber-600 mt-2 inline-block px-2 py-0.5 bg-amber-50 rounded-full">
                      {query.topic}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
