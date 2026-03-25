'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  Plus, Search, Sun, Zap, X, Loader2,
  ChevronRight, Calendar, Shield, Eye,
  Thermometer, Wind, CheckCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
  panel_model: string | null;
  install_date: string | null;
  warranty_expiry: string | null;
  health_status: string;
  portal_status: string;
  is_active: boolean;
  energy_generated_kwh: number | null;
  savings_eur: number | null;
  created_at: string;
}

const SYSTEM_LABELS: Record<string, string> = {
  solar_pv: 'Solar PV',
  heat_pump: 'Heat Pump',
  mvhr: 'MVHR',
  ev_charger: 'EV Charger',
};

const SYSTEM_ICONS: Record<string, typeof Sun> = {
  solar_pv: Sun,
  heat_pump: Thermometer,
  mvhr: Wind,
};

const HEALTH_STYLES: Record<string, { bg: string; text: string }> = {
  healthy: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  active: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  warning: { bg: 'bg-amber-50', text: 'text-amber-700' },
  fault: { bg: 'bg-red-50', text: 'text-red-700' },
  pending: { bg: 'bg-blue-50', text: 'text-blue-700' },
  flagged: { bg: 'bg-amber-50', text: 'text-amber-700' },
};

const PORTAL_STYLES: Record<string, { bg: string; text: string }> = {
  activated: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  pending: { bg: 'bg-amber-50', text: 'text-amber-700' },
};

const STATUS_TABS = ['all', 'active', 'pending', 'flagged'] as const;
const STATUS_LABELS: Record<string, string> = { all: 'All', active: 'Active', pending: 'Pending', flagged: 'Flagged' };
const TYPE_TABS = ['all', 'solar_pv', 'heat_pump', 'mvhr'] as const;
const TYPE_LABELS: Record<string, string> = { all: 'All', solar_pv: 'Solar PV', heat_pump: 'Heat Pump', mvhr: 'MVHR' };

