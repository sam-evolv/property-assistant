'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Building2,
  Home,
  FileText,
  MessageSquare,
  TrendingUp,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  ChevronRight,
  Zap,
  DollarSign,
  HeartPulse,
  Database,
  Bot,
  HelpCircle,
  UserPlus,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Server,
} from 'lucide-react';
import {
  PageHeader,
  MetricCard,
  MetricCardGrid,
  DataCard,
  StatusBadge,
  DataRow,
  ActivityTimeline,
  Badge,
  Button,
  EmptyState,
} from '@/components/ui/premium';
import { useProjectContext } from '@/contexts/ProjectContext';

// ============================================================================
// TYPES
// ============================================================================
interface PlatformMetrics {
  total_developers: number;
  total_developments: number;
  total_units: number;
  total_homeowners: number;
  total_messages: number;
  total_documents: number;
  active_homeowners_7d: number;
  top_5_developments_by_activity: Array<{
    id: string;
    name: string;
    message_count: number;
    homeowner_count: number;
  }>;
}

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical';
  databases: {
    drizzle: { status: string; latencyMs: number };
    supabase: { status: string; latencyMs: number };
  };
  deployment: {
    version: string;
    environment: string;
    uptimeFormatted: string;
  };
}

interface BetaKPIs {
  totalConversations: number;
  uniqueUsers: number;
  avgMessagesPerConversation: number;
  avgResponseTime: number;
  totalDocuments: number;
  totalDocumentViews: number;
}

interface LiveActivity {
  events: Array<{
    id: string;
    eventType: string;
    metadata: Record<string, any>;
    createdAt: string;
    developmentName?: string;
    userName?: string;
  }>;
  total: number;
}

interface TopQuestion {
  question: string;
  count: number;
  topic?: string;
}

interface DashboardData {
  platform: PlatformMetrics | null;
  health: SystemHealth | null;
  beta: {
    kpis: BetaKPIs | null;
    liveActivity: LiveActivity | null;
    topQuestions: { last24h: TopQuestion[]; last7d: TopQuestion[] };
    trainingOpportunities: any[];
    unansweredQuestions: any[];
    unactivatedSignups: any[];
  } | null;
  usage: {
    total_messages: number;
    total_tokens: number;
    estimated_cost_usd: number;
    avg_response_time_ms: number;
  } | null;
  messageVolume: Array<{ date: string; count: number }>;
}

