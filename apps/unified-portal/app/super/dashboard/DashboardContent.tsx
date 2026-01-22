'use client';

import { useState, useMemo, Suspense } from 'react';
import { cn } from '@/lib/utils';
import {
  Building2,
  Users,
  Home,
  MessageSquare,
  TrendingUp,
  Calendar,
  FileText,
  Bell,
  RefreshCw,
  Download,
  Filter,
  ChevronRight,
  Sparkles,
  Activity,
  BarChart3,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { MetricCard, MetricCardGrid } from '@/components/ui/premium/MetricCard';
import { Button, ButtonGroup } from '@/components/ui/premium/Button';
import { ActivityTimeline, type TimelineEvent } from '@/components/ui/premium/ActivityTimeline';

// ============================================================================
// TYPES
// ============================================================================
interface DashboardMetrics {
  totalDevelopers: number;
  totalDevelopments: number;
  totalUnits: number;
  totalHomeowners: number;
  totalMessages: number;
  avgResponseTime: number;
  satisfactionScore: number;
  activeConversations: number;
}

type TimeRange = '7d' | '30d' | '90d' | '1y';

// ============================================================================
// MOCK DATA (Replace with real API calls)
// ============================================================================
const mockMetrics: DashboardMetrics = {
  totalDevelopers: 47,
  totalDevelopments: 156,
  totalUnits: 4823,
  totalHomeowners: 12456,
  totalMessages: 89432,
  avgResponseTime: 2.4,
  satisfactionScore: 94,
  activeConversations: 234,
};

const sparklineData = {
  developers: [
    { value: 32 }, { value: 35 }, { value: 38 }, { value: 40 }, { value: 42 }, { value: 44 }, { value: 47 },
  ],
  developments: [
    { value: 120 }, { value: 128 }, { value: 135 }, { value: 142 }, { value: 148 }, { value: 152 }, { value: 156 },
  ],
  units: [
    { value: 3800 }, { value: 4000 }, { value: 4200 }, { value: 4400 }, { value: 4550 }, { value: 4700 }, { value: 4823 },
  ],
  homeowners: [
    { value: 9000 }, { value: 10000 }, { value: 10500 }, { value: 11200 }, { value: 11800 }, { value: 12100 }, { value: 12456 },
  ],
};

const mockActivities: TimelineEvent[] = [
  {
    id: '1',
    type: 'user_added',
    title: 'New developer onboarded',
    description: 'Riverside Properties joined the platform',
    timestamp: new Date(Date.now() - 1000 * 60 * 15),
    user: { name: 'System' },
    status: 'completed',
  },
  {
    id: '2',
    type: 'document',
    title: 'Bulk document upload',
    description: '47 documents processed for Oak View Residences',
    timestamp: new Date(Date.now() - 1000 * 60 * 45),
    user: { name: 'Sarah Chen' },
    status: 'completed',
  },
  {
    id: '3',
    type: 'alert',
    title: 'High support volume detected',
    description: 'AI assistant handling 15% more queries than average',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
    status: 'pending',
  },
  {
    id: '4',
    type: 'success',
    title: 'Training job completed',
    description: 'RAG model updated with 2,340 new documents',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4),
    user: { name: 'System' },
    status: 'completed',
  },
  {
    id: '5',
    type: 'message',
    title: 'Milestone reached',
    description: '10,000 homeowner queries resolved this month',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8),
    status: 'completed',
  },
];