export default function InstallationsPage() {
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);

  useEffect(() => {
    async function fetchInstallations() {
      try {
        const res = await fetch('/api/care/installations-all');
        if (res.ok) {
          const data = await res.json();
          setInstallations(data.installations || []);
        }
      } catch {
        // empty state
      } finally {
        setLoading(false);
      }
    }
    fetchInstallations();
  }, []);

  const filtered = useMemo(() => {
    return installations.filter(i => {
      // Search
      if (search) {
        const q = search.toLowerCase();
        const matches = [i.job_reference, i.customer_name, i.address_line_1, i.city, i.inverter_model]
          .filter(Boolean)
          .some(v => v!.toLowerCase().includes(q));
        if (!matches) return false;
      }
      // Status
      if (statusFilter !== 'all') {
        if (statusFilter === 'active' && i.health_status !== 'healthy') return false;
        if (statusFilter === 'pending' && i.portal_status !== 'pending') return false;
        if (statusFilter === 'flagged' && i.health_status !== 'warning' && i.health_status !== 'fault') return false;
      }
      // Type
      if (typeFilter !== 'all' && i.system_type !== typeFilter) return false;
      return true;
    });
  }, [installations, search, statusFilter, typeFilter]);

  const selected = selectedId ? installations.find(i => i.id === selectedId) : null;

  if (loading) {
    return (
      <div className="min-h-full bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gray-50">
      <div className="p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Installations</h1>
              <p className="text-sm text-gray-500 mt-1">
                {installations.length} total installation{installations.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={() => setShowNewModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-all duration-150 active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #D4AF37, #B8934C)' }}
            >
              <Plus className="w-4 h-4" />
              New Installation
            </button>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by reference, customer, address..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37] outline-none transition-all"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1">
              {STATUS_TABS.map(tab => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-150',
                    statusFilter === tab
                      ? 'bg-gold-500 text-white shadow-sm'
                      : 'text-gray-600 bg-white border border-gray-200 hover:bg-gray-50'
                  )}
                >
                  {STATUS_LABELS[tab]}
                </button>
              ))}
            </div>

            {/* Type Filter */}
            <div className="flex items-center gap-1">
              {TYPE_TABS.map(tab => (
                <button
                  key={tab}
                  onClick={() => setTypeFilter(tab)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-150',
                    typeFilter === tab
                      ? 'bg-gold-500 text-white shadow-sm'
                      : 'text-gray-600 bg-white border border-gray-200 hover:bg-gray-50'
                  )}
                >
                  {TYPE_LABELS[tab]}
                </button>
              ))}
            </div>
          </div>

          {/* Results Count */}
          {(search || statusFilter !== 'all' || typeFilter !== 'all') && (
            <p className="text-xs text-gray-500">
              Showing {filtered.length} of {installations.length} installations
            </p>
          )}

          {/* Table */}
          {filtered.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-12 text-center">
              <Sun className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                {installations.length === 0 ? 'No installations yet' : 'No matching installations'}
              </h2>
              <p className="text-sm text-gray-500">
                {installations.length === 0
                  ? 'Create your first installation to start managing customer aftercare.'
                  : 'Try adjusting your search or filters.'}
              </p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Installation</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">System</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Capacity</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Portal</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Install Date</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((inst) => {
                      const healthStyle = HEALTH_STYLES[inst.health_status] || HEALTH_STYLES.healthy;
                      const portalStyle = PORTAL_STYLES[inst.portal_status] || PORTAL_STYLES.pending;
                      const dateStr = inst.install_date
                        ? new Date(inst.install_date).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })
                        : '-';
                      return (
                        <tr
                          key={inst.id}
                          className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer"
                          onClick={() => setSelectedId(inst.id)}
                        >
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{inst.job_reference}</p>
                            <p className="text-xs text-gray-400">{inst.address_line_1}, {inst.city}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-gray-700">{SYSTEM_LABELS[inst.system_type] || inst.system_type}</p>
                            <p className="text-xs text-gray-400">{inst.inverter_model || '-'}</p>
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {inst.system_size_kwp ? `${inst.system_size_kwp} kWp` : '-'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${healthStyle.bg} ${healthStyle.text}`}>
                              {inst.health_status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${portalStyle.bg} ${portalStyle.text}`}>
                              {inst.portal_status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{dateStr}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelectedId(inst.id); }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-all duration-150 active:scale-[0.98]"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Slide-over Detail Panel */}
      {selected && (
        <SlideOver installation={selected} onClose={() => setSelectedId(null)} />
      )}

      {/* New Installation Modal */}
      {showNewModal && (
        <NewInstallationModal
          onClose={() => setShowNewModal(false)}
          onCreated={() => {
            setShowNewModal(false);
            // Refetch
            fetch('/api/care/installations-all')
              .then(r => r.json())
              .then(d => setInstallations(d.installations || []));
          }}
        />
      )}
    </div>
  );
}

