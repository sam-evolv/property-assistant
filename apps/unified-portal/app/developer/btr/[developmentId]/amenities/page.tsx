'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  AlertCircle,
  Plus,
  ArrowLeft,
  X,
  Dumbbell,
  Sun,
  Users,
  Flame,
  Zap,
  Car,
  Bike,
  Film,
  Waves,
  Laptop,
  Settings,
  MoreHorizontal,
} from 'lucide-react';
import {
  AMENITY_TYPE_CONFIG,
} from '@/types/btr';
import type {
  Amenity,
  AmenityType,
} from '@/types/btr';

interface BTRData {
  development: { id: string; name: string };
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  Dumbbell,
  Users,
  Sun,
  Flame,
  BatteryCharging: Zap,
  Car,
  Bike,
  Film,
  Waves,
  Laptop,
  Shirt: Settings,
  MoreHorizontal,
  Zap,
  Settings,
};

export default function BTRAmenitiesPage() {
  const params = useParams();
  const developmentId = params.developmentId as string;

  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [btrData, setBtrData] = useState<BTRData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [selectedAmenity, setSelectedAmenity] = useState<Amenity | null>(null);
  const [saving, setSaving] = useState(false);

  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<AmenityType>('gym');
  const [newDescription, setNewDescription] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newCapacity, setNewCapacity] = useState('');
  const [newMaxDuration, setNewMaxDuration] = useState('2');
  const [newMaxAdvance, setNewMaxAdvance] = useState('7');
  const [newIsBookable, setNewIsBookable] = useState(true);

  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<AmenityType>('gym');
  const [editDescription, setEditDescription] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editCapacity, setEditCapacity] = useState('');
  const [editMaxDuration, setEditMaxDuration] = useState('');
  const [editMaxAdvance, setEditMaxAdvance] = useState('');
  const [editIsBookable, setEditIsBookable] = useState(true);
  const [editIsActive, setEditIsActive] = useState(true);
  const [editAvailableFrom, setEditAvailableFrom] = useState('');
  const [editAvailableUntil, setEditAvailableUntil] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [amenRes, btrRes] = await Promise.all([
          fetch(`/api/developments/${developmentId}/btr/amenities`),
          fetch(`/api/developments/${developmentId}/btr`),
        ]);
        if (!amenRes.ok) throw new Error('Failed to fetch amenities data');
        if (!btrRes.ok) throw new Error('Failed to fetch BTR data');
        const amenData = await amenRes.json();
        const btr = await btrRes.json();
        setAmenities(Array.isArray(amenData) ? amenData : amenData.amenities || []);
        setBtrData(btr);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [developmentId]);

  function getAmenityIcon(type: AmenityType) {
    const config = AMENITY_TYPE_CONFIG[type];
    const IconComp = ICON_MAP[config?.icon] || MoreHorizontal;
    return IconComp;
  }

  function openAmenityDetail(amenity: Amenity) {
    setSelectedAmenity(amenity);
    setEditName(amenity.name);
    setEditType(amenity.type);
    setEditDescription(amenity.description || '');
    setEditLocation(amenity.location || '');
    setEditCapacity(amenity.capacity != null ? String(amenity.capacity) : '');
    setEditMaxDuration(String(amenity.max_duration_hours));
    setEditMaxAdvance(String(amenity.max_advance_days));
    setEditIsBookable(amenity.is_bookable);
    setEditIsActive(amenity.is_active);
    setEditAvailableFrom(amenity.available_from || '');
    setEditAvailableUntil(amenity.available_until || '');
  }

  async function handleSave() {
    if (!selectedAmenity) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/developments/${developmentId}/btr/amenities`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedAmenity.id,
          name: editName,
          type: editType,
          description: editDescription || undefined,
          location: editLocation || undefined,
          capacity: editCapacity ? parseInt(editCapacity) : undefined,
          max_duration_hours: parseInt(editMaxDuration) || 2,
          max_advance_days: parseInt(editMaxAdvance) || 7,
          is_bookable: editIsBookable,
          is_active: editIsActive,
          available_from: editAvailableFrom || undefined,
          available_until: editAvailableUntil || undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed to update amenity');
      const updated = await res.json();
      setAmenities((prev) =>
        prev.map((a) => (a.id === selectedAmenity.id ? { ...a, ...updated, ...(updated.amenity || {}) } : a))
      );
      setSelectedAmenity(null);
    } catch (err: any) {
      alert('Error saving: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/developments/${developmentId}/btr/amenities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          type: newType,
          description: newDescription || undefined,
          location: newLocation || undefined,
          capacity: newCapacity ? parseInt(newCapacity) : undefined,
          max_duration_hours: parseInt(newMaxDuration) || 2,
          max_advance_days: parseInt(newMaxAdvance) || 7,
          is_bookable: newIsBookable,
          development_id: developmentId,
        }),
      });
      if (!res.ok) throw new Error('Failed to create amenity');
      const created = await res.json();
      setAmenities((prev) => [created.amenity || created, ...prev]);
      setShowNewForm(false);
      setNewName('');
      setNewType('gym');
      setNewDescription('');
      setNewLocation('');
      setNewCapacity('');
      setNewMaxDuration('2');
      setNewMaxAdvance('7');
      setNewIsBookable(true);
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
          <p className="text-sm mt-4" style={{ color: '#111827' }}>Loading amenities...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 mx-auto mb-4" style={{ color: '#EF4444' }} />
          <h2 className="text-lg font-semibold mb-2" style={{ color: '#111827' }}>Failed to load amenities</h2>
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
                  Amenities - {developmentName}
                </h1>
                <p className="text-sm" style={{ color: '#111827' }}>Manage shared facilities and booking settings</p>
              </div>
            </div>
            <button
              onClick={() => setShowNewForm(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-white transition-colors"
              style={{ backgroundColor: '#D4AF37' }}
            >
              <Plus className="w-4 h-4" />
              Add Amenity
            </button>
          </div>
          <div className="flex gap-1 mt-4 -mb-px overflow-x-auto">
            {navTabs.map((tab) => {
              const isActive = tab.label === 'Amenities';
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

      <main className="max-w-7xl mx-auto px-6 py-8">
        {amenities.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
            <Dumbbell className="w-10 h-10 mx-auto mb-3" style={{ color: '#D4AF37' }} />
            <p className="text-sm font-medium" style={{ color: '#111827' }}>No amenities configured</p>
            <p className="text-sm mt-1" style={{ color: '#111827' }}>Click &quot;Add Amenity&quot; to set up your first facility.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {amenities.map((amenity) => {
              const IconComp = getAmenityIcon(amenity.type);
              const typeConfig = AMENITY_TYPE_CONFIG[amenity.type];
              return (
                <div
                  key={amenity.id}
                  onClick={() => openAmenityDetail(amenity)}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: '#FEFCE8' }}
                    >
                      <IconComp className="w-6 h-6" style={{ color: '#D4AF37' }} />
                    </div>
                    <span
                      className="inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full"
                      style={{
                        backgroundColor: amenity.is_active ? '#ECFDF5' : '#F9FAFB',
                        color: amenity.is_active ? '#059669' : '#6B7280',
                      }}
                    >
                      {amenity.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <h3 className="text-base font-bold" style={{ color: '#111827' }}>{amenity.name}</h3>
                  <p className="text-sm mt-0.5" style={{ color: '#111827' }}>{typeConfig?.label || amenity.type}</p>
                  <div className="flex items-center gap-4 mt-3 text-xs" style={{ color: '#111827' }}>
                    {amenity.capacity != null && (
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        Capacity: {amenity.capacity}
                      </span>
                    )}
                    {amenity.is_bookable && (
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ backgroundColor: '#FEFCE8', color: '#D4AF37' }}
                      >
                        Bookable
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {selectedAmenity && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setSelectedAmenity(null)}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="relative w-full max-w-lg bg-white shadow-xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-bold font-serif" style={{ color: '#111827' }}>Manage Amenity</h2>
              <button
                onClick={() => setSelectedAmenity(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" style={{ color: '#111827' }} />
              </button>
            </div>

            <div className="px-6 py-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#111827' }}>Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  style={{ color: '#111827' }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#111827' }}>Type</label>
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value as AmenityType)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  style={{ color: '#111827' }}
                >
                  {(Object.entries(AMENITY_TYPE_CONFIG) as [AmenityType, { label: string; icon: string }][]).map(
                    ([key, config]) => (
                      <option key={key} value={key}>{config.label}</option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#111827' }}>Description</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none"
                  style={{ color: '#111827' }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#111827' }}>Location</label>
                <input
                  type="text"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  placeholder="e.g. Ground Floor, Block A"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  style={{ color: '#111827' }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#111827' }}>Capacity</label>
                <input
                  type="number"
                  value={editCapacity}
                  onChange={(e) => setEditCapacity(e.target.value)}
                  min="1"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  style={{ color: '#111827' }}
                />
              </div>

              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#111827' }}>Booking Rules</h4>

                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: '#111827' }}>Bookable</span>
                  <button
                    onClick={() => setEditIsBookable(!editIsBookable)}
                    className="w-10 h-6 rounded-full transition-colors relative"
                    style={{ backgroundColor: editIsBookable ? '#D4AF37' : '#D1D5DB' }}
                  >
                    <div
                      className="w-4 h-4 bg-white rounded-full absolute top-1 transition-all"
                      style={{ left: editIsBookable ? 20 : 4 }}
                    />
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#111827' }}>Max Duration (hours)</label>
                  <input
                    type="number"
                    value={editMaxDuration}
                    onChange={(e) => setEditMaxDuration(e.target.value)}
                    min="1"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                    style={{ color: '#111827' }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#111827' }}>Max Advance Booking (days)</label>
                  <input
                    type="number"
                    value={editMaxAdvance}
                    onChange={(e) => setEditMaxAdvance(e.target.value)}
                    min="1"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                    style={{ color: '#111827' }}
                  />
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#111827' }}>Availability</h4>

                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: '#111827' }}>Active</span>
                  <button
                    onClick={() => setEditIsActive(!editIsActive)}
                    className="w-10 h-6 rounded-full transition-colors relative"
                    style={{ backgroundColor: editIsActive ? '#10B981' : '#D1D5DB' }}
                  >
                    <div
                      className="w-4 h-4 bg-white rounded-full absolute top-1 transition-all"
                      style={{ left: editIsActive ? 20 : 4 }}
                    />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: '#111827' }}>Available From</label>
                    <input
                      type="time"
                      value={editAvailableFrom}
                      onChange={(e) => setEditAvailableFrom(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                      style={{ color: '#111827' }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: '#111827' }}>Available Until</label>
                    <input
                      type="time"
                      value={editAvailableUntil}
                      onChange={(e) => setEditAvailableUntil(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                      style={{ color: '#111827' }}
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={handleSave}
                disabled={saving || !editName.trim()}
                className="w-full py-3 text-sm font-semibold rounded-lg text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: '#D4AF37' }}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewForm && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setShowNewForm(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="relative w-full max-w-lg bg-white shadow-xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-bold font-serif" style={{ color: '#111827' }}>Add Amenity</h2>
              <button
                onClick={() => setShowNewForm(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" style={{ color: '#111827' }} />
              </button>
            </div>

            <div className="px-6 py-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#111827' }}>Name *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Residents Gym"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  style={{ color: '#111827' }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#111827' }}>Type</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as AmenityType)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  style={{ color: '#111827' }}
                >
                  {(Object.entries(AMENITY_TYPE_CONFIG) as [AmenityType, { label: string; icon: string }][]).map(
                    ([key, config]) => (
                      <option key={key} value={key}>{config.label}</option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#111827' }}>Description</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Describe the amenity..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none"
                  style={{ color: '#111827' }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#111827' }}>Location</label>
                <input
                  type="text"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder="e.g. Ground Floor, Block A"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  style={{ color: '#111827' }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#111827' }}>Capacity</label>
                <input
                  type="number"
                  value={newCapacity}
                  onChange={(e) => setNewCapacity(e.target.value)}
                  placeholder="e.g. 15"
                  min="1"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  style={{ color: '#111827' }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#111827' }}>Max Duration (hours)</label>
                <input
                  type="number"
                  value={newMaxDuration}
                  onChange={(e) => setNewMaxDuration(e.target.value)}
                  min="1"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  style={{ color: '#111827' }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#111827' }}>Max Advance Booking (days)</label>
                <input
                  type="number"
                  value={newMaxAdvance}
                  onChange={(e) => setNewMaxAdvance(e.target.value)}
                  min="1"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  style={{ color: '#111827' }}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium" style={{ color: '#111827' }}>Bookable</span>
                <button
                  onClick={() => setNewIsBookable(!newIsBookable)}
                  className="w-10 h-6 rounded-full transition-colors relative"
                  style={{ backgroundColor: newIsBookable ? '#D4AF37' : '#D1D5DB' }}
                >
                  <div
                    className="w-4 h-4 bg-white rounded-full absolute top-1 transition-all"
                    style={{ left: newIsBookable ? 20 : 4 }}
                  />
                </button>
              </div>

              <button
                onClick={handleCreate}
                disabled={saving || !newName.trim()}
                className="w-full py-3 text-sm font-semibold rounded-lg text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: '#D4AF37' }}
              >
                {saving ? 'Saving...' : 'Add Amenity'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
