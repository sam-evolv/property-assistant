'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  Sun, Zap, Activity, AlertTriangle,
  Plus, Bell, Download, BarChart3,
  RefreshCw, ChevronRight, CheckCircle, Clock, ArrowRight,
  Loader2, Users, TrendingUp, Send, Check,
} from 'lucide-react';
import { StatCard, StatCardGrid } from '@/components/ui/StatCard';
import { QuickActionsBar } from '@/components/ui/QuickActions';
import type { QuickAction } from '@/components/ui/QuickActions';
import { ProactiveAlertsWidget } from '@/components/ui/ProactiveAlerts';
import type { Alert } from '@/components/ui/ProactiveAlerts';
import { StatCardGridSkeleton, CardSkeleton } from '@/components/ui/Skeleton';

interface Installation {
  id: string;
  job_reference: string;
  customer_name: string;
  address_line_1: string;
  city: string;
  county: string;
  system_type: string;
  system_size_kwp: number | null;
  inverter_model: string | null;
  install_date: string | null;
  health_status: string;
  portal_status: string;
  energy_generated_kwh: number | null;
  savings_eur: number | null;
  warranty_expiry: string | null;
  created_at: string;
}

interface SupportQuery {
  id: string;
  query_status: string;
  resolved_without_callout: boolean;
  created_at: string;
}

interface ActivityItem {
  id: string;
  activity_type: string;
  description: string;
  created_at: string;
}

const SYSTEM_LABELS: Record<string, string> = {
  solar_pv: 'Solar PV',
  heat_pump: 'Heat Pump',
  mvhr: 'MVHR',
  ev_charger: 'EV Charger',
};

const ACTIVITY_STYLES: Record<string, { dot: string }> = {
  installation_added: { dot: 'bg-green-500' },
  portal_activated: { dot: 'bg-blue-500' },
  support_raised: { dot: 'bg-amber-500' },
  support_resolved: { dot: 'bg-green-500' },
  diagnostic_triggered: { dot: 'bg-blue-500' },
};

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });
}

