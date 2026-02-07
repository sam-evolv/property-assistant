'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Wrench,
  AlertCircle,
  Clock,
  Star,
  ArrowLeft,
  Droplets,
  Zap,
  Flame,
  Settings,
  HelpCircle,
  Calendar,
  CheckCircle2,
  Building2,
  Plus,
  X,
  Bug,
  Trees,
  Users,
} from 'lucide-react';
import {
  CATEGORY_CONFIG,
  PRIORITY_CONFIG,
  STATUS_CONFIG,
} from '@/types/btr';
import type {
  MaintenanceRequest,
  MaintenanceCategory,
  MaintenancePriority,
  MaintenanceStatus,
} from '@/types/btr';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  Droplets,
  Zap,
  Flame,
  Building2,
  Settings,
  Bug,
  Trees,
  Users,
  HelpCircle,
  Wrench,
};

const PRIORITY_ORDER: Record<MaintenancePriority, number> = {
  emergency: 0,
  urgent: 1,
  routine: 2,
  low: 3,
};

const FILTER_STATUSES: { label: string; value: MaintenanceStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Submitted', value: 'submitted' },
  { label: 'Acknowledged', value: 'acknowledged' },
  { label: 'Assigned', value: 'assigned' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'Resolved', value: 'resolved' },
];

const STATUS_FLOW: MaintenanceStatus[] = [
  'submitted', 'acknowledged', 'assigned', 'in_progress', 'resolved', 'closed',
];

interface BTRData {
  development: { id: string; name: string };
  units: { id: string; unit_number?: string; address?: string }[];
  tenancies: { id: string; unit_id: string; tenant_name: string; status: string }[];
}

