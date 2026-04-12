'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Users,
  AlertTriangle,
  TrendingUp,
  Target,
  CalendarPlus,
  Mail,
  BarChart3,
  Sparkles,
  RefreshCw,
  ChevronRight,
  AlertCircle,
  FolderArchive,
} from 'lucide-react';
import { StatCard, StatCardGrid } from '@/components/ui/StatCard';
import { QuickActionsBar } from '@/components/ui/QuickActions';
import type { QuickAction } from '@/components/ui/QuickActions';
import { ProactiveAlertsWidget } from '@/components/ui/ProactiveAlerts';
import type { Alert, AlertItem } from '@/components/ui/ProactiveAlerts';
import { ActivityFeedWidget } from '@/components/ui/ActivityFeed';
import type { ActivityItem } from '@/components/ui/ActivityFeed';
import { useAgentDashboard } from '../layout-provider';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface PipelineItem {
  id: string;
  unitId: string;
  unitNumber: string;
  developmentId: string;
  developmentName: string;
  status: string;
  purchaserName: string;
  dates: {
    saleAgreed?: string;
    deposit?: string;
    contractsIssued?: string;
    contractsSigned?: string;
    counterSigned?: string;
    drawdown?: string;
    handover?: string;
    estimatedClose?: string;
  };
  prices: { sale?: number };
}

const tokens = {
  gold: '#D4AF37',
  goldDark: '#B8934C',
  cream: '#fafaf8',
  dark: '#1a1a1a',
};

