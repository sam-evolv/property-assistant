'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Building2,
  Users,
  Wrench,
  Shield,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowLeft,
  Home,
  DollarSign,
} from 'lucide-react';
import {
  UNIT_STATUS_CONFIG,
  PRIORITY_CONFIG,
} from '@/types/btr';
import type {
  BTRDashboardStats,
  MaintenanceRequest,
  ComplianceItem,
  UnitStatus,
  MaintenancePriority,
  ComplianceStatus,
} from '@/types/btr';

interface BTRUnit {
  id: string;
  unit_number?: string;
  address?: string;
  unit_status?: UnitStatus;
  development_id?: string;
}

interface BTRTenancy {
  id: string;
  unit_id: string;
  tenant_name: string;
  status: string;
}

interface BTRData {
  development: { id: string; name: string; project_type?: string };
  stats: BTRDashboardStats;
  units: BTRUnit[];
  tenancies: BTRTenancy[];
  recentMaintenance: MaintenanceRequest[];
  complianceAlerts: ComplianceItem[];
}

function formatEuro(value: number): string {
  if (value >= 1000000) return `€${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `€${Math.round(value / 1000)}K`;
  return `€${value}`;
}

const COMPLIANCE_STATUS_CONFIG: Record<string, { color: string; bgColor: string }> = {
  overdue: { color: '#DC2626', bgColor: '#FEF2F2' },
  due_soon: { color: '#D97706', bgColor: '#FFFBEB' },
  upcoming: { color: '#2563EB', bgColor: '#EFF6FF' },
  completed: { color: '#059669', bgColor: '#ECFDF5' },
};

export default function BTROverviewPage() {
  const params = useParams();
  const router = useRouter();
  const developmentId = params.developmentId as string;

  const [data, setData] = useState<BTRData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const res = await fetch(`/api/developments/${developmentId}/btr`);
        if (!res.ok) throw new Error('Failed to fetch BTR data');
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [developmentId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div
            className="w-10 h-10 rounded-full border-t-transparent animate-spin mx-auto"
            style={{ borderWidth: 3, borderStyle: 'solid', borderColor: '#D4AF37', borderTopColor: 'transparent' }}
          />
          <p className="text-sm text-black mt-4">Loading BTR overview...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 mx-auto mb-4" style={{ color: '#EF4444' }} />
          <h2 className="text-lg font-semibold text-black mb-2">Failed to load BTR data</h2>
          <p className="text-sm text-black mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 font-medium rounded-lg text-white transition-colors"
            style={{ backgroundColor: '#D4AF37' }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const { development, stats, units, tenancies, recentMaintenance, complianceAlerts } = data;

  const tenancyByUnit: Record<string, BTRTenancy> = {};
  tenancies.forEach((t) => {
    tenancyByUnit[t.unit_id] = t;
  });

  const maintenanceCountByUnit: Record<string, number> = {};
  recentMaintenance.forEach((m) => {
    maintenanceCountByUnit[m.unit_id] = (maintenanceCountByUnit[m.unit_id] || 0) + 1;
  });

  const btrBasePath = `/developer/btr/${developmentId}`;

  const navLinks = [
    { label: 'Units', href: `${btrBasePath}/units` },
    { label: 'Maintenance', href: `${btrBasePath}/maintenance` },
    { label: 'Compliance', href: `${btrBasePath}/compliance` },
    { label: 'Amenities', href: `${btrBasePath}/amenities` },
    { label: 'Welcome', href: `${btrBasePath}/welcome` },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/developer')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" style={{ color: '#111827' }} />
              </button>
              <div>
                <h1 className="text-xl font-bold font-serif" style={{ color: '#111827' }}>
                  BTR Overview - {development.name}
                </h1>
                <p className="text-sm" style={{ color: '#111827' }}>Build to Rent Management Dashboard</p>
              </div>
            </div>
          </div>
          <div className="flex gap-1 mt-4 -mb-px overflow-x-auto">
            <Link
              href={`${btrBasePath}/overview`}
              className="flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap"
              style={{ borderColor: '#D4AF37', color: '#D4AF37' }}
            >
              <Building2 className="w-4 h-4" />
              Overview
            </Link>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 border-transparent whitespace-nowrap hover:border-gray-300"
                style={{ color: '#111827' }}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: '#FEFCE8' }}>
              <Home className="w-5 h-5" style={{ color: '#D4AF37' }} />
            </div>
            <div className="text-3xl font-bold text-black">{stats.occupancyRate}%</div>
            <div className="text-sm text-black">Occupancy Rate</div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: '#FEFCE8' }}>
              <DollarSign className="w-5 h-5" style={{ color: '#D4AF37' }} />
            </div>
            <div className="text-3xl font-bold text-black">{formatEuro(stats.monthlyRentRoll)}</div>
            <div className="text-sm text-black">Monthly Rent Roll</div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: '#FEFCE8' }}>
              <Wrench className="w-5 h-5" style={{ color: '#D4AF37' }} />
            </div>
            <div className="text-3xl font-bold text-black">{stats.openMaintenanceRequests}</div>
            <div className="text-sm text-black">Open Maintenance</div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: '#FEFCE8' }}>
              <Shield className="w-5 h-5" style={{ color: '#D4AF37' }} />
            </div>
            <div className="text-3xl font-bold text-black">{stats.overdueCompliance + stats.upcomingCompliance}</div>
            <div className="text-sm text-black">Compliance Alerts</div>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-bold font-serif mb-4" style={{ color: '#111827' }}>Unit Status</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {units.map((unit) => {
              const status = (unit.unit_status || 'vacant') as UnitStatus;
              const config = UNIT_STATUS_CONFIG[status] || UNIT_STATUS_CONFIG.vacant;
              const tenancy = tenancyByUnit[unit.id];
              const maintCount = maintenanceCountByUnit[unit.id] || 0;
              const unitLabel = unit.unit_number || unit.address || unit.id;

              return (
                <div
                  key={unit.id}
                  className="p-4 rounded-xl border hover:shadow-md transition-shadow cursor-pointer"
                  style={{
                    backgroundColor: config.bgColor,
                    borderColor: config.dotColor,
                  }}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: config.dotColor }} />
                    <span className="text-xs font-bold" style={{ color: config.color }}>{config.label}</span>
                  </div>
                  <div className="text-sm font-semibold truncate" style={{ color: '#111827' }}>{unitLabel}</div>
                  <div className="text-xs truncate" style={{ color: '#6B7280' }}>
                    {tenancy?.tenant_name || 'Available'}
                  </div>
                  {maintCount > 0 && (
                    <div className="text-xs mt-1 flex items-center gap-1" style={{ color: '#D97706' }}>
                      <Wrench className="w-3 h-3" />
                      {maintCount} open
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: '#111827' }}>
              Recent Maintenance
            </h3>
            {recentMaintenance.length === 0 ? (
              <p className="text-sm" style={{ color: '#6B7280' }}>No maintenance requests</p>
            ) : (
              <div className="space-y-2">
                {recentMaintenance.map((m) => {
                  const priorityConfig = PRIORITY_CONFIG[m.priority as MaintenancePriority] || PRIORITY_CONFIG.routine;
                  return (
                    <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB' }}>
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: priorityConfig.bgColor }}
                      >
                        <Wrench className="w-3.5 h-3.5" style={{ color: priorityConfig.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate" style={{ color: '#111827' }}>{m.title}</div>
                        <div className="text-xs" style={{ color: '#6B7280' }}>
                          {m.unit?.address || `Unit ${m.unit_id}`}
                        </div>
                      </div>
                      <span
                        className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full flex-shrink-0"
                        style={{ backgroundColor: priorityConfig.bgColor, color: priorityConfig.color }}
                      >
                        {priorityConfig.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: '#111827' }}>
              Compliance Alerts
            </h3>
            {complianceAlerts.length === 0 ? (
              <p className="text-sm" style={{ color: '#6B7280' }}>No compliance alerts</p>
            ) : (
              <div className="space-y-2">
                {complianceAlerts.map((c) => {
                  const statusConfig = COMPLIANCE_STATUS_CONFIG[c.status] || COMPLIANCE_STATUS_CONFIG.upcoming;
                  const StatusIcon = c.status === 'overdue' ? AlertCircle : c.status === 'due_soon' ? Clock : CheckCircle2;
                  return (
                    <div
                      key={c.id}
                      className="flex items-center gap-3 p-3 rounded-lg"
                      style={{ backgroundColor: statusConfig.bgColor }}
                    >
                      <StatusIcon className="w-4 h-4 flex-shrink-0" style={{ color: statusConfig.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate" style={{ color: '#111827' }}>{c.title}</div>
                        <div className="text-xs" style={{ color: statusConfig.color }}>
                          Due: {new Date(c.due_date).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      </div>
                      <span
                        className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full flex-shrink-0"
                        style={{ backgroundColor: statusConfig.bgColor, color: statusConfig.color }}
                      >
                        {c.status === 'overdue' ? 'Overdue' : c.status === 'due_soon' ? 'Due Soon' : c.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
