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

// Generate proactive alerts from dashboard data with expandable items
function generateAlerts(data: DashboardData): Alert[] {
  const alerts: Alert[] = [];

  // Check for inactive homeowners - with expandable items
  if (data.kpis.engagementRate.inactiveCount && data.kpis.engagementRate.inactiveCount > 3) {
    // Generate sample items for demonstration (in real app, fetch from API)
    const inactiveItems = Array.from({ length: Math.min(data.kpis.engagementRate.inactiveCount, 5) }, (_, i) => ({
      id: `inactive-${i}`,
      label: `Unit ${100 + i}`,
      sublabel: 'Last active 8 days ago',
      link: `/developer/homeowners?active=false`,
    }));

    alerts.push({
      id: 'inactive-homeowners',
      title: `${data.kpis.engagementRate.inactiveCount} inactive homeowners`,
      description: 'These homeowners haven\'t engaged in the past 7 days',
      priority: 'warning',
      count: data.kpis.engagementRate.inactiveCount,
      link: '/developer/homeowners?active=false',
      linkLabel: 'View All',
      items: inactiveItems,
    });
  }

  // Check for pending compliance - with expandable items
  if (data.kpis.mustReadCompliance.pendingCount && data.kpis.mustReadCompliance.pendingCount > 0) {
    // Generate sample items for demonstration
    const pendingItems = Array.from({ length: Math.min(data.kpis.mustReadCompliance.pendingCount, 5) }, (_, i) => ({
      id: `pending-${i}`,
      label: `Unit ${200 + i}`,
      sublabel: 'Awaiting document acknowledgement',
      link: `/developer/homeowners?compliance=false`,
    }));

    alerts.push({
      id: 'pending-compliance',
      title: 'Documents awaiting acknowledgement',
      description: `${data.kpis.mustReadCompliance.pendingCount} homeowners haven't acknowledged must-read documents`,
      priority: data.kpis.mustReadCompliance.pendingCount > 5 ? 'critical' : 'warning',
      count: data.kpis.mustReadCompliance.pendingCount,
      link: '/developer/homeowners?compliance=false',
      linkLabel: 'Send Reminders',
      items: pendingItems,
    });
  }

  // Check for unanswered queries (knowledge gaps) - with expandable items
  if (data.unansweredQueries.length > 0) {
    const queryItems = data.unansweredQueries.slice(0, 5).map((q, i) => ({
      id: `query-${i}`,
      label: q.question.slice(0, 50) + (q.question.length > 50 ? '...' : ''),
      sublabel: `Topic: ${q.topic}`,
      link: '/developer/archive',
    }));

    alerts.push({
      id: 'knowledge-gaps',
      title: 'Knowledge gaps detected',
      description: 'Some homeowner questions couldn\'t be answered from documentation',
      priority: 'info',
      count: data.unansweredQueries.length,
      link: '/developer/archive',
      linkLabel: 'Upload Documents',
      items: queryItems,
    });
  }

  // Check for low document coverage
  if (data.kpis.documentCoverage.value < 80) {
    alerts.push({
      id: 'low-coverage',
      title: 'Document coverage below 80%',
      description: 'Upload more documents to improve AI assistant accuracy',
      priority: 'info',
      link: '/developer/archive',
      linkLabel: 'Manage Documents',
    });
  }

  // Add success alert if everything is good
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

// Generate activity feed from chat activity - only real data, no mock entries
function generateActivityFeed(chatActivity: Array<{ date: string; count: number }>): ActivityType[] {
  const activities: ActivityType[] = [];
  const recentDays = chatActivity.slice(-7).reverse();

  recentDays.forEach((day, index) => {
    if (day.count > 0) {
      activities.push({
        id: `chat-${index}`,
        type: 'message',
        title: `${day.count} chat interaction${day.count > 1 ? 's' : ''}`,
        description: 'Homeowner conversations',
        timestamp: new Date(day.date),
      });
    }
  });

  return activities.slice(0, 8);
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
  const activities = generateActivityFeed(data.chatActivity);
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
