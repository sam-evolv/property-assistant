'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  Sun, Zap, Activity, AlertTriangle,
  Plus, Bell, Download, BarChart3,
  RefreshCw, ChevronRight, CheckCircle, Clock, ArrowRight,
  Loader2,
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
  is_active: boolean;
  energy_generated_kwh: number | null;
  savings_eur: number | null;
  warranty_expiry: string | null;
  created_at: string;
}

const SYSTEM_LABELS: Record<string, string> = {
  solar_pv: 'Solar PV',
  heat_pump: 'Heat Pump',
  mvhr: 'MVHR',
  ev_charger: 'EV Charger',
};

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function generateAlerts(installations: Installation[]): Alert[] {
  const alerts: Alert[] = [];

  // Flagged installations
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

  // Pending portals older than 14 days
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await fetch('/api/care/dashboard-stats');
      if (res.ok) {
        const data = await res.json();
        setInstallations(data.installations || []);
      } else {
        // Fallback: try direct query
        const res2 = await fetch('/api/care/installations-all');
        if (res2.ok) {
          const data2 = await res2.json();
          setInstallations(data2.installations || []);
        }
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

  // Computed stats
  const active = installations.filter(i => i.is_active);
  const totalCapacity = active.reduce((sum, i) => sum + (Number(i.system_size_kwp) || 0), 0);
  const healthyCount = active.filter(i => i.health_status === 'healthy').length;
  const healthPct = active.length > 0 ? Math.round((healthyCount / active.length) * 100) : 0;
  const faultCount = active.filter(i => i.health_status === 'fault' || i.health_status === 'warning').length;
  const recent = [...installations].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);
  const alerts = generateAlerts(installations);

  const quickActions: QuickAction[] = [
    {
      id: 'log-installation',
      label: 'Log Installation',
      icon: Plus,
      onClick: () => window.location.href = '/care-dashboard/installations/new',
      variant: 'primary',
    },
    {
      id: 'send-notification',
      label: 'Send Notification',
      icon: Bell,
      onClick: () => {},
    },
    {
      id: 'export-report',
      label: 'Export Report',
      icon: Download,
      onClick: () => {},
    },
    {
      id: 'view-analytics',
      label: 'View Analytics',
      icon: BarChart3,
      onClick: () => {},
    },
  ];

  // Loading skeleton
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
              <h1 className="text-2xl font-bold text-gray-900">
                {getGreeting()},
              </h1>
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
            <StatCard
              label="Active Installations"
              value={active.length}
              icon={Sun}
              iconColor="text-[#D4AF37]"
            />
            <StatCard
              label="Total Capacity"
              value={totalCapacity >= 1000 ? `${(totalCapacity / 1000).toFixed(1)} MWp` : `${totalCapacity.toFixed(1)} kWp`}
              icon={Zap}
              iconColor="text-blue-500"
            />
            <StatCard
              label="Avg System Health"
              value={`${healthPct}%`}
              icon={Activity}
              iconColor="text-emerald-500"
            />
            <StatCard
              label="Open Faults"
              value={faultCount}
              icon={AlertTriangle}
              iconColor="text-amber-500"
            />
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
                View All
                <ArrowRight className="w-3 h-3" />
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
                    <div
                      key={inst.id}
                      className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50/50 transition-colors"
                    >
                      <CheckCircle className={`w-4 h-4 flex-shrink-0 ${statusColor}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900">
                          <span className="font-medium">{inst.job_reference}</span>
                          {' — '}
                          {inst.address_line_1}, {inst.city}
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
                        {dateStr && (
                          <p className="text-xs text-gray-400 mt-1">{dateStr}</p>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