// ============================================================================
// PAGE HEADER
// ============================================================================
function PageHeader({ timeRange, setTimeRange }: { timeRange: TimeRange; setTimeRange: (t: TimeRange) => void }) {
  const timeRanges: { value: TimeRange; label: string }[] = [
    { value: '7d', label: '7 days' },
    { value: '30d', label: '30 days' },
    { value: '90d', label: '90 days' },
    { value: '1y', label: '1 year' },
  ];

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">
            Enterprise Dashboard
          </h1>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-full border border-emerald-200/50">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </span>
        </div>
        <p className="text-sm text-neutral-500">
          Real-time overview across all developments and homeowners
        </p>
      </div>

      <div className="flex items-center gap-3">
        {/* Time Range Selector */}
        <ButtonGroup attached>
          {timeRanges.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setTimeRange(value)}
              className={cn(
                'px-3 py-1.5 text-sm font-medium transition-colors',
                timeRange === value
                  ? 'bg-neutral-900 text-white'
                  : 'bg-white text-neutral-600 hover:bg-neutral-50 border border-neutral-200'
              )}
            >
              {label}
            </button>
          ))}
        </ButtonGroup>

        <Button variant="outline" size="sm" leftIcon={Download}>
          Export
        </Button>

        <Button variant="primary" size="sm" leftIcon={RefreshCw}>
          Refresh
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// QUICK ACTIONS
// ============================================================================
function QuickActions() {
  const actions = [
    { icon: Building2, label: 'Add Developer', color: 'text-blue-600 bg-blue-50' },
    { icon: Home, label: 'New Development', color: 'text-purple-600 bg-purple-50' },
    { icon: FileText, label: 'Upload Documents', color: 'text-amber-600 bg-amber-50' },
    { icon: Sparkles, label: 'Train AI', color: 'text-emerald-600 bg-emerald-50' },
  ];

  return (
    <div className="flex items-center gap-2 mb-6">
      <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider mr-2">Quick Actions</span>
      {actions.map(({ icon: Icon, label, color }) => (
        <button
          key={label}
          className={cn(
            'inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-all',
            'hover:scale-105 active:scale-95',
            color
          )}
        >
          <Icon className="w-4 h-4" />
          {label}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// PERFORMANCE CHART PLACEHOLDER
// ============================================================================
function PerformanceChart({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-card hover:shadow-cardHover transition-shadow">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-base font-semibold text-neutral-900">{title}</h3>
          <p className="text-sm text-neutral-500">{subtitle}</p>
        </div>
        <Button variant="ghost" size="xs" rightIcon={ChevronRight}>
          View All
        </Button>
      </div>

      {/* Chart placeholder - integrate with Recharts */}
      <div className="h-64 bg-gradient-to-br from-neutral-50 to-neutral-100 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <BarChart3 className="w-12 h-12 text-neutral-300 mx-auto mb-2" />
          <p className="text-sm text-neutral-400">Chart visualization</p>
          <p className="text-xs text-neutral-300 mt-1">Connect to analytics data</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SYSTEM HEALTH CARD
// ============================================================================
function SystemHealthCard() {
  const healthItems = [
    { label: 'API Response', value: '45ms', status: 'healthy' },
    { label: 'AI Processing', value: '1.2s', status: 'healthy' },
    { label: 'Document Queue', value: '12 pending', status: 'warning' },
    { label: 'Error Rate', value: '0.02%', status: 'healthy' },
  ];

  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-neutral-900">System Health</h3>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
          <Activity className="w-3 h-3" />
          All systems operational
        </span>
      </div>

      <div className="space-y-3">
        {healthItems.map(({ label, value, status }) => (
          <div key={label} className="flex items-center justify-between py-2 border-b border-neutral-100 last:border-0">
            <span className="text-sm text-neutral-600">{label}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-neutral-900">{value}</span>
              <span
                className={cn(
                  'w-2 h-2 rounded-full',
                  status === 'healthy' && 'bg-emerald-500',
                  status === 'warning' && 'bg-amber-500',
                  status === 'error' && 'bg-red-500'
                )}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN DASHBOARD CONTENT
// ============================================================================
export function DashboardContent() {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // In production, these would come from API calls with React Query
  const metrics = mockMetrics;
  const activities = mockActivities;

  return (
    <div className="p-8 min-h-screen bg-neutral-50">
      <PageHeader timeRange={timeRange} setTimeRange={setTimeRange} />
      <QuickActions />

      {/* Primary Metrics Grid */}
      <MetricCardGrid columns={4} className="mb-8">
        <MetricCard
          label="Total Developers"
          value={metrics.totalDevelopers}
          icon={Building2}
          trend={8}
          trendLabel="vs last month"
          sparklineData={sparklineData.developers}
          variant="highlighted"
        />
        <MetricCard
          label="Active Developments"
          value={metrics.totalDevelopments}
          icon={Home}
          trend={12}
          sparklineData={sparklineData.developments}
        />
        <MetricCard
          label="Total Units"
          value={metrics.totalUnits.toLocaleString()}
          icon={Users}
          trend={5}
          sparklineData={sparklineData.units}
        />
        <MetricCard
          label="Homeowners"
          value={metrics.totalHomeowners.toLocaleString()}
          icon={Users}
          trend={15}
          sparklineData={sparklineData.homeowners}
          variant="success"
        />
      </MetricCardGrid>

      {/* Secondary Metrics */}
      <MetricCardGrid columns={4} className="mb-8">
        <MetricCard
          label="Total Messages"
          value={(metrics.totalMessages / 1000).toFixed(1) + 'K'}
          icon={MessageSquare}
          trend={23}
          description="AI-handled conversations"
        />
        <MetricCard
          label="Avg Response Time"
          value={metrics.avgResponseTime}
          suffix="min"
          icon={Clock}
          trend={-12}
          description="Faster than last month"
          variant="success"
        />
        <MetricCard
          label="Satisfaction Score"
          value={metrics.satisfactionScore}
          suffix="%"
          icon={CheckCircle2}
          trend={3}
        />
        <MetricCard
          label="Active Conversations"
          value={metrics.activeConversations}
          icon={Activity}
          description="Currently in progress"
          variant="warning"
        />
      </MetricCardGrid>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <PerformanceChart
          title="Message Volume"
          subtitle="Daily messages across all developments"
        />
        <PerformanceChart
          title="Response Quality"
          subtitle="AI accuracy and user satisfaction"
        />
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Timeline */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-neutral-200 p-6 shadow-card">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-semibold text-neutral-900">Recent Activity</h3>
              <p className="text-sm text-neutral-500">Platform events and updates</p>
            </div>
            <Button variant="ghost" size="xs" rightIcon={ChevronRight}>
              View All
            </Button>
          </div>
          <ActivityTimeline events={activities} maxItems={5} />
        </div>

        {/* System Health */}
        <SystemHealthCard />
      </div>
    </div>
  );
}

export default DashboardContent;
