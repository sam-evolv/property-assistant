'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  Users,
  Building2,
  Home,
  MessageSquare,
  RefreshCw,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Key,
  ClipboardList,
  Activity,
  Database,
  Bot,
  Loader2,
} from 'lucide-react';
import {
  PageHeader,
  Card,
  CardHeader,
  CardContent,
  Button,
  Badge,
} from '@/components/ui/premium';

interface DashboardStats {
  developers: number;
  developments: number;
  units: number;
  questions: number;
  admins: number;
  unitsWithPurchaser: number;
}

interface PendingItems {
  submissions: number;
}

interface RecentActivity {
  id: string;
  type: string;
  description: string;
  timestamp: string;
}

interface HealthStatus {
  database: string;
  api: string;
}

function MetricCard({
  label,
  value,
  icon: Icon,
  href,
  variant = 'default',
}: {
  label: string;
  value: number;
  icon: any;
  href?: string;
  variant?: 'default' | 'gold' | 'success' | 'warning';
}) {
  const content = (
    <div className={cn(
      'bg-white rounded-xl border p-6 transition-all hover:shadow-md',
      variant === 'gold' && 'border-amber-200 bg-gradient-to-br from-amber-50 to-white',
      variant === 'success' && 'border-emerald-200',
      variant === 'warning' && 'border-orange-200',
      variant === 'default' && 'border-neutral-200',
    )}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-neutral-500">{label}</p>
          <p className={cn(
            'text-3xl font-bold mt-1',
            variant === 'gold' ? 'text-amber-700' : 'text-neutral-900'
          )}>
            {value.toLocaleString()}
          </p>
        </div>
        <div className={cn(
          'w-12 h-12 rounded-xl flex items-center justify-center',
          variant === 'gold' ? 'bg-amber-100' : 'bg-neutral-100'
        )}>
          <Icon className={cn(
            'w-6 h-6',
            variant === 'gold' ? 'text-amber-600' : 'text-neutral-600'
          )} />
        </div>
      </div>
      {href && (
        <div className="mt-3 flex items-center text-sm text-amber-600 font-medium">
          View all <ChevronRight className="w-4 h-4 ml-1" />
        </div>
      )}
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

function QuickAction({
  label,
  description,
  icon: Icon,
  href,
}: {
  label: string;
  description: string;
  icon: any;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 p-4 rounded-xl border border-neutral-200 bg-white hover:border-amber-300 hover:shadow-md transition-all group"
    >
      <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
        <Icon className="w-5 h-5 text-amber-600" />
      </div>
      <div className="flex-1">
        <p className="font-semibold text-neutral-900">{label}</p>
        <p className="text-sm text-neutral-500">{description}</p>
      </div>
      <ChevronRight className="w-5 h-5 text-neutral-400 group-hover:text-amber-500 transition-colors" />
    </Link>
  );
}

export function SuperDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [pending, setPending] = useState<PendingItems | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/super/dashboard-stats');
      if (!res.ok) throw new Error('Failed to fetch dashboard data');

      const data = await res.json();
      setStats(data.stats);
      setPending(data.pending);
      setRecentActivity(data.recentActivity || []);
      setHealth(data.health);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (isLoading) {
    return (
      <div className="p-8 min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
          <p className="text-neutral-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 min-h-screen bg-neutral-50">
      <div className="max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="Super Admin Dashboard"
          subtitle="Platform overview and management"
          actions={
            <Button
              variant="outline"
              size="sm"
              leftIcon={RefreshCw}
              onClick={fetchDashboard}
              disabled={isLoading}
              className={cn(isLoading && '[&_svg]:animate-spin')}
            >
              Refresh
            </Button>
          }
        />

        {pending && pending.submissions > 0 && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                  <div>
                    <p className="font-semibold text-orange-900">Action Required</p>
                    <p className="text-sm text-orange-700">
                      {pending.submissions} onboarding submission{pending.submissions !== 1 ? 's' : ''} pending review
                    </p>
                  </div>
                </div>
                <Link
                  href="/super/onboarding-submissions"
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors"
                >
                  Review Now
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Developers"
            value={stats?.developers || 0}
            icon={Users}
            href="/super/developers"
            variant="gold"
          />
          <MetricCard
            label="Developments"
            value={stats?.developments || 0}
            icon={Building2}
            href="/super/developments"
          />
          <MetricCard
            label="Units"
            value={stats?.units || 0}
            icon={Home}
            href="/super/units"
          />
          <MetricCard
            label="Questions Asked"
            value={stats?.questions || 0}
            icon={MessageSquare}
            href="/super/analytics"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold text-neutral-900">Quick Actions</h3>
              </CardHeader>
              <CardContent className="space-y-3">
                <QuickAction
                  label="Create Development"
                  description="Set up a new development with branding"
                  icon={Plus}
                  href="/super/projects/new"
                />
                <QuickAction
                  label="Generate Invitation Code"
                  description="Create a new developer signup code"
                  icon={Key}
                  href="/super/invitation-codes"
                />
                <QuickAction
                  label="Review Submissions"
                  description="Process pending onboarding requests"
                  icon={ClipboardList}
                  href="/super/onboarding-submissions"
                />
              </CardContent>
            </Card>
          </div>

          <div>
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold text-neutral-900">Platform Health</h3>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-neutral-500" />
                    <span className="text-sm text-neutral-700">Database</span>
                  </div>
                  <Badge variant={health?.database === 'healthy' ? 'success' : 'error'} size="sm">
                    {health?.database || 'Unknown'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-neutral-500" />
                    <span className="text-sm text-neutral-700">API</span>
                  </div>
                  <Badge variant={health?.api === 'healthy' ? 'success' : 'error'} size="sm">
                    {health?.api || 'Unknown'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-neutral-500" />
                    <span className="text-sm text-neutral-700">Units with Purchaser</span>
                  </div>
                  <span className="text-sm font-medium text-neutral-900">
                    {stats?.unitsWithPurchaser || 0}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {recentActivity.length > 0 && (
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold text-neutral-900">Recent Activity</h3>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentActivity.slice(0, 5).map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 py-2 border-b border-neutral-100 last:border-0"
                  >
                    <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center">
                      <MessageSquare className="w-4 h-4 text-neutral-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-neutral-700">{activity.description || 'Activity'}</p>
                      <p className="text-xs text-neutral-400">
                        {activity.timestamp ? new Date(activity.timestamp).toLocaleString() : 'Recently'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default SuperDashboard;