/* ── Slide-over detail panel ── */
function SlideOver({ installation: inst, onClose }: { installation: Installation; onClose: () => void }) {
  const SystemIcon = SYSTEM_ICONS[inst.system_type] || Sun;
  const dateStr = inst.install_date
    ? new Date(inst.install_date).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' })
    : '-';
  const warrantyStr = inst.warranty_expiry
    ? new Date(inst.warranty_expiry).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' })
    : '-';
  const healthStyle = HEALTH_STYLES[inst.health_status] || HEALTH_STYLES.healthy;
  const portalStyle = PORTAL_STYLES[inst.portal_status] || PORTAL_STYLES.pending;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      {/* Panel */}
      <div className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white z-50 shadow-2xl overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">{inst.job_reference}</h2>
              <p className="text-sm text-gray-500">{inst.address_line_1}, {inst.city}, {inst.county}</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Status badges */}
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${healthStyle.bg} ${healthStyle.text}`}>
              <CheckCircle className="w-3 h-3" />
              {inst.health_status}
            </span>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${portalStyle.bg} ${portalStyle.text}`}>
              <Shield className="w-3 h-3" />
              Portal: {inst.portal_status}
            </span>
          </div>

          {/* System Specs */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-amber-50">
                <SystemIcon className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900">System Specifications</h3>
            </div>
            <DetailRow label="System Type" value={SYSTEM_LABELS[inst.system_type] || inst.system_type} />
            <DetailRow label="Inverter Model" value={inst.inverter_model || '-'} />
            <DetailRow label="Capacity" value={inst.system_size_kwp ? `${inst.system_size_kwp} kWp` : '-'} />
            <DetailRow label="Install Date" value={dateStr} />
            <DetailRow label="Warranty Expiry" value={warrantyStr} />
          </div>

          {/* Performance */}
          {(inst.energy_generated_kwh || inst.savings_eur) && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Performance</h3>
              <DetailRow
                label="Energy Generated"
                value={inst.energy_generated_kwh ? `${inst.energy_generated_kwh.toLocaleString()} kWh` : '-'}
              />
              <DetailRow
                label="Estimated Savings"
                value={inst.savings_eur ? `\u20AC${inst.savings_eur.toLocaleString()}` : '-'}
              />
            </div>
          )}

          {/* Customer */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Customer</h3>
            <DetailRow label="Reference" value={inst.customer_name} />
            <DetailRow label="Address" value={`${inst.address_line_1}, ${inst.city}, Co. ${inst.county}`} />
          </div>
        </div>
      </div>
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}

/* ── New Installation Modal ── */
function NewInstallationModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    job_reference: '',
    customer_name: '',
    address_line_1: '',
    city: '',
    county: 'Cork',
    system_type: 'solar_pv',
    inverter_model: '',
    system_size_kwp: '',
    install_date: '',
    warranty_years: '10',
  });

  const set = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const installDate = form.install_date ? new Date(form.install_date) : new Date();
      const warrantyExpiry = new Date(installDate);
      warrantyExpiry.setFullYear(warrantyExpiry.getFullYear() + parseInt(form.warranty_years || '10'));

      const res = await fetch('/api/care/installations/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_reference: form.job_reference,
          customer_name: form.customer_name,
          address_line_1: form.address_line_1,
          city: form.city,
          county: form.county,
          system_type: form.system_type,
          inverter_model: form.inverter_model,
          system_size_kwp: form.system_size_kwp ? Number(form.system_size_kwp) : null,
          install_date: form.install_date || null,
          warranty_expiry: warrantyExpiry.toISOString().split('T')[0],
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create installation');
      }

      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37] outline-none transition-all bg-white';

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900">New Installation</h2>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Job Reference *</label>
                <input type="text" required value={form.job_reference} onChange={e => set('job_reference', e.target.value)} placeholder="e.g. SES-2025-013" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Customer Name *</label>
                <input type="text" required value={form.customer_name} onChange={e => set('customer_name', e.target.value)} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Address *</label>
                  <input type="text" required value={form.address_line_1} onChange={e => set('address_line_1', e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">City *</label>
                  <input type="text" required value={form.city} onChange={e => set('city', e.target.value)} className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">System Type</label>
                  <select value={form.system_type} onChange={e => set('system_type', e.target.value)} className={inputClass}>
                    <option value="solar_pv">Solar PV</option>
                    <option value="heat_pump">Heat Pump</option>
                    <option value="mvhr">MVHR</option>
                    <option value="ev_charger">EV Charger</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Inverter / Brand</label>
                  <input type="text" value={form.inverter_model} onChange={e => set('inverter_model', e.target.value)} className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Capacity (kWp)</label>
                  <input type="number" step="0.1" min="0" value={form.system_size_kwp} onChange={e => set('system_size_kwp', e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Install Date</label>
                  <input type="date" value={form.install_date} onChange={e => set('install_date', e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Warranty (years)</label>
                  <input type="number" min="1" max="25" value={form.warranty_years} onChange={e => set('warranty_years', e.target.value)} className={inputClass} />
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-all duration-150 active:scale-[0.98] disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #D4AF37, #B8934C)' }}
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {submitting ? 'Creating...' : 'Create Installation'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