function generateAlerts(installations: Installation[]): Alert[] {
  const alerts: Alert[] = [];

  const flagged = installations.filter(i => i.health_status === 'warning' || i.health_status === 'fault');
  if (flagged.length > 0) {
    alerts.push({
      id: 'flagged-installations',
      title: `${flagged.length} installation${flagged.length > 1 ? 's' : ''} need${flagged.length === 1 ? 's' : ''} attention`,
      description: 'Systems with warnings or faults require investigation',
      priority: 'warning',
      count: flagged.length,
      link: '/care-dashboard/installations',
      linkLabel: 'View Installations',
      items: flagged.map(i => ({
        id: i.id,
        label: `${i.job_reference} — ${i.address_line_1}, ${i.city}`,
        sublabel: `${SYSTEM_LABELS[i.system_type] || i.system_type} · ${i.health_status}`,
        link: '/care-dashboard/installations',
      })),
    });
  }

  const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const pendingPortals = installations.filter(
    i => i.portal_status === 'pending' && new Date(i.created_at).getTime() < fourteenDaysAgo
  );
  if (pendingPortals.length > 0) {
    alerts.push({
      id: 'pending-portals',
      title: `${pendingPortals.length} portal${pendingPortals.length > 1 ? 's' : ''} still pending activation`,
      description: 'These customers haven\'t activated their portal yet',
      priority: 'info',
      count: pendingPortals.length,
      link: '/care-dashboard/installations',
      linkLabel: 'Send Activation Links',
      items: pendingPortals.map(i => ({
        id: i.id,
        label: `${i.job_reference} — ${i.customer_name}`,
        sublabel: `Created ${new Date(i.created_at).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })}`,
        link: '/care-dashboard/installations',
      })),
    });
  }

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

export default function CareDashboardOverview() {
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [supportQueries, setSupportQueries] = useState<SupportQuery[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [sentReminders, setSentReminders] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [instRes, sqRes, actRes] = await Promise.all([
        fetch('/api/care/dashboard-stats'),
        fetch('/api/care/support-queries'),
        fetch('/api/care/activity-log'),
      ]);

      if (instRes.ok) {
        const data = await instRes.json();
        setInstallations(data.installations || []);
      }
      if (sqRes.ok) {
        const data = await sqRes.json();
        setSupportQueries(data.queries || []);
      }
      if (actRes.ok) {
        const data = await actRes.json();
        setActivities(data.activities || []);
      }
    } catch {
      // Will show empty state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await fetch('/api/care/seed', { method: 'POST' });
      await fetchData();
    } finally {
      setSeeding(false);
    }
  };

  const handleSendReminder = (installId: string) => {
    setSentReminders(prev => new Set(prev).add(installId));
  };

  // Computed stats
  const active = installations;
  const totalCapacity = active.reduce((sum, i) => sum + (Number(i.system_size_kwp) || 0), 0);
  const healthyCount = active.filter(i => i.health_status === 'healthy').length;
  const healthPct = active.length > 0 ? Math.round((healthyCount / active.length) * 100) : 0;
  const faultCount = active.filter(i => i.health_status === 'fault' || i.health_status === 'warning').length;
  const recent = [...installations]
    .sort((a, b) => {
      const aDate = new Date(a.install_date || a.created_at).getTime();
      const bDate = new Date(b.install_date || b.created_at).getTime();
      return bDate - aDate;
    })
    .slice(0, 5);
  const alerts = generateAlerts(installations);

  // Callout deflection stats
  const deflectedCount = supportQueries.filter(q => q.resolved_without_callout).length;
  const costPerCallout = 50;
  const deflectedSavings = deflectedCount * costPerCallout;

  // Portal adoption
  const activatedCount = installations.filter(i => i.portal_status === 'activated' || i.portal_status === 'active').length;
  const totalCount = installations.length;
  const adoptionPct = totalCount > 0 ? Math.round((activatedCount / totalCount) * 100) : 0;
  const pendingInstallations = installations.filter(i => i.portal_status === 'pending');

  const quickActions: QuickAction[] = [
    {
      id: 'log-installation',
      label: 'Log Installation',
      icon: Plus,
      onClick: () => window.location.href = '/care-dashboard/installations/new',
      variant: 'primary',
    },
    { id: 'send-notification', label: 'Send Notification', icon: Bell, onClick: () => {} },
    { id: 'export-report', label: 'Export Report', icon: Download, onClick: () => {} },
    { id: 'view-analytics', label: 'View Analytics', icon: BarChart3, onClick: () => {} },
  ];

  if (loading) {
    return (
      <div className="min-h-full bg-gray-50 p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="mb-6">
            <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-2" />
            <div className="h-4 w-80 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="h-14 bg-white rounded-xl border border-gray-200 animate-pulse" />
          <StatCardGridSkeleton count={4} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <CardSkeleton className="lg:col-span-2" />
            <CardSkeleton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gray-50">
      <div className="p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="mb-2">
              <h1 className="text-2xl font-bold text-gray-900">{getGreeting()},</h1>
              <p className="text-sm text-gray-500 mt-1">
                Here&apos;s what&apos;s happening with your installations today.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {installations.length === 0 && (
                <button
                  onClick={handleSeed}
                  disabled={seeding}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-gold-500 text-white hover:bg-gold-600 transition-colors disabled:opacity-50"
                >
                  {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Seed Demo Data
                </button>
              )}
              <button
                onClick={() => fetchData(true)}
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
          </div>

          {/* Quick Actions Bar */}
          <QuickActionsBar actions={quickActions} />

          {/* Stat Cards */}
          <StatCardGrid columns={4}>
            <StatCard label="Active Installations" value={active.length} icon={Sun} iconColor="text-[#D4AF37]" />
            <StatCard
              label="Total Capacity"
              value={totalCapacity >= 1000 ? `${(totalCapacity / 1000).toFixed(1)} MWp` : `${totalCapacity.toFixed(1)} kWp`}
              icon={Zap} iconColor="text-blue-500"
            />
            <StatCard label="Avg System Health" value={`${healthPct}%`} icon={Activity} iconColor="text-emerald-500" />
            <StatCard label="Open Faults" value={faultCount} icon={AlertTriangle} iconColor="text-amber-500" />
          </StatCardGrid>

          {/* Needs Attention */}
          <ProactiveAlertsWidget alerts={alerts} />

          {/* Recent Installations */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Recent Installations</h3>
              <Link
                href="/care-dashboard/installations"
                className="text-xs font-medium text-gold-600 hover:text-gold-700 flex items-center gap-1"
              >
                View All <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {recent.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Sun className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">No installations yet. Seed demo data or create your first installation.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {recent.map((inst) => {
                  const systemLabel = SYSTEM_LABELS[inst.system_type] || inst.system_type;
                  const sizeLabel = inst.system_size_kwp ? `${inst.system_size_kwp} kWp` : '';
                  const dateStr = inst.install_date
                    ? new Date(inst.install_date).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })
                    : '';
                  const statusColor = inst.health_status === 'healthy' ? 'text-emerald-500' : 'text-amber-500';

                  return (
                    <div key={inst.id} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50/50 transition-colors">
                      <CheckCircle className={`w-4 h-4 flex-shrink-0 ${statusColor}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900">
                          <span className="font-medium">{inst.job_reference}</span>
                          {' — '}{inst.address_line_1}, {inst.city}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {[systemLabel, inst.inverter_model, sizeLabel].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          inst.health_status === 'healthy' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {inst.health_status}
                        </span>
                        {dateStr && <p className="text-xs text-gray-400 mt-1">{dateStr}</p>}
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Two-column layout: Deflection + Portal | Activity Feed */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column: Callout Deflection + Portal Adoption */}
            <div className="lg:col-span-2 space-y-6">

              {/* Callout Deflection Card — Hero metric */}
              <div className="bg-white rounded-xl border-2 border-[#D4AF37]/30 shadow-sm p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#D4AF37]/5 to-transparent rounded-bl-full" />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 rounded-lg bg-[#D4AF37]/10">
                      <Zap className="w-5 h-5 text-[#D4AF37]" />
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#D4AF37]">AI Deflection</span>
                  </div>
                  <div className="flex items-baseline gap-3 mb-2">
                    <span className="text-4xl font-bold text-gray-900">{deflectedCount}</span>
                    <span className="text-sm text-gray-600">
                      quer{deflectedCount !== 1 ? 'ies' : 'y'} resolved without a callout this month
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-3">
                    <span className="text-sm font-semibold text-gray-900">
                      Estimated saving: <span className="text-[#D4AF37]">&euro;{deflectedSavings.toLocaleString()}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                      <TrendingUp className="w-3 h-3" />
                      12% vs last month
                    </span>
                  </div>
                </div>
              </div>

              {/* Portal Adoption Card */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 rounded-lg bg-blue-50">
                    <Users className="w-5 h-5 text-blue-500" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900">Portal Adoption</h3>
                </div>

                <p className="text-sm text-gray-600 mb-3">
                  <span className="font-semibold text-gray-900">{activatedCount} of {totalCount}</span> customers have activated their portal
                </p>

                {/* Progress bar */}
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-1">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${adoptionPct}%`,
                      background: 'linear-gradient(90deg, #D4AF37, #c4a030)',
                    }}
                  />
                </div>
                <p className="text-xs text-gray-400 mb-4">{adoptionPct}% activated</p>

                {/* Pending installations */}
                {pendingInstallations.length > 0 && (
                  <div className="border-t border-gray-100 pt-4 space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Pending Activation</p>
                    {pendingInstallations.map((inst) => {
                      const sent = sentReminders.has(inst.id);
                      return (
                        <div key={inst.id} className="flex items-center justify-between py-1.5">
                          <div className="min-w-0">
                            <p className="text-sm text-gray-700 truncate">
                              {inst.job_reference} — {inst.address_line_1}, {inst.city}
                            </p>
                          </div>
                          <button
                            onClick={() => handleSendReminder(inst.id)}
                            disabled={sent}
                            className={cn(
                              'flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg transition-all duration-150 active:scale-[0.98] flex-shrink-0 ml-3',
                              sent
                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100'
                            )}
                          >
                            {sent ? <Check className="w-3 h-3" /> : <Send className="w-3 h-3" />}
                            {sent ? 'Sent' : 'Send Reminder'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right column: Recent Activity */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">Recent Activity</h3>
                <p className="text-xs text-gray-500 mt-0.5">Last 7 days</p>
              </div>
              {activities.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No recent activity</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {activities.map((act) => {
                    const style = ACTIVITY_STYLES[act.activity_type] || { dot: 'bg-gray-400' };
                    return (
                      <div key={act.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50/50 transition-colors">
                        <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${style.dot}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-700 leading-snug">{act.description}</p>
                          <p className="text-xs text-gray-400 mt-1">{formatRelativeTime(act.created_at)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