export default function BTRMaintenancePage() {
  const params = useParams();
  const developmentId = params.developmentId as string;

  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [btrData, setBtrData] = useState<BTRData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<MaintenanceStatus | 'all'>('all');
  const [selectedRequest, setSelectedRequest] = useState<MaintenanceRequest | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editStatus, setEditStatus] = useState<MaintenanceStatus>('submitted');
  const [editVendor, setEditVendor] = useState('');
  const [editScheduledDate, setEditScheduledDate] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editCost, setEditCost] = useState('');

  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState<MaintenanceCategory>('general');
  const [newPriority, setNewPriority] = useState<MaintenancePriority>('routine');
  const [newUnitId, setNewUnitId] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [maintRes, btrRes] = await Promise.all([
          fetch(`/api/developments/${developmentId}/btr/maintenance`),
          fetch(`/api/developments/${developmentId}/btr`),
        ]);
        if (!maintRes.ok) throw new Error('Failed to fetch maintenance data');
        if (!btrRes.ok) throw new Error('Failed to fetch BTR data');
        const maintData = await maintRes.json();
        const btr = await btrRes.json();
        setRequests(Array.isArray(maintData) ? maintData : maintData.requests || []);
        setBtrData(btr);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [developmentId]);

  const filteredRequests = useMemo(() => {
    let list = filter === 'all' ? requests : requests.filter((r) => r.status === filter);
    return list.sort((a, b) => {
      const pDiff = (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99);
      if (pDiff !== 0) return pDiff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [requests, filter]);

  const stats = useMemo(() => {
    const open = requests.filter((r) => !['resolved', 'closed', 'cancelled'].includes(r.status));
    const urgent = requests.filter((r) => r.priority === 'emergency' || r.priority === 'urgent');
    const resolved = requests.filter((r) => r.status === 'resolved' || r.status === 'closed');
    let avgDays = 0;
    if (resolved.length > 0) {
      const totalDays = resolved.reduce((sum, r) => {
        if (r.resolved_at) {
          const diff = new Date(r.resolved_at).getTime() - new Date(r.created_at).getTime();
          return sum + diff / (1000 * 60 * 60 * 24);
        }
        return sum;
      }, 0);
      avgDays = Math.round(totalDays / resolved.length);
    }
    const rated = resolved.filter((r) => r.tenant_rating != null);
    const avgRating = rated.length > 0
      ? (rated.reduce((sum, r) => sum + (r.tenant_rating || 0), 0) / rated.length).toFixed(1)
      : '—';
    return {
      openCount: open.length,
      avgResolution: avgDays > 0 ? `${avgDays}d` : '—',
      urgentCount: urgent.length,
      satisfaction: avgRating,
    };
  }, [requests]);

  function openDetail(req: MaintenanceRequest) {
    setSelectedRequest(req);
    setEditStatus(req.status);
    setEditVendor(req.assigned_vendor || '');
    setEditScheduledDate(req.scheduled_date || '');
    setEditNotes(req.resolution_notes || '');
    setEditCost(req.resolution_cost != null ? String(req.resolution_cost) : '');
  }

  async function handleSave() {
    if (!selectedRequest) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/developments/${developmentId}/btr/maintenance`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: selectedRequest.id,
          status: editStatus,
          assigned_vendor: editVendor || undefined,
          scheduled_date: editScheduledDate || undefined,
          resolution_notes: editNotes || undefined,
          resolution_cost: editCost ? parseFloat(editCost) : undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed to update');
      const updated = await res.json();
      setRequests((prev) =>
        prev.map((r) => (r.id === selectedRequest.id ? { ...r, ...updated, ...(updated.request || {}) } : r))
      );
      setSelectedRequest(null);
    } catch (err: any) {
      alert('Error saving: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleCreate() {
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/developments/${developmentId}/btr/maintenance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          description: newDescription,
          category: newCategory,
          priority: newPriority,
          unit_id: newUnitId || undefined,
          development_id: developmentId,
        }),
      });
      if (!res.ok) throw new Error('Failed to create request');
      const created = await res.json();
      setRequests((prev) => [created.request || created, ...prev]);
      setShowNewForm(false);
      setNewTitle('');
      setNewDescription('');
      setNewCategory('general');
      setNewPriority('routine');
      setNewUnitId('');
    } catch (err: any) {
      alert('Error creating: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  const btrBasePath = `/developer/btr/${developmentId}`;

  const navTabs = [
    { label: 'Overview', href: `${btrBasePath}/overview` },
    { label: 'Units', href: `${btrBasePath}/units` },
    { label: 'Maintenance', href: `${btrBasePath}/maintenance` },
    { label: 'Compliance', href: `${btrBasePath}/compliance` },
    { label: 'Amenities', href: `${btrBasePath}/amenities` },
    { label: 'Welcome', href: `${btrBasePath}/welcome` },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div
            className="w-10 h-10 rounded-full border-t-transparent animate-spin mx-auto"
            style={{ borderWidth: 3, borderStyle: 'solid', borderColor: '#D4AF37', borderTopColor: 'transparent' }}
          />
          <p className="text-sm mt-4" style={{ color: '#111827' }}>Loading maintenance data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 mx-auto mb-4" style={{ color: '#EF4444' }} />
          <h2 className="text-lg font-semibold mb-2" style={{ color: '#111827' }}>Failed to load maintenance data</h2>
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

  const developmentName = btrData?.development?.name || 'Development';

  function getCategoryIcon(category: MaintenanceCategory) {
    const config = CATEGORY_CONFIG[category];
    const IconComp = ICON_MAP[config?.icon] || Wrench;
    return { IconComp, color: config?.color || '#6B7280' };
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`${btrBasePath}/overview`}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" style={{ color: '#111827' }} />
              </Link>
              <div>
                <h1 className="text-xl font-bold font-serif" style={{ color: '#111827' }}>
                  Maintenance - {developmentName}
                </h1>
                <p className="text-sm" style={{ color: '#111827' }}>Manage maintenance requests and work orders</p>
              </div>
            </div>
            <button
              onClick={() => setShowNewForm(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-white transition-colors"
              style={{ backgroundColor: '#D4AF37' }}
            >
              <Plus className="w-4 h-4" />
              New Request
            </button>
          </div>
          <div className="flex gap-1 mt-4 -mb-px overflow-x-auto">
            {navTabs.map((tab) => {
              const isActive = tab.label === 'Maintenance';
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className="flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap"
                  style={{
                    borderColor: isActive ? '#D4AF37' : 'transparent',
                    color: isActive ? '#D4AF37' : '#111827',
                  }}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: '#FEFCE8' }}>
              <Wrench className="w-5 h-5" style={{ color: '#D4AF37' }} />
            </div>
            <div className="text-3xl font-bold" style={{ color: '#111827' }}>{stats.openCount}</div>
            <div className="text-sm" style={{ color: '#111827' }}>Open Requests</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: '#FEFCE8' }}>
              <Clock className="w-5 h-5" style={{ color: '#D4AF37' }} />
            </div>
            <div className="text-3xl font-bold" style={{ color: '#111827' }}>{stats.avgResolution}</div>
            <div className="text-sm" style={{ color: '#111827' }}>Avg Resolution Time</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: '#FEFCE8' }}>
              <AlertCircle className="w-5 h-5" style={{ color: '#D4AF37' }} />
            </div>
            <div className="text-3xl font-bold" style={{ color: '#111827' }}>{stats.urgentCount}</div>
            <div className="text-sm" style={{ color: '#111827' }}>Urgent / Emergency</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: '#FEFCE8' }}>
              <Star className="w-5 h-5" style={{ color: '#D4AF37' }} />
            </div>
            <div className="text-3xl font-bold" style={{ color: '#111827' }}>{stats.satisfaction}</div>
            <div className="text-sm" style={{ color: '#111827' }}>Satisfaction Rating</div>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {FILTER_STATUSES.map((f) => {
            const isActive = filter === f.value;
            return (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
                style={{
                  backgroundColor: isActive ? '#D4AF37' : 'white',
                  color: isActive ? 'white' : '#111827',
                  border: isActive ? '1px solid #D4AF37' : '1px solid #e5e7eb',
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {filteredRequests.length === 0 ? (
            <div className="p-12 text-center">
              <Wrench className="w-10 h-10 mx-auto mb-3" style={{ color: '#D4AF37' }} />
              <p className="text-sm font-medium" style={{ color: '#111827' }}>No maintenance requests found</p>
              <p className="text-sm mt-1" style={{ color: '#111827' }}>
                {filter !== 'all' ? 'Try a different filter or ' : ''}Click "New Request" to create one.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredRequests.map((req) => {
                const { IconComp, color: catColor } = getCategoryIcon(req.category);
                const priorityConf = PRIORITY_CONFIG[req.priority] || PRIORITY_CONFIG.routine;
                const statusConf = STATUS_CONFIG[req.status] || STATUS_CONFIG.submitted;
                const unitAddress = req.unit?.address || req.unit_address || `Unit ${req.unit_id}`;
                const tenantName = req.tenancy?.tenant_name || req.tenant_name_joined || '—';

                return (
                  <div
                    key={req.id}
                    onClick={() => openDetail(req)}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${catColor}15` }}
                    >
                      <IconComp className="w-5 h-5" style={{ color: catColor }} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold truncate" style={{ color: '#111827' }}>
                          {req.title}
                        </span>
                        <span
                          className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full flex-shrink-0"
                          style={{ backgroundColor: priorityConf.bgColor, color: priorityConf.color }}
                        >
                          {priorityConf.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs" style={{ color: '#111827' }}>
                        <span>{unitAddress}</span>
                        <span>•</span>
                        <span>{tenantName}</span>
                        {req.assigned_vendor && (
                          <>
                            <span>•</span>
                            <span>{req.assigned_vendor}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <span
                      className="inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full flex-shrink-0"
                      style={{ backgroundColor: statusConf.bgColor, color: statusConf.color }}
                    >
                      {statusConf.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setSelectedRequest(null)}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="relative w-full max-w-lg bg-white shadow-xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-bold font-serif" style={{ color: '#111827' }}>Request Details</h2>
              <button
                onClick={() => setSelectedRequest(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" style={{ color: '#111827' }} />
              </button>
            </div>

            <div className="px-6 py-6 space-y-6">
              <div>
                <h3 className="text-base font-semibold" style={{ color: '#111827' }}>{selectedRequest.title}</h3>
                <p className="text-sm mt-1" style={{ color: '#111827' }}>{selectedRequest.description}</p>
                <div className="flex items-center gap-2 mt-3">
                  <span
                    className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full"
                    style={{
                      backgroundColor: PRIORITY_CONFIG[selectedRequest.priority]?.bgColor,
                      color: PRIORITY_CONFIG[selectedRequest.priority]?.color,
                    }}
                  >
                    {PRIORITY_CONFIG[selectedRequest.priority]?.label}
                  </span>
                  <span className="text-xs" style={{ color: '#111827' }}>
                    {CATEGORY_CONFIG[selectedRequest.category]?.label}
                  </span>
                  <span className="text-xs" style={{ color: '#111827' }}>
                    • {selectedRequest.unit?.address || selectedRequest.unit_address || `Unit ${selectedRequest.unit_id}`}
                  </span>
                </div>
                <div className="text-xs mt-2" style={{ color: '#111827' }}>
                  Created: {new Date(selectedRequest.created_at).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: '#111827' }}>Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as MaintenanceStatus)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                    style={{ color: '#111827' }}
                  >
                    {STATUS_FLOW.map((s) => (
                      <option key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: '#111827' }}>Assigned Vendor</label>
                  <input
                    type="text"
                    value={editVendor}
                    onChange={(e) => setEditVendor(e.target.value)}
                    placeholder="Enter vendor name"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                    style={{ color: '#111827' }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: '#111827' }}>Scheduled Date</label>
                  <input
                    type="date"
                    value={editScheduledDate}
                    onChange={(e) => setEditScheduledDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                    style={{ color: '#111827' }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: '#111827' }}>Resolution Notes</label>
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Add resolution notes..."
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none"
                    style={{ color: '#111827' }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: '#111827' }}>Resolution Cost (€)</label>
                  <input
                    type="number"
                    value={editCost}
                    onChange={(e) => setEditCost(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                    style={{ color: '#111827' }}
                  />
                </div>
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full px-4 py-3 text-sm font-medium rounded-lg text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: '#D4AF37' }}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowNewForm(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="relative w-full max-w-md bg-white rounded-xl shadow-xl overflow-y-auto max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-bold font-serif" style={{ color: '#111827' }}>New Maintenance Request</h2>
              <button
                onClick={() => setShowNewForm(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" style={{ color: '#111827' }} />
              </button>
            </div>

            <div className="px-6 py-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#111827' }}>Title *</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Brief description of the issue"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  style={{ color: '#111827' }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#111827' }}>Description</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Detailed description..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none"
                  style={{ color: '#111827' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: '#111827' }}>Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as MaintenanceCategory)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                    style={{ color: '#111827' }}
                  >
                    {(Object.keys(CATEGORY_CONFIG) as MaintenanceCategory[]).map((cat) => (
                      <option key={cat} value={cat}>{CATEGORY_CONFIG[cat].label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: '#111827' }}>Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as MaintenancePriority)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                    style={{ color: '#111827' }}
                  >
                    {(Object.keys(PRIORITY_CONFIG) as MaintenancePriority[]).map((p) => (
                      <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {btrData?.units && btrData.units.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: '#111827' }}>Unit</label>
                  <select
                    value={newUnitId}
                    onChange={(e) => setNewUnitId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                    style={{ color: '#111827' }}
                  >
                    <option value="">Select unit...</option>
                    {btrData.units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.unit_number || unit.address || unit.id}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                onClick={handleCreate}
                disabled={saving || !newTitle.trim()}
                className="w-full px-4 py-3 text-sm font-medium rounded-lg text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: '#D4AF37' }}
              >
                {saving ? 'Creating...' : 'Create Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}