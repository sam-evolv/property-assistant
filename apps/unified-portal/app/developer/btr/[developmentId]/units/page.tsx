'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Building2,
  Users,
  ArrowLeft,
  Plus,
  UserPlus,
  UserMinus,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  Filter,
} from 'lucide-react';
import { UNIT_STATUS_CONFIG } from '@/types/btr';
import type {
  UnitStatus,
  Tenancy,
  BTRDashboardStats,
  MaintenanceRequest,
} from '@/types/btr';

interface BTRUnit {
  id: string;
  unit_number?: string;
  address?: string;
  unit_status?: UnitStatus;
  development_id?: string;
}

interface BTRData {
  development: { id: string; name: string; project_type?: string };
  stats: BTRDashboardStats;
  units: BTRUnit[];
  tenancies: Tenancy[];
  recentMaintenance: MaintenanceRequest[];
}

function formatEuro(value: number): string {
  if (value >= 1000000) return `€${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `€${Math.round(value / 1000)}K`;
  return `€${value}`;
}

type FilterType = 'all' | 'occupied' | 'vacant' | 'void' | 'maintenance';

export default function BTRUnitsPage() {
  const params = useParams();
  const developmentId = params.developmentId as string;

  const [data, setData] = useState<BTRData | null>(null);
  const [allTenancies, setAllTenancies] = useState<Tenancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [expandedUnitId, setExpandedUnitId] = useState<string | null>(null);
  const [showNewTenancyForm, setShowNewTenancyForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newTenancy, setNewTenancy] = useState({
    tenant_name: '',
    tenant_email: '',
    tenant_phone: '',
    monthly_rent: '',
    lease_start: '',
  });

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [btrRes, tenancyRes] = await Promise.all([
          fetch(`/api/developments/${developmentId}/btr`),
          fetch(`/api/developments/${developmentId}/btr/tenancies`),
        ]);

        if (!btrRes.ok) throw new Error('Failed to fetch BTR data');
        const btrJson = await btrRes.json();
        setData(btrJson);

        if (tenancyRes.ok) {
          const tenancyJson = await tenancyRes.json();
          setAllTenancies(tenancyJson.tenancies || []);
        }
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
          <p className="text-sm mt-4" style={{ color: '#111827' }}>Loading unit management...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <Building2 className="w-12 h-12 mx-auto mb-4" style={{ color: '#EF4444' }} />
          <h2 className="text-lg font-semibold mb-2" style={{ color: '#111827' }}>Failed to load unit data</h2>
          <p className="text-sm mb-6" style={{ color: '#111827' }}>{error}</p>
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

  const { development, stats, units, recentMaintenance } = data;

  const tenancyByUnit: Record<string, Tenancy> = {};
  allTenancies.forEach((t) => {
    if (t.status === 'active') {
      tenancyByUnit[t.unit_id] = t;
    }
  });

  const maintenanceCountByUnit: Record<string, number> = {};
  (recentMaintenance || []).forEach((m) => {
    maintenanceCountByUnit[m.unit_id] = (maintenanceCountByUnit[m.unit_id] || 0) + 1;
  });

  const statusCounts: Record<FilterType, number> = {
    all: units.length,
    occupied: units.filter((u) => u.unit_status === 'occupied').length,
    vacant: units.filter((u) => u.unit_status === 'vacant' || u.unit_status === 'available').length,
    void: units.filter((u) => u.unit_status === 'void').length,
    maintenance: units.filter((u) => u.unit_status === 'maintenance').length,
  };

  const filteredUnits = activeFilter === 'all'
    ? units
    : units.filter((u) => {
        if (activeFilter === 'vacant') return u.unit_status === 'vacant' || u.unit_status === 'available';
        return u.unit_status === activeFilter;
      });

  const btrBasePath = `/developer/btr/${developmentId}`;

  const tabs = [
    { label: 'Overview', href: `${btrBasePath}/overview`, active: false },
    { label: 'Units', href: `${btrBasePath}/units`, active: true },
    { label: 'Maintenance', href: `${btrBasePath}/maintenance`, active: false },
    { label: 'Compliance', href: `${btrBasePath}/compliance`, active: false },
    { label: 'Amenities', href: `${btrBasePath}/amenities`, active: false },
    { label: 'Welcome', href: `${btrBasePath}/welcome`, active: false },
  ];

  const filterButtons: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'occupied', label: 'Occupied' },
    { key: 'vacant', label: 'Vacant' },
    { key: 'void', label: 'Void' },
    { key: 'maintenance', label: 'Maintenance' },
  ];

  async function handleEndTenancy(unitId: string) {
    if (!confirm('Are you sure you want to end this tenancy?')) return;
    try {
      setSubmitting(true);
      const res = await fetch(`/api/developments/${developmentId}/btr`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unit_id: unitId, unit_status: 'vacant' }),
      });
      if (res.ok) {
        window.location.reload();
      }
    } catch (err) {
      console.error('Failed to end tenancy:', err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleNewTenancy(unitId: string) {
    if (!newTenancy.tenant_name || !newTenancy.lease_start) return;
    try {
      setSubmitting(true);
      const res = await fetch(`/api/developments/${developmentId}/btr/tenancies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unit_id: unitId,
          tenant_name: newTenancy.tenant_name,
          tenant_email: newTenancy.tenant_email || undefined,
          tenant_phone: newTenancy.tenant_phone || undefined,
          monthly_rent: newTenancy.monthly_rent ? Number(newTenancy.monthly_rent) : undefined,
          lease_start: newTenancy.lease_start,
          status: 'active',
        }),
      });
      if (res.ok) {
        setShowNewTenancyForm(false);
        setNewTenancy({ tenant_name: '', tenant_email: '', tenant_phone: '', monthly_rent: '', lease_start: '' });
        window.location.reload();
      }
    } catch (err) {
      console.error('Failed to create tenancy:', err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href={`${btrBasePath}/overview`}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" style={{ color: '#111827' }} />
            </Link>
            <div>
              <h1 className="text-xl font-bold font-serif" style={{ color: '#111827' }}>
                Unit Management
              </h1>
              <p className="text-sm" style={{ color: '#111827' }}>{development.name}</p>
            </div>
          </div>
          <div className="flex gap-1 mt-4 -mb-px overflow-x-auto">
            {tabs.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className="flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap"
                style={
                  tab.active
                    ? { borderColor: '#D4AF37', color: '#D4AF37' }
                    : { borderColor: 'transparent', color: '#111827' }
                }
              >
                {tab.label === 'Overview' && <Building2 className="w-4 h-4" />}
                {tab.label === 'Units' && <Users className="w-4 h-4" />}
                {tab.label}
              </Link>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4" style={{ color: '#111827' }} />
          {filterButtons.map((btn) => (
            <button
              key={btn.key}
              onClick={() => setActiveFilter(btn.key)}
              className="px-4 py-2 text-sm font-medium rounded-lg border transition-colors"
              style={
                activeFilter === btn.key
                  ? { backgroundColor: '#FEFCE8', borderColor: '#D4AF37', color: '#D4AF37' }
                  : { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB', color: '#111827' }
              }
            >
              {btn.label} ({statusCounts[btn.key]})
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                {['Unit Address', 'Status', 'Tenant Name', 'Monthly Rent', 'Move-in Date', 'Maintenance'].map((h) => (
                  <th
                    key={h}
                    className="text-left text-xs font-semibold uppercase tracking-wider px-4 py-3"
                    style={{ color: '#111827' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredUnits.map((unit) => {
                const status = (unit.unit_status || 'vacant') as UnitStatus;
                const config = UNIT_STATUS_CONFIG[status] || UNIT_STATUS_CONFIG.vacant;
                const tenancy = tenancyByUnit[unit.id];
                const maintCount = maintenanceCountByUnit[unit.id] || 0;
                const unitLabel = unit.unit_number || unit.address || unit.id;
                const isExpanded = expandedUnitId === unit.id;

                return (
                  <tr key={unit.id} className="border-b border-gray-100 last:border-b-0">
                    <td colSpan={6} className="p-0">
                      <div
                        className="grid cursor-pointer hover:bg-gray-50 transition-colors"
                        style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}
                        onClick={() => {
                          setExpandedUnitId(isExpanded ? null : unit.id);
                          setShowNewTenancyForm(false);
                        }}
                      >
                        <div className="px-4 py-3 text-sm font-medium" style={{ color: '#111827' }}>
                          {unitLabel}
                        </div>
                        <div className="px-4 py-3">
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full"
                            style={{ backgroundColor: config.bgColor, color: config.color }}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: config.dotColor }}
                            />
                            {config.label}
                          </span>
                        </div>
                        <div className="px-4 py-3 text-sm" style={{ color: '#111827' }}>
                          {tenancy?.tenant_name || '—'}
                        </div>
                        <div className="px-4 py-3 text-sm font-medium" style={{ color: '#111827' }}>
                          {tenancy?.monthly_rent ? formatEuro(tenancy.monthly_rent) : '—'}
                        </div>
                        <div className="px-4 py-3 text-sm" style={{ color: '#111827' }}>
                          {tenancy?.move_in_date
                            ? new Date(tenancy.move_in_date).toLocaleDateString('en-IE', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })
                            : tenancy?.lease_start
                            ? new Date(tenancy.lease_start).toLocaleDateString('en-IE', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })
                            : '—'}
                        </div>
                        <div className="px-4 py-3 text-sm" style={{ color: '#111827' }}>
                          {maintCount > 0 ? (
                            <span className="font-medium" style={{ color: '#D97706' }}>
                              {maintCount}
                            </span>
                          ) : (
                            '—'
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-gray-100 bg-gray-50 px-6 py-5 space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-lg font-bold font-serif" style={{ color: '#111827' }}>
                                {unitLabel}
                              </h3>
                              <div className="flex items-center gap-3 mt-1">
                                <span
                                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full"
                                  style={{ backgroundColor: config.bgColor, color: config.color }}
                                >
                                  <span
                                    className="w-1.5 h-1.5 rounded-full"
                                    style={{ backgroundColor: config.dotColor }}
                                  />
                                  {config.label}
                                </span>
                                {tenancy?.monthly_rent && (
                                  <span className="text-sm font-medium" style={{ color: '#111827' }}>
                                    {formatEuro(tenancy.monthly_rent)}/mo
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {status === 'occupied' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEndTenancy(unit.id);
                                  }}
                                  disabled={submitting}
                                  className="px-3 py-1.5 text-xs font-medium rounded-lg border flex items-center gap-1 transition-colors"
                                  style={{
                                    backgroundColor: '#FEF2F2',
                                    borderColor: '#FECACA',
                                    color: '#DC2626',
                                  }}
                                >
                                  <UserMinus className="w-3.5 h-3.5" />
                                  End Tenancy
                                </button>
                              )}
                              {(status === 'vacant' || status === 'void' || status === 'available') && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowNewTenancyForm(!showNewTenancyForm);
                                  }}
                                  className="px-3 py-1.5 text-xs font-medium text-white rounded-lg flex items-center gap-1 transition-colors"
                                  style={{ backgroundColor: '#D4AF37' }}
                                >
                                  <UserPlus className="w-3.5 h-3.5" />
                                  New Tenancy
                                </button>
                              )}
                            </div>
                          </div>

                          {tenancy && status === 'occupied' && (
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                              <h4
                                className="text-xs font-semibold uppercase tracking-wider mb-4"
                                style={{ color: '#111827' }}
                              >
                                Current Tenant
                              </h4>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                <div className="flex items-center gap-2">
                                  <Users className="w-4 h-4" style={{ color: '#D4AF37' }} />
                                  <div>
                                    <div className="text-xs" style={{ color: '#111827' }}>Name</div>
                                    <div className="text-sm font-medium" style={{ color: '#111827' }}>
                                      {tenancy.tenant_name}
                                    </div>
                                  </div>
                                </div>
                                {tenancy.tenant_email && (
                                  <div className="flex items-center gap-2">
                                    <Mail className="w-4 h-4" style={{ color: '#D4AF37' }} />
                                    <div>
                                      <div className="text-xs" style={{ color: '#111827' }}>Email</div>
                                      <div className="text-sm font-medium" style={{ color: '#111827' }}>
                                        {tenancy.tenant_email}
                                      </div>
                                    </div>
                                  </div>
                                )}
                                {tenancy.tenant_phone && (
                                  <div className="flex items-center gap-2">
                                    <Phone className="w-4 h-4" style={{ color: '#D4AF37' }} />
                                    <div>
                                      <div className="text-xs" style={{ color: '#111827' }}>Phone</div>
                                      <div className="text-sm font-medium" style={{ color: '#111827' }}>
                                        {tenancy.tenant_phone}
                                      </div>
                                    </div>
                                  </div>
                                )}
                                <div className="flex items-center gap-2">
                                  <Calendar className="w-4 h-4" style={{ color: '#D4AF37' }} />
                                  <div>
                                    <div className="text-xs" style={{ color: '#111827' }}>Lease Start</div>
                                    <div className="text-sm font-medium" style={{ color: '#111827' }}>
                                      {new Date(tenancy.lease_start).toLocaleDateString('en-IE', {
                                        day: 'numeric',
                                        month: 'short',
                                        year: 'numeric',
                                      })}
                                    </div>
                                  </div>
                                </div>
                                {tenancy.lease_end && (
                                  <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4" style={{ color: '#D4AF37' }} />
                                    <div>
                                      <div className="text-xs" style={{ color: '#111827' }}>Lease End</div>
                                      <div className="text-sm font-medium" style={{ color: '#111827' }}>
                                        {new Date(tenancy.lease_end).toLocaleDateString('en-IE', {
                                          day: 'numeric',
                                          month: 'short',
                                          year: 'numeric',
                                        })}
                                      </div>
                                    </div>
                                  </div>
                                )}
                                <div className="flex items-center gap-2">
                                  <DollarSign className="w-4 h-4" style={{ color: '#D4AF37' }} />
                                  <div>
                                    <div className="text-xs" style={{ color: '#111827' }}>Monthly Rent</div>
                                    <div className="text-sm font-medium" style={{ color: '#111827' }}>
                                      {tenancy.monthly_rent ? formatEuro(tenancy.monthly_rent) : '—'}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {showNewTenancyForm && (status === 'vacant' || status === 'void' || status === 'available') && (
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                              <h4
                                className="text-xs font-semibold uppercase tracking-wider mb-4"
                                style={{ color: '#111827' }}
                              >
                                New Tenancy
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-xs font-medium mb-1" style={{ color: '#111827' }}>
                                    Tenant Name *
                                  </label>
                                  <input
                                    type="text"
                                    value={newTenancy.tenant_name}
                                    onChange={(e) =>
                                      setNewTenancy({ ...newTenancy, tenant_name: e.target.value })
                                    }
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
                                    style={{ color: '#111827', focusRingColor: '#D4AF37' } as any}
                                    placeholder="Enter tenant name"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium mb-1" style={{ color: '#111827' }}>
                                    Email
                                  </label>
                                  <input
                                    type="email"
                                    value={newTenancy.tenant_email}
                                    onChange={(e) =>
                                      setNewTenancy({ ...newTenancy, tenant_email: e.target.value })
                                    }
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
                                    style={{ color: '#111827' }}
                                    placeholder="tenant@email.com"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium mb-1" style={{ color: '#111827' }}>
                                    Phone
                                  </label>
                                  <input
                                    type="tel"
                                    value={newTenancy.tenant_phone}
                                    onChange={(e) =>
                                      setNewTenancy({ ...newTenancy, tenant_phone: e.target.value })
                                    }
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
                                    style={{ color: '#111827' }}
                                    placeholder="+353..."
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium mb-1" style={{ color: '#111827' }}>
                                    Monthly Rent (€)
                                  </label>
                                  <input
                                    type="number"
                                    value={newTenancy.monthly_rent}
                                    onChange={(e) =>
                                      setNewTenancy({ ...newTenancy, monthly_rent: e.target.value })
                                    }
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
                                    style={{ color: '#111827' }}
                                    placeholder="1850"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium mb-1" style={{ color: '#111827' }}>
                                    Lease Start *
                                  </label>
                                  <input
                                    type="date"
                                    value={newTenancy.lease_start}
                                    onChange={(e) =>
                                      setNewTenancy({ ...newTenancy, lease_start: e.target.value })
                                    }
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
                                    style={{ color: '#111827' }}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                              </div>
                              <div className="flex items-center gap-3 mt-4">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleNewTenancy(unit.id);
                                  }}
                                  disabled={submitting || !newTenancy.tenant_name || !newTenancy.lease_start}
                                  className="px-4 py-2 text-sm font-medium text-white rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
                                  style={{ backgroundColor: '#D4AF37' }}
                                >
                                  <Plus className="w-4 h-4" />
                                  {submitting ? 'Creating...' : 'Create Tenancy'}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowNewTenancyForm(false);
                                  }}
                                  className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 transition-colors"
                                  style={{ color: '#111827' }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredUnits.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <Building2 className="w-8 h-8 mx-auto mb-2" style={{ color: '#D4AF37' }} />
                    <p className="text-sm font-medium" style={{ color: '#111827' }}>
                      No units found for this filter
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
