'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  AlertCircle,
  Clock,
  Calendar,
  CheckCircle2,
  Shield,
  Plus,
  ArrowLeft,
  X,
  Building2,
} from 'lucide-react';
import {
  COMPLIANCE_TYPE_CONFIG,
} from '@/types/btr';
import type {
  ComplianceItem,
  ComplianceType,
  ComplianceStatus,
} from '@/types/btr';

interface BTRData {
  development: { id: string; name: string };
}

const STATUS_SECTIONS: {
  key: ComplianceStatus;
  label: string;
  borderColor: string;
  bgColor: string;
  textColor: string;
  Icon: typeof AlertCircle;
}[] = [
  { key: 'overdue', label: 'Overdue', borderColor: '#EF4444', bgColor: '#FEF2F2', textColor: '#DC2626', Icon: AlertCircle },
  { key: 'due_soon', label: 'Due Soon', borderColor: '#F59E0B', bgColor: '#FFFBEB', textColor: '#D97706', Icon: Clock },
  { key: 'upcoming', label: 'Upcoming', borderColor: '#3B82F6', bgColor: '#EFF6FF', textColor: '#2563EB', Icon: Calendar },
  { key: 'completed', label: 'Completed', borderColor: '#10B981', bgColor: '#ECFDF5', textColor: '#059669', Icon: CheckCircle2 },
];

