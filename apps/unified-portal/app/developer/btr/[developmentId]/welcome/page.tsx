'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  BookOpen,
  CheckCircle2,
  Calendar,
  ToggleLeft,
  ToggleRight,
  Building2,
  AlertCircle,
} from 'lucide-react';
import type { WelcomeSequenceItem } from '@/types/btr';

const CATEGORY_COLORS: Record<string, { color: string; bg: string; label: string }> = {
  essentials: { color: '#3B82F6', bg: '#EFF6FF', label: 'Essentials' },
  appliances: { color: '#8B5CF6', bg: '#F5F3FF', label: 'Appliances' },
  local_area: { color: '#10B981', bg: '#ECFDF5', label: 'Local Area' },
  community: { color: '#F59E0B', bg: '#FFFBEB', label: 'Community' },
  general: { color: '#6B7280', bg: '#F9FAFB', label: 'General' },
};

const CATEGORIES = ['essentials', 'appliances', 'local_area', 'community', 'general'] as const;

interface NewItemForm {
  day_number: number;
  title: string;
  message: string;
  category: 'general' | 'appliances' | 'community' | 'essentials' | 'local_area';
}

const emptyForm: NewItemForm = { day_number: 1, title: '', message: '', category: 'general' };

export default function BTRWelcomePage() {
  const params = useParams();
  const developmentId = params.developmentId as string;

  const [items, setItems] = useState<WelcomeSequenceItem[]>([]);
  const [developmentName, setDevelopmentName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState<NewItemForm>({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<NewItemForm>({ ...emptyForm });

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [welcomeRes, btrRes] = await Promise.all([
          fetch(`/api/developments/${developmentId}/btr/welcome`),
          fetch(`/api/developments/${developmentId}/btr`),
        ]);

        if (welcomeRes.ok) {
          const welcomeData = await welcomeRes.json();
          setItems(Array.isArray(welcomeData) ? welcomeData : welcomeData.items || []);
        }

        if (btrRes.ok) {
          const btrData = await btrRes.json();
          setDevelopmentName(btrData.development?.name || '');
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [developmentId]);

  const sortedItems = [...items].sort((a, b) => a.day_number - b.day_number);

  async function handleAddItem() {
    if (!newItem.title.trim() || !newItem.message.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/developments/${developmentId}/btr/welcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem),
      });
      if (!res.ok) throw new Error('Failed to add item');
      const created = await res.json();
      setItems((prev) => [...prev, created]);
      setNewItem({ ...emptyForm });
      setShowAddForm(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(item: WelcomeSequenceItem) {
    try {
      const res = await fetch(`/api/developments/${developmentId}/btr/welcome`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, is_active: !item.is_active }),
      });
      if (!res.ok) throw new Error('Failed to update');
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, is_active: !i.is_active } : i))
      );
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
      const res = await fetch(`/api/developments/${developmentId}/btr/welcome`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error('Failed to delete');
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err: any) {
      alert(err.message);
    }
  }

  function startEdit(item: WelcomeSequenceItem) {
    setEditingId(item.id);
    setEditForm({
      day_number: item.day_number,
      title: item.title,
      message: item.message,
      category: item.category,
    });
  }

  async function handleSaveEdit(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/developments/${developmentId}/btr/welcome`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...editForm }),
      });
      if (!res.ok) throw new Error('Failed to update');
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, ...editForm } : i))
      );
      setEditingId(null);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  const btrBasePath = `/developer/btr/${developmentId}`;

  const navTabs = [
    { label: 'Overview', href: `${btrBasePath}/overview`, active: false },
    { label: 'Units', href: `${btrBasePath}/units`, active: false },
    { label: 'Maintenance', href: `${btrBasePath}/maintenance`, active: false },
    { label: 'Compliance', href: `${btrBasePath}/compliance`, active: false },
    { label: 'Amenities', href: `${btrBasePath}/amenities`, active: false },
    { label: 'Welcome', href: `${btrBasePath}/welcome`, active: true },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div
            className="w-10 h-10 rounded-full border-t-transparent animate-spin mx-auto"
            style={{ borderWidth: 3, borderStyle: 'solid', borderColor: '#D4AF37', borderTopColor: 'transparent' }}
          />
          <p className="text-sm mt-4" style={{ color: '#111827' }}>Loading welcome sequence...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 mx-auto mb-4" style={{ color: '#EF4444' }} />
          <h2 className="text-lg font-semibold mb-2" style={{ color: '#111827' }}>Failed to load data</h2>
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/developer/btr/${developmentId}/overview`}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" style={{ color: '#111827' }} />
              </Link>
              <div>
                <h1 className="text-xl font-bold font-serif" style={{ color: '#111827' }}>
                  Welcome Sequence
                </h1>
                {developmentName && (
                  <p className="text-sm" style={{ color: '#111827' }}>{developmentName}</p>
                )}
              </div>
            </div>
            <button
              onClick={() => { setShowAddForm(true); setEditingId(null); }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-white transition-colors hover:opacity-90"
              style={{ backgroundColor: '#D4AF37' }}
            >
              <Plus className="w-4 h-4" />
              Add Item
            </button>
          </div>

          <div className="flex gap-1 mt-4 -mb-px overflow-x-auto">
            {navTabs.map((tab) => (
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
                {tab.label === 'Welcome' && <BookOpen className="w-4 h-4" />}
                {tab.label}
              </Link>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {showAddForm && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-8">
            <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: '#111827' }}>
              New Welcome Sequence Item
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#111827' }}>Day Number</label>
                <input
                  type="number"
                  min={1}
                  value={newItem.day_number}
                  onChange={(e) => setNewItem({ ...newItem, day_number: parseInt(e.target.value) || 1 })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                  style={{ color: '#111827', focusRingColor: '#D4AF37' } as any}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#111827' }}>Category</label>
                <select
                  value={newItem.category}
                  onChange={(e) => setNewItem({ ...newItem, category: e.target.value as NewItemForm['category'] })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                  style={{ color: '#111827' }}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{CATEGORY_COLORS[cat].label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1" style={{ color: '#111827' }}>Title</label>
              <input
                type="text"
                value={newItem.title}
                onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                placeholder="e.g. Welcome to your new home"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                style={{ color: '#111827' }}
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1" style={{ color: '#111827' }}>Message</label>
              <textarea
                value={newItem.message}
                onChange={(e) => setNewItem({ ...newItem, message: e.target.value })}
                placeholder="Write the welcome message content..."
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 resize-none"
                style={{ color: '#111827' }}
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleAddItem}
                disabled={saving || !newItem.title.trim() || !newItem.message.trim()}
                className="px-4 py-2 text-sm font-medium rounded-lg text-white transition-colors hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: '#D4AF37' }}
              >
                {saving ? 'Saving...' : 'Save Item'}
              </button>
              <button
                onClick={() => { setShowAddForm(false); setNewItem({ ...emptyForm }); }}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                style={{ color: '#111827' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {sortedItems.length === 0 && !showAddForm ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
            <BookOpen className="w-12 h-12 mx-auto mb-4" style={{ color: '#D4AF37' }} />
            <h3 className="text-lg font-semibold mb-2" style={{ color: '#111827' }}>No Welcome Sequence Items</h3>
            <p className="text-sm mb-6" style={{ color: '#6B7280' }}>
              Create a day-by-day welcome sequence for new tenants.
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-white transition-colors hover:opacity-90"
              style={{ backgroundColor: '#D4AF37' }}
            >
              <Plus className="w-4 h-4" />
              Add First Item
            </button>
          </div>
        ) : (
          <div className="relative">
            {sortedItems.length > 1 && (
              <div
                className="absolute left-6 top-8 bottom-8 w-0.5"
                style={{ backgroundColor: '#E5E7EB' }}
              />
            )}

            <div className="space-y-6">
              {sortedItems.map((item) => {
                const catConfig = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.general;
                const isEditing = editingId === item.id;

                return (
                  <div key={item.id} className="relative flex gap-4">
                    <div className="relative z-10 flex-shrink-0">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-sm"
                        style={{ backgroundColor: '#D4AF37' }}
                      >
                        <span className="flex flex-col items-center leading-none">
                          <Calendar className="w-3 h-3 mb-0.5" />
                          <span>{item.day_number}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                      {isEditing ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium mb-1" style={{ color: '#111827' }}>Day Number</label>
                              <input
                                type="number"
                                min={1}
                                value={editForm.day_number}
                                onChange={(e) => setEditForm({ ...editForm, day_number: parseInt(e.target.value) || 1 })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                                style={{ color: '#111827' }}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium mb-1" style={{ color: '#111827' }}>Category</label>
                              <select
                                value={editForm.category}
                                onChange={(e) => setEditForm({ ...editForm, category: e.target.value as NewItemForm['category'] })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                                style={{ color: '#111827' }}
                              >
                                {CATEGORIES.map((cat) => (
                                  <option key={cat} value={cat}>{CATEGORY_COLORS[cat].label}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-1" style={{ color: '#111827' }}>Title</label>
                            <input
                              type="text"
                              value={editForm.title}
                              onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                              style={{ color: '#111827' }}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-1" style={{ color: '#111827' }}>Message</label>
                            <textarea
                              value={editForm.message}
                              onChange={(e) => setEditForm({ ...editForm, message: e.target.value })}
                              rows={3}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 resize-none"
                              style={{ color: '#111827' }}
                            />
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => handleSaveEdit(item.id)}
                              disabled={saving}
                              className="px-3 py-1.5 text-sm font-medium rounded-lg text-white transition-colors hover:opacity-90 disabled:opacity-50"
                              style={{ backgroundColor: '#D4AF37' }}
                            >
                              {saving ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                              style={{ color: '#111827' }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-base font-bold" style={{ color: '#111827' }}>
                                {item.title}
                              </h3>
                              <p
                                className="text-sm mt-1"
                                style={{
                                  color: '#6B7280',
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                }}
                              >
                                {item.message}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button
                                onClick={() => handleToggleActive(item)}
                                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                                title={item.is_active ? 'Deactivate' : 'Activate'}
                              >
                                {item.is_active ? (
                                  <ToggleRight className="w-6 h-6" style={{ color: '#D4AF37' }} />
                                ) : (
                                  <ToggleLeft className="w-6 h-6" style={{ color: '#9CA3AF' }} />
                                )}
                              </button>
                              <button
                                onClick={() => startEdit(item)}
                                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                                title="Edit"
                              >
                                <Edit className="w-4 h-4" style={{ color: '#6B7280' }} />
                              </button>
                              <button
                                onClick={() => handleDelete(item.id)}
                                className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" style={{ color: '#EF4444' }} />
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-3">
                            <span
                              className="inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full"
                              style={{ backgroundColor: catConfig.bg, color: catConfig.color }}
                            >
                              {catConfig.label}
                            </span>
                            <span
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full"
                              style={{
                                backgroundColor: item.is_active ? '#ECFDF5' : '#F9FAFB',
                                color: item.is_active ? '#059669' : '#6B7280',
                              }}
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              {item.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}