// ============================================================================
// QUICK ACTION CARDS
// ============================================================================
const quickActions = [
  {
    label: 'View All Developments',
    href: '/super/developments',
    icon: Building2,
    color: 'bg-blue-50 text-blue-600',
  },
  {
    label: 'Manage Homeowners',
    href: '/super/homeowners',
    icon: Users,
    color: 'bg-emerald-50 text-emerald-600',
  },
  {
    label: 'System Health',
    href: '/super/system-health',
    icon: HeartPulse,
    color: 'bg-purple-50 text-purple-600',
  },
  {
    label: 'Platform Analytics',
    href: '/super/analytics',
    icon: Activity,
    color: 'bg-amber-50 text-amber-600',
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function getEventIcon(eventType: string) {
  switch (eventType) {
    case 'chat_message':
    case 'message_sent':
      return MessageSquare;
    case 'document_view':
    case 'document_download':
      return FileText;
    case 'user_signup':
    case 'user_login':
      return UserPlus;
    case 'ai_response':
      return Bot;
    default:
      return Activity;
  }
}

function getEventType(eventType: string): 'message' | 'document' | 'user_added' | 'notification' {
  if (eventType.includes('message') || eventType.includes('chat')) return 'message';
  if (eventType.includes('document')) return 'document';
  if (eventType.includes('user') || eventType.includes('signup')) return 'user_added';
  return 'notification';
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export function SuperDashboard() {
  const { selectedProjectId, selectedProject, isLoading: projectLoading } = useProjectContext();
  const [data, setData] = useState<DashboardData>({
    platform: null,
    health: null,
    beta: null,
    usage: null,
    messageVolume: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const isProjectScoped = Boolean(selectedProjectId);

  const fetchDashboardData = useCallback(async () => {
    try {
      setIsRefreshing(true);

      const projectParam = selectedProjectId ? `&projectId=${selectedProjectId}` : '';

      // Fetch all data in parallel
      const [
        platformRes,
        healthRes,
        betaRes,
        usageRes,
        volumeRes,
      ] = await Promise.allSettled([
        fetch(`/api/analytics/platform/overview?${projectParam}`).then(r => r.ok ? r.json() : null),
        fetch('/api/super/system-health').then(r => r.ok ? r.json() : null),
        !isProjectScoped ? fetch('/api/super/beta-control-room').then(r => r.ok ? r.json() : null) : Promise.resolve(null),
        !isProjectScoped ? fetch('/api/analytics/platform/usage?days=30').then(r => r.ok ? r.json() : null) : Promise.resolve(null),
        !isProjectScoped ? fetch('/api/analytics/platform/message-volume?days=14').then(r => r.ok ? r.json() : null) : Promise.resolve(null),
      ]);

      setData({
        platform: platformRes.status === 'fulfilled' ? platformRes.value : null,
        health: healthRes.status === 'fulfilled' ? healthRes.value : null,
        beta: betaRes.status === 'fulfilled' ? betaRes.value : null,
        usage: usageRes.status === 'fulfilled' ? usageRes.value : null,
        messageVolume: volumeRes.status === 'fulfilled' ? (volumeRes.value?.data || volumeRes.value || []) : [],
      });

      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error('Dashboard error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedProjectId, isProjectScoped]);

  useEffect(() => {
    if (projectLoading) return;
    fetchDashboardData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, [projectLoading, fetchDashboardData]);

  // Derived data
  const activeRate = useMemo(() => {
    if (!data.platform) return 0;
    const { total_homeowners, active_homeowners_7d } = data.platform;
    return total_homeowners > 0 ? Math.round((active_homeowners_7d / total_homeowners) * 100) : 0;
  }, [data.platform]);

  const systemStatus = useMemo(() => {
    if (!data.health) return 'neutral';
    return data.health.status === 'healthy' ? 'healthy' : data.health.status === 'degraded' ? 'warning' : 'error';
  }, [data.health]);

  const recentActivity = useMemo(() => {
    if (!data.beta?.liveActivity?.events) return [];
    return data.beta.liveActivity.events.slice(0, 8).map((event, idx) => ({
      id: event.id || `event-${idx}`,
      type: getEventType(event.eventType),
      title: event.eventType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      description: event.developmentName || event.userName || 'Platform activity',
      timestamp: new Date(event.createdAt),
    }));
  }, [data.beta]);

  if (loading) {
    return null; // Skeleton is shown by parent
  }

  if (error) {
    return (
      <div className="p-8 min-h-screen bg-neutral-50">
        <div className="max-w-[1600px] mx-auto">
          <EmptyState
            variant="error"
            title="Failed to load dashboard"
            description={error}
            action={{ label: 'Try Again', onClick: fetchDashboardData }}
          />
        </div>
      </div>
    );
  }

  const { platform, health, beta, usage } = data;

  return (
    <div className="p-8 min-h-screen bg-neutral-50">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <PageHeader
          title={isProjectScoped ? `${selectedProject?.name || 'Project'} Dashboard` : 'Platform Overview'}
          subtitle={isProjectScoped ? 'Project-specific metrics and activity' : 'Real-time platform health and key metrics'}
          icon={LayoutDashboard}
          badge={{
            label: systemStatus === 'healthy' ? 'All Systems Operational' : 'Issues Detected',
            variant: systemStatus === 'healthy' ? 'live' : 'default',
          }}
          onRefresh={fetchDashboardData}
          isRefreshing={isRefreshing}
        />

        {/* Quick Actions */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="group flex items-center gap-4 p-4 bg-white rounded-xl border border-neutral-200 hover:border-brand-300 hover:shadow-md transition-all"
            >
              <div className={cn('p-3 rounded-lg', action.color)}>
                <action.icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-neutral-900 group-hover:text-brand-600 transition-colors">
                  {action.label}
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:text-brand-500 transition-colors" />
            </Link>
          ))}
        </div>

        {/* Primary Metrics */}
        <MetricCardGrid columns={4} className="mb-8">
          <MetricCard
            label="Total Developers"
            value={platform?.total_developers || 0}
            icon={Users}
            variant="highlighted"
            description="Active developer accounts"
          />
          <MetricCard
            label="Developments"
            value={platform?.total_developments || 0}
            icon={Building2}
            description="Managed properties"
          />
          <MetricCard
            label="Total Units"
            value={formatNumber(platform?.total_units || 0)}
            icon={Home}
            trend={8}
            trendLabel="vs last month"
          />
          <MetricCard
            label="Homeowners"
            value={formatNumber(platform?.total_homeowners || 0)}
            icon={Users}
            description={`${activeRate}% active (7d)`}
            variant={activeRate > 50 ? 'success' : 'default'}
          />
        </MetricCardGrid>

        {/* Secondary Metrics */}
        {!isProjectScoped && (
          <MetricCardGrid columns={4} className="mb-8">
            <MetricCard
              label="Total Messages"
              value={formatNumber(usage?.total_messages || platform?.total_messages || 0)}
              icon={MessageSquare}
              trend={12}
            />
            <MetricCard
              label="Avg Response Time"
              value={formatDuration(usage?.avg_response_time_ms || 0)}
              icon={Clock}
              variant={usage?.avg_response_time_ms && usage.avg_response_time_ms < 2000 ? 'success' : 'warning'}
            />
            <MetricCard
              label="AI Cost (30d)"
              value={formatCurrency(usage?.estimated_cost_usd || 0)}
              icon={DollarSign}
              description={`${formatNumber(usage?.total_tokens || 0)} tokens`}
            />
            <MetricCard
              label="Documents"
              value={formatNumber(platform?.total_documents || 0)}
              icon={FileText}
              description="Indexed documents"
            />
          </MetricCardGrid>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* System Health */}
          <DataCard
            title="System Health"
            icon={HeartPulse}
            status={systemStatus as any}
            statusLabel={health?.status || 'Unknown'}
            onViewAll={() => window.location.href = '/super/system-health'}
            viewAllLabel="Details"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-neutral-500" />
                  <span className="text-sm text-neutral-700">Database</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-500">{health?.databases.drizzle.latencyMs || 0}ms</span>
                  <span className={cn(
                    'w-2 h-2 rounded-full',
                    health?.databases.drizzle.status === 'OK' ? 'bg-emerald-500' : 'bg-red-500'
                  )} />
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-neutral-500" />
                  <span className="text-sm text-neutral-700">Environment</span>
                </div>
                <Badge variant={health?.deployment.environment === 'production' ? 'success' : 'warning'} size="sm">
                  {health?.deployment.environment || 'Unknown'}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-neutral-500" />
                  <span className="text-sm text-neutral-700">Uptime</span>
                </div>
                <span className="text-sm font-medium text-neutral-900">
                  {health?.deployment.uptimeFormatted || 'N/A'}
                </span>
              </div>
            </div>
          </DataCard>

          {/* Top Developments */}
          <DataCard
            title="Top Developments"
            subtitle="By message activity"
            icon={Building2}
            onViewAll={() => window.location.href = '/super/developments'}
          >
            {platform?.top_5_developments_by_activity && platform.top_5_developments_by_activity.length > 0 ? (
              <div className="space-y-2">
                {platform.top_5_developments_by_activity.slice(0, 5).map((dev, idx) => (
                  <Link
                    key={dev.id}
                    href={`/super/developments/${dev.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-neutral-50 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                        idx === 0 ? 'bg-brand-100 text-brand-700' : 'bg-neutral-100 text-neutral-600'
                      )}>
                        {idx + 1}
                      </span>
                      <span className="text-sm font-medium text-neutral-700 group-hover:text-brand-600 truncate max-w-[140px]">
                        {dev.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-neutral-500">{dev.message_count} msgs</span>
                      <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-neutral-500" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-neutral-500">
                No development activity yet
              </div>
            )}
          </DataCard>

          {/* Recent Activity */}
          <DataCard
            title="Recent Activity"
            icon={Activity}
            onViewAll={() => window.location.href = '/super/beta-control-room'}
            viewAllLabel="Control Room"
          >
            {recentActivity.length > 0 ? (
              <ActivityTimeline events={recentActivity} maxItems={5} />
            ) : (
              <div className="py-8 text-center text-sm text-neutral-500">
                No recent activity
              </div>
            )}
          </DataCard>
        </div>

        {/* Bottom Section */}
        {!isProjectScoped && beta && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Questions (24h) */}
            <DataCard
              title="Top Questions (24h)"
              subtitle="Most asked questions today"
              icon={HelpCircle}
              onViewAll={() => window.location.href = '/super/analytics'}
            >
              {beta.topQuestions?.last24h && beta.topQuestions.last24h.length > 0 ? (
                <div className="space-y-2">
                  {beta.topQuestions.last24h.slice(0, 6).map((q, idx) => (
                    <div key={idx} className="flex items-start justify-between p-3 bg-neutral-50 rounded-lg">
                      <p className="text-sm text-neutral-700 flex-1 pr-4 line-clamp-2">
                        {q.question}
                      </p>
                      <Badge variant="neutral" size="sm">
                        {q.count}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-neutral-500">
                  No questions in the last 24 hours
                </div>
              )}
            </DataCard>

            {/* Alerts & Opportunities */}
            <DataCard
              title="Attention Needed"
              icon={AlertTriangle}
            >
              <div className="space-y-3">
                {/* Unanswered Questions */}
                {beta.unansweredQuestions && beta.unansweredQuestions.length > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <HelpCircle className="w-4 h-4 text-amber-600" />
                      <span className="text-sm font-medium text-amber-800">Unanswered Questions</span>
                    </div>
                    <p className="text-xs text-amber-700">
                      {beta.unansweredQuestions.length} questions couldn't be answered from documentation
                    </p>
                    <Link
                      href="/super/analytics"
                      className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:text-amber-800 mt-2"
                    >
                      Review questions <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                )}

                {/* Unactivated Signups */}
                {beta.unactivatedSignups && beta.unactivatedSignups.length > 0 && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <UserPlus className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-800">Pending Activations</span>
                    </div>
                    <p className="text-xs text-blue-700">
                      {beta.unactivatedSignups.length} users signed up but haven't engaged
                    </p>
                    <Link
                      href="/super/homeowners"
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800 mt-2"
                    >
                      View users <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                )}

                {/* Training Opportunities */}
                {beta.trainingOpportunities && beta.trainingOpportunities.length > 0 && (
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="w-4 h-4 text-purple-600" />
                      <span className="text-sm font-medium text-purple-800">Training Opportunities</span>
                    </div>
                    <p className="text-xs text-purple-700">
                      {beta.trainingOpportunities.length} patterns detected for AI improvement
                    </p>
                    <Link
                      href="/super/beta-control-room"
                      className="inline-flex items-center gap-1 text-xs font-medium text-purple-700 hover:text-purple-800 mt-2"
                    >
                      View details <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                )}

                {/* All Clear */}
                {(!beta.unansweredQuestions?.length && !beta.unactivatedSignups?.length && !beta.trainingOpportunities?.length) && (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    <p className="text-sm font-medium text-emerald-800">All Clear!</p>
                    <p className="text-xs text-emerald-700 mt-1">No immediate attention required</p>
                  </div>
                )}
              </div>
            </DataCard>
          </div>
        )}

        {/* Footer */}
        {lastUpdated && (
          <div className="mt-8 text-center">
            <p className="text-xs text-neutral-400 flex items-center justify-center gap-1">
              <Clock className="w-3 h-3" />
              Last updated: {lastUpdated.toLocaleTimeString()} • Auto-refresh every 30s
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default SuperDashboard;