export default function BTRCompliancePage() {
  const params = useParams();
  const developmentId = params.developmentId as string;

  const [items, setItems] = useState<ComplianceItem[]>([]);
  const [btrData, setBtrData] = useState<BTRData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newType, setNewType] = useState<ComplianceType>('fire_safety');
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newRecurrence, setNewRecurrence] = useState('');
  const [newProvider, setNewProvider] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [compRes, btrRes] = await Promise.all([
          fetch(`/api/developments/${developmentId}/btr/compliance`),
          fetch(`/api/developments/${developmentId}/btr`),
        ]);
        if (!compRes.ok) throw new Error('Failed to fetch compliance data');
        if (!btrRes.ok) throw new Error('Failed to fetch BTR data');
        const compData = await compRes.json();
        const btr = await btrRes.json();
        setItems(Array.isArray(compData) ? compData : compData.items || []);
        setBtrData(btr);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [developmentId]);

  const stats = useMemo(() => {
    const overdue = items.filter((i) => i.status === 'overdue').length;
    const dueSoon = items.filter((i) => i.status === 'due_soon').length;
    const upcoming = items.filter((i) => i.status === 'upcoming').length;
    const completed = items.filter((i) => i.status === 'completed').length;
    return { overdue, dueSoon, upcoming, completed };
  }, [items]);

  const grouped = useMemo(() => {
    const result: Record<ComplianceStatus, ComplianceItem[]> = {
      overdue: [],
      due_soon: [],
      upcoming: [],
      completed: [],
      not_applicable: [],
    };
    items.forEach((item) => {
      if (result[item.status]) {
        result[item.status].push(item);
      }
    });
    return result;
  }, [items]);

  async function handleMarkComplete(item: ComplianceItem) {
    setSaving(true);
    try {
      const res = await fetch(`/api/developments/${developmentId}/btr/compliance`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          completed_date: new Date().toISOString().split('T')[0],
          status: 'completed',
        }),
      });
      if (!res.ok) throw new Error('Failed to update');
      const updated = await res.json();
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, ...updated, ...(updated.item || {}), status: 'completed' as ComplianceStatus, completed_date: new Date().toISOString() }
            : i
        )
      );
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleCreate() {
    if (!newTitle.trim() || !newDueDate) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/developments/${developmentId}/btr/compliance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: newType,
          title: newTitle,
          description: newDescription || undefined,
          due_date: newDueDate,
          recurrence_months: newRecurrence ? parseInt(newRecurrence) : undefined,
          provider_name: newProvider || undefined,
          development_id: developmentId,
        }),
      });
      if (!res.ok) throw new Error('Failed to create compliance item');
      const created = await res.json();
      setItems((prev) => [created.item || created, ...prev]);
      setShowNewForm(false);
      setNewType('fire_safety');
      setNewTitle('');
      setNewDescription('');
      setNewDueDate('');
      setNewRecurrence('');
      setNewProvider('');
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
          <p className="text-sm mt-4" style={{ color: '#111827' }}>Loading compliance data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 mx-auto mb-4" style={{ color: '#EF4444' }} />
          <h2 className="text-lg font-semibold mb-2" style={{ color: '#111827' }}>Failed to load compliance data</h2>
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
                  Compliance Calendar - {developmentName}
                </h1>
                <p className="text-sm" style={{ color: '#111827' }}>Track certifications, inspections and regulatory requirements</p>
              </div>
            </div>
            <button
              onClick={() => setShowNewForm(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-white transition-colors"
              style={{ backgroundColor: '#D4AF37' }}
            >
              <Plus className="w-4 h-4" />
              Add Item
            </button>
          </div>
          <div className="flex gap-1 mt-4 -mb-px overflow-x-auto">
            {navTabs.map((tab) => {
              const isActive = tab.label === 'Compliance';
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
            <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: '#FEF2F2' }}>
              <AlertCircle className="w-5 h-5" style={{ color: '#EF4444' }} />
            </div>
            <div className="text-3xl font-bold" style={{ color: '#111827' }}>{stats.overdue}</div>
            <div className="text-sm" style={{ color: '#111827' }}>Overdue</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: '#FFFBEB' }}>
              <Clock className="w-5 h-5" style={{ color: '#F59E0B' }} />
            </div>
            <div className="text-3xl font-bold" style={{ color: '#111827' }}>{stats.dueSoon}</div>
            <div className="text-sm" style={{ color: '#111827' }}>Due Soon</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: '#EFF6FF' }}>
              <Calendar className="w-5 h-5" style={{ color: '#3B82F6' }} />
            </div>
            <div className="text-3xl font-bold" style={{ color: '#111827' }}>{stats.upcoming}</div>
            <div className="text-sm" style={{ color: '#111827' }}>Upcoming</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: '#ECFDF5' }}>
              <CheckCircle2 className="w-5 h-5" style={{ color: '#10B981' }} />
            </div>
            <div className="text-3xl font-bold" style={{ color: '#111827' }}>{stats.completed}</div>
            <div className="text-sm" style={{ color: '#111827' }}>Completed</div>
          </div>
        </div>

        {STATUS_SECTIONS.map((section) => {
          const sectionItems = grouped[section.key];
          if (!sectionItems || sectionItems.length === 0) return null;

          return (
            <div key={section.key} className="space-y-3">
              <div className="flex items-center gap-2">
                <section.Icon className="w-5 h-5" style={{ color: section.borderColor }} />
                <h2 className="text-lg font-bold font-serif" style={{ color: '#111827' }}>
                  {section.label} ({sectionItems.length})
                </h2>
              </div>
              <div className="space-y-2">
                {sectionItems.map((item) => {
                  const scope = item.unit_id ? (item.unit?.address || 'Unit') : 'Building';
                  return (
                    <div
                      key={item.id}
                      className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center gap-4"
                      style={{ borderLeftWidth: 4, borderLeftColor: section.borderColor }}
                    >
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: section.bgColor }}
                      >
                        <section.Icon className="w-5 h-5" style={{ color: section.borderColor }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold" style={{ color: '#111827' }}>{item.title}</div>
                        <div className="flex items-center gap-3 text-xs mt-1" style={{ color: '#111827' }}>
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {scope}
                          </span>
                          {item.provider_name && (
                            <>
                              <span>•</span>
                              <span>{item.provider_name}</span>
                            </>
                          )}
                          <span>•</span>
                          <span>
                            Due: {new Date(item.due_date).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                      </div>
                      {section.key !== 'completed' && (
                        <button
                          onClick={() => handleMarkComplete(item)}
                          disabled={saving}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors flex-shrink-0"
                          style={{
                            backgroundColor: '#ECFDF5',
                            borderColor: '#A7F3D0',
                            color: '#059669',
                          }}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Mark Complete
                        </button>
                      )}
                      {section.key === 'completed' && item.completed_date && (
                        <span className="text-xs flex-shrink-0" style={{ color: '#059669' }}>
                          Completed: {new Date(item.completed_date).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {items.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
            <Shield className="w-10 h-10 mx-auto mb-3" style={{ color: '#D4AF37' }} />
            <p className="text-sm font-medium" style={{ color: '#111827' }}>No compliance items found</p>
            <p className="text-sm mt-1" style={{ color: '#111827' }}>Click &quot;Add Item&quot; to create your first compliance requirement.</p>
          </div>
        )}
      </main>

      {showNewForm && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setShowNewForm(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="relative w-full max-w-lg bg-white shadow-xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-bold font-serif" style={{ color: '#111827' }}>Add Compliance Item</h2>
              <button
                onClick={() => setShowNewForm(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" style={{ color: '#111827' }} />
              </button>
            </div>

            <div className="px-6 py-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#111827' }}>Type</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as ComplianceType)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  style={{ color: '#111827' }}
                >
                  {(Object.entries(COMPLIANCE_TYPE_CONFIG) as [ComplianceType, { label: string; icon: string }][]).map(
                    ([key, config]) => (
                      <option key={key} value={key}>{config.label}</option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#111827' }}>Title *</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Annual Fire Safety Inspection"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  style={{ color: '#111827' }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#111827' }}>Description</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Additional details..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none"
                  style={{ color: '#111827' }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#111827' }}>Due Date *</label>
                <input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  style={{ color: '#111827' }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#111827' }}>Recurrence (months)</label>
                <input
                  type="number"
                  value={newRecurrence}
                  onChange={(e) => setNewRecurrence(e.target.value)}
                  placeholder="e.g. 12 for annual"
                  min="1"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  style={{ color: '#111827' }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#111827' }}>Provider Name</label>
                <input
                  type="text"
                  value={newProvider}
                  onChange={(e) => setNewProvider(e.target.value)}
                  placeholder="e.g. FireSafe Ireland"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  style={{ color: '#111827' }}
                />
              </div>

              <button
                onClick={handleCreate}
                disabled={saving || !newTitle.trim() || !newDueDate}
                className="w-full py-3 text-sm font-semibold rounded-lg text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: '#D4AF37' }}
              >
                {saving ? 'Saving...' : 'Add Compliance Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