export default function AgentDashboardOverview() {
  const router = useRouter();
  const { profile, developments, selectedSchemeId } = useAgentDashboard();
  const [pipeline, setPipeline] = useState<PipelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetch('/api/agent/pipeline-data');
      if (!res.ok) return;
      const data = await res.json();
      setPipeline(data.pipeline ?? []);
    } catch { /* silent */ }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    if (!selectedSchemeId) return pipeline;
    return pipeline.filter(p => p.developmentId === selectedSchemeId);
  }, [pipeline, selectedSchemeId]);

  const stats = useMemo(() => {
    const sold = filtered.filter(p => ['sold', 'complete'].includes(p.status));
    const active = filtered.filter(p => ['agreed', 'sale_agreed', 'in_progress', 'signed', 'contracts_issued', 'contracts_signed'].includes(p.status));
    const overdue = filtered.filter(p =>
      p.dates?.contractsIssued && !p.dates?.contractsSigned &&
      new Date(p.dates.contractsIssued) < new Date(Date.now() - 21 * 86400000)
    );
    const revenueSold = sold.reduce((sum, p) => sum + (p.prices?.sale || 0), 0);
    const pipelineValue = active.reduce((sum, p) => sum + (p.prices?.sale || 0), 0);
    return { sold: sold.length, active: active.length, overdue, overdueCount: overdue.length, revenueSold, pipelineValue };
  }, [filtered]);

  const schemeStats = useMemo(() => {
    const map: Record<string, { id: string; name: string; total: number; sold: number; active: number; overdue: number }> = {};
    for (const p of pipeline) {
      if (!map[p.developmentId]) {
        map[p.developmentId] = { id: p.developmentId, name: p.developmentName, total: 0, sold: 0, active: 0, overdue: 0 };
      }
      const s = map[p.developmentId];
      s.total++;
      if (['sold', 'complete'].includes(p.status)) s.sold++;
      if (['agreed', 'sale_agreed', 'in_progress', 'signed', 'contracts_issued', 'contracts_signed'].includes(p.status)) s.active++;
      if (p.dates?.contractsIssued && !p.dates?.contractsSigned && new Date(p.dates.contractsIssued) < new Date(Date.now() - 21 * 86400000)) s.overdue++;
    }
    return Object.values(map);
  }, [pipeline]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = profile.display_name?.split(' ')[0] || 'there';

  const formatCurrency = (v: number) => {
    if (v >= 1000000) return `\u20AC${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `\u20AC${(v / 1000).toFixed(0)}K`;
    return `\u20AC${v}`;
  };

  // Quick actions
  const quickActions: QuickAction[] = [
    { id: 'new-viewing', label: 'New Viewing', icon: CalendarPlus, onClick: () => router.push('/agent/dashboard/viewings'), variant: 'primary' },
    { id: 'draft-email', label: 'Draft Email', icon: Mail, onClick: () => router.push('/agent/dashboard/communications') },
    { id: 'view-analytics', label: 'View Analytics', icon: BarChart3, onClick: () => router.push('/agent/dashboard/analytics') },
    { id: 'ask-intelligence', label: 'Ask Intelligence', icon: Sparkles, onClick: () => router.push('/agent/dashboard/intelligence') },
  ];

  // Proactive alerts
  const alerts: Alert[] = useMemo(() => {
    const result: Alert[] = [];

    if (stats.overdueCount > 0) {
      result.push({
        id: 'overdue-contracts',
        title: `${stats.overdueCount} overdue contracts`,
        description: 'Contracts issued but not signed within 21 days',
        priority: stats.overdueCount >= 5 ? 'critical' : 'warning',
        count: stats.overdueCount,
        link: '/agent/dashboard/analytics',
        linkLabel: 'View Risk Register',
        items: stats.overdue.slice(0, 5).map(p => ({
          id: p.id,
          label: `${p.purchaserName || p.unitNumber} \u2014 ${p.developmentName}`,
          sublabel: `Contracts issued ${Math.floor((Date.now() - new Date(p.dates.contractsIssued!).getTime()) / 86400000)}d ago`,
          link: `/agent/dashboard/intelligence?prompt=${encodeURIComponent(`Chase solicitor for ${p.purchaserName} on ${p.unitNumber} in ${p.developmentName}`)}`,
        })),
      });
    }

    if (result.length === 0) {
      result.push({
        id: 'all-clear',
        title: 'All systems operational',
        description: 'No immediate action required',
        priority: 'ready',
      });
    }
    return result;
  }, [stats]);

  // Activity feed
  const activityItems: ActivityItem[] = useMemo(() => {
    const items: ActivityItem[] = [];
    // Recent overdue items as alerts
    stats.overdue.slice(0, 3).forEach(p => {
      items.push({
        id: `overdue-${p.id}`,
        type: 'alert',
        title: `Contract overdue \u2014 ${p.purchaserName || p.unitNumber}`,
        description: `${p.developmentName}`,
        timestamp: p.dates.contractsIssued || new Date().toISOString(),
      });
    });
    // Recent sale agreed
    pipeline.filter(p => p.dates?.saleAgreed).sort((a, b) => new Date(b.dates.saleAgreed!).getTime() - new Date(a.dates.saleAgreed!).getTime()).slice(0, 4).forEach(p => {
      items.push({
        id: `agreed-${p.id}`,
        type: 'completion',
        title: `Sale agreed \u2014 ${p.purchaserName || p.unitNumber}`,
        description: `${p.developmentName}`,
        timestamp: p.dates.saleAgreed!,
      });
    });
    return items;
  }, [stats, pipeline]);

  if (loading) {
    return (
      <div className="min-h-full p-6 lg:p-8" style={{ backgroundColor: tokens.cream }}>
        <div className="h-8 w-64 bg-gray-200 rounded-lg animate-pulse mb-2" />
        <div className="h-5 w-96 bg-gray-100 rounded-lg animate-pulse mb-8" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-28 bg-white rounded-xl border border-gray-200 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full" style={{ backgroundColor: tokens.cream }}>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {greeting}, {firstName}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Here&apos;s what&apos;s happening across your schemes today
            </p>
          </div>
          <button
            onClick={() => fetchData(true)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Quick Actions */}
        <QuickActionsBar actions={quickActions} />

        {/* Live Activity Pulse */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-full px-3.5 py-1.5 shadow-sm">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
            </span>
            <span className="text-xs font-semibold text-green-700">LIVE</span>
          </div>
          <span className="text-sm text-gray-500">{stats.active} active buyers</span>
          {stats.overdueCount > 0 && (
            <span className="text-sm text-red-600 font-medium">{stats.overdueCount} overdue contracts</span>
          )}
        </div>

        {/* Proactive Alerts */}
        <ProactiveAlertsWidget alerts={alerts} collapsible defaultExpanded />

        {/* Stat Cards */}
        <StatCardGrid columns={5}>
          <StatCard label="Total Units" value={filtered.length} icon={Building2} iconColor="text-gold-500" />
          <StatCard label="Active Buyers" value={stats.active} icon={Users} iconColor="text-blue-500" />
          <StatCard label="Overdue" value={stats.overdueCount} icon={AlertTriangle} iconColor="text-red-500" />
          <StatCard label="Revenue Sold" value={formatCurrency(stats.revenueSold)} icon={TrendingUp} iconColor="text-green-500" />
          <StatCard label="Pipeline Value" value={formatCurrency(stats.pipelineValue)} icon={Target} iconColor="text-purple-500" />
        </StatCardGrid>

        {/* Schemes Table + Activity Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Schemes Table (2/3) */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Active Schemes</h2>
              <Link
                href="/agent/dashboard/pipeline"
                className="text-sm font-medium text-gold-600 hover:text-gold-700 flex items-center gap-1"
              >
                View pipeline <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Scheme</th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Units</th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Sold</th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Active</th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Overdue</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-40">Progress</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {schemeStats.map((scheme) => {
                    const pct = scheme.total > 0 ? Math.round((scheme.sold / scheme.total) * 100) : 0;
                    return (
                      <tr
                        key={scheme.id}
                        onClick={() => router.push(`/agent/dashboard/pipeline?scheme=${scheme.id}`)}
                        className="group cursor-pointer transition-colors hover:bg-gray-50/50"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-9 h-9 rounded-xl flex items-center justify-center"
                              style={{ background: `linear-gradient(135deg, ${tokens.gold} 0%, ${tokens.goldDark} 100%)`, color: tokens.dark }}
                            >
                              <Building2 className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{scheme.name}</p>
                              <p className="text-xs text-gray-500">{scheme.total} units</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-center text-sm font-medium text-gray-600">{scheme.total}</td>
                        <td className="px-5 py-4 text-center text-sm font-medium text-green-600">{scheme.sold}</td>
                        <td className="px-5 py-4 text-center text-sm font-medium" style={{ color: tokens.gold }}>{scheme.active}</td>
                        <td className="px-5 py-4 text-center">
                          {scheme.overdue > 0 ? (
                            <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full text-xs font-bold text-white bg-red-500">
                              {scheme.overdue}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            {pct > 0 && (
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tokens.gold }} />
                            )}
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${tokens.gold} 0%, ${tokens.gold}99 100%)` }}
                              />
                            </div>
                            <span className="text-xs font-semibold text-gray-500 w-10 text-right">{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {schemeStats.length === 0 && (
                <div className="px-5 py-12 text-center">
                  <Building2 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No schemes assigned</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Activity Feed */}
            <ActivityFeedWidget
              activities={activityItems}
              title="Recent Activity"
              maxItems={6}
              groupByDate
            />

            {/* Quick Links */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">Quick Links</h3>
              </div>
              {[
                { label: 'Clients & Buyers', href: '/agent/dashboard/clients', icon: Users },
                { label: 'Documents', href: '/agent/dashboard/documents', icon: FolderArchive },
                { label: 'Analytics', href: '/agent/dashboard/analytics', icon: BarChart3 },
                { label: 'Intelligence', href: '/agent/dashboard/intelligence', icon: Sparkles },
              ].map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                      <Icon className="w-4 h-4 text-gray-500" />
                    </div>
                    <span className="text-sm font-medium text-gray-700 flex-1">{link.label}</span>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
