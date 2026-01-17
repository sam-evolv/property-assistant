'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { Plus, Upload, Download, Copy, Trash2, CheckCircle, AlertTriangle, Settings, Info, FileText, Home, Ruler, ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react';

interface Development {
  id: string;
  name: string;
}

interface HouseType {
  id: string;
  house_type_code: string;
  development_id: string;
  bedrooms?: number;
  total_floor_area_sqm?: number;
}

interface RoomDimension {
  id: string;
  tenant_id: string;
  development_id: string;
  house_type_id: string;
  unit_id: string | null;
  room_name: string;
  room_key: string;
  floor: string | null;
  length_m: number | null;
  width_m: number | null;
  area_sqm: string | null;
  ceiling_height_m: string | null;
  source: string;
  verified: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  development_name: string | null;
  house_type_code: string | null;
  unit_number: string | null;
}

interface DimensionSettings {
  enabled: boolean;
  show_disclaimer: boolean;
  attach_floorplans: boolean;
  disclaimer_text: string;
}

interface Stats {
  total: number;
  verified: number;
  unverified: number;
}

// Standard room templates for quick addition
const ROOM_TEMPLATES = [
  { room_key: 'living_room', room_name: 'Living Room', floor: 'Ground' },
  { room_key: 'kitchen', room_name: 'Kitchen', floor: 'Ground' },
  { room_key: 'kitchen_dining', room_name: 'Kitchen/Dining', floor: 'Ground' },
  { room_key: 'dining_room', room_name: 'Dining Room', floor: 'Ground' },
  { room_key: 'utility', room_name: 'Utility Room', floor: 'Ground' },
  { room_key: 'wc_ground', room_name: 'WC', floor: 'Ground' },
  { room_key: 'hallway', room_name: 'Hallway', floor: 'Ground' },
  { room_key: 'master_bedroom', room_name: 'Master Bedroom', floor: 'First' },
  { room_key: 'bedroom_2', room_name: 'Bedroom 2', floor: 'First' },
  { room_key: 'bedroom_3', room_name: 'Bedroom 3', floor: 'First' },
  { room_key: 'bedroom_4', room_name: 'Bedroom 4', floor: 'First' },
  { room_key: 'ensuite', room_name: 'Ensuite', floor: 'First' },
  { room_key: 'bathroom', room_name: 'Bathroom', floor: 'First' },
  { room_key: 'landing', room_name: 'Landing', floor: 'First' },
  { room_key: 'study', room_name: 'Study', floor: 'Ground' },
  { room_key: 'garage', room_name: 'Garage', floor: 'Ground' },
  { room_key: 'garden', room_name: 'Garden', floor: 'External' },
  { room_key: 'patio', room_name: 'Patio', floor: 'External' },
];

const DEFAULT_DISCLAIMER = "Please note: These dimensions are provided as a guide only. For exact measurements, please refer to the official floor plans and architectural drawings. We recommend verifying dimensions independently before making any purchasing decisions based on room sizes.";

export default function RoomDimensionsPage() {
  const [dimensions, setDimensions] = useState<RoomDimension[]>([]);
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [houseTypes, setHouseTypes] = useState<HouseType[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, verified: 0, unverified: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedDevelopmentId, setSelectedDevelopmentId] = useState<string>('');
  const [selectedHouseTypeId, setSelectedHouseTypeId] = useState<string>('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [expandedHouseTypes, setExpandedHouseTypes] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<RoomDimension>>({});

  // Settings state
  const [settings, setSettings] = useState<DimensionSettings>({
    enabled: true,
    show_disclaimer: true,
    attach_floorplans: true,
    disclaimer_text: DEFAULT_DISCLAIMER,
  });

  // New room form state
  const [newRoom, setNewRoom] = useState({
    room_key: '',
    room_name: '',
    floor: 'Ground',
    length_m: '',
    width_m: '',
    area_sqm: '',
    ceiling_height_m: '',
    notes: '',
  });

  useEffect(() => {
    fetchDevelopments();
    loadSettings();
  }, []);

  useEffect(() => {
    if (selectedDevelopmentId) {
      fetchHouseTypes(selectedDevelopmentId);
      fetchDimensions();
    }
  }, [selectedDevelopmentId]);

  useEffect(() => {
    fetchDimensions();
  }, [selectedHouseTypeId]);

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/developer/settings?key=room_dimensions');
      if (res.ok) {
        const data = await res.json();
        if (data.value) {
          setSettings({ ...settings, ...data.value });
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const saveSettings = async (newSettings: DimensionSettings) => {
    try {
      const res = await fetch('/api/developer/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'room_dimensions', value: newSettings }),
      });
      if (res.ok) {
        setSettings(newSettings);
        toast.success('Settings saved');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings');
    }
  };

  const fetchDevelopments = async () => {
    try {
      const res = await fetch('/api/developments');
      if (res.ok) {
        const data = await res.json();
        const devs = data.developments || [];
        setDevelopments(devs);
        if (devs.length > 0) {
          setSelectedDevelopmentId(devs[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch developments:', error);
    }
  };

  const fetchHouseTypes = async (developmentId: string) => {
    try {
      const res = await fetch(`/api/developments/${developmentId}/house-types`);
      if (res.ok) {
        const data = await res.json();
        setHouseTypes(data.houseTypes || []);
        // Auto-expand all house types initially
        setExpandedHouseTypes(new Set((data.houseTypes || []).map((ht: HouseType) => ht.id)));
      }
    } catch (error) {
      console.error('Failed to fetch house types:', error);
    }
  };

  const fetchDimensions = async () => {
    if (!selectedDevelopmentId) return;

    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('development_id', selectedDevelopmentId);
      if (selectedHouseTypeId) {
        params.set('house_type_id', selectedHouseTypeId);
      }

      const res = await fetch(`/api/admin/room-dimensions?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setDimensions(data.dimensions || []);
        setStats(data.stats || { total: 0, verified: 0, unverified: 0 });
      }
    } catch (error) {
      console.error('Failed to fetch dimensions:', error);
      toast.error('Failed to load room dimensions');
    } finally {
      setLoading(false);
    }
  };

  const handleAddRoom = async () => {
    if (!selectedHouseTypeId || !newRoom.room_key || !newRoom.room_name) {
      toast.error('Please select a house type and fill in room name');
      return;
    }

    try {
      const res = await fetch('/api/admin/room-dimensions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          development_id: selectedDevelopmentId,
          house_type_id: selectedHouseTypeId,
          room_key: newRoom.room_key,
          room_name: newRoom.room_name,
          floor: newRoom.floor || null,
          length_m: newRoom.length_m ? parseFloat(newRoom.length_m) : null,
          width_m: newRoom.width_m ? parseFloat(newRoom.width_m) : null,
          area_sqm: newRoom.area_sqm ? parseFloat(newRoom.area_sqm) : null,
          ceiling_height_m: newRoom.ceiling_height_m ? parseFloat(newRoom.ceiling_height_m) : null,
          notes: newRoom.notes || null,
          source: 'manual',
          verified: true, // Manual entries are considered verified
        }),
      });

      if (res.ok) {
        toast.success('Room added successfully');
        setNewRoom({
          room_key: '',
          room_name: '',
          floor: 'Ground',
          length_m: '',
          width_m: '',
          area_sqm: '',
          ceiling_height_m: '',
          notes: '',
        });
        setShowAddForm(false);
        fetchDimensions();
      } else {
        throw new Error('Failed to add room');
      }
    } catch (error) {
      console.error('Failed to add room:', error);
      toast.error('Failed to add room');
    }
  };

  const handleCopyToHouseType = async (sourceHouseTypeId: string, targetHouseTypeId: string) => {
    const sourceDims = dimensions.filter(d => d.house_type_id === sourceHouseTypeId);

    if (sourceDims.length === 0) {
      toast.error('No dimensions to copy');
      return;
    }

    try {
      for (const dim of sourceDims) {
        await fetch('/api/admin/room-dimensions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            development_id: selectedDevelopmentId,
            house_type_id: targetHouseTypeId,
            room_key: dim.room_key,
            room_name: dim.room_name,
            floor: dim.floor,
            length_m: dim.length_m,
            width_m: dim.width_m,
            area_sqm: dim.area_sqm,
            ceiling_height_m: dim.ceiling_height_m,
            notes: dim.notes,
            source: 'copied',
            verified: false, // Copied entries need verification
          }),
        });
      }

      toast.success(`Copied ${sourceDims.length} rooms to new house type`);
      fetchDimensions();
    } catch (error) {
      console.error('Failed to copy dimensions:', error);
      toast.error('Failed to copy dimensions');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this room dimension?')) return;

    try {
      const res = await fetch(`/api/admin/room-dimensions?id=${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.success('Room deleted');
        fetchDimensions();
      } else {
        throw new Error('Failed to delete');
      }
    } catch (error) {
      console.error('Failed to delete:', error);
      toast.error('Failed to delete room');
    }
  };

  const handleVerify = async (id: string, verified: boolean) => {
    try {
      const res = await fetch('/api/admin/room-dimensions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, verified }),
      });

      if (res.ok) {
        toast.success(verified ? 'Room verified' : 'Verification removed');
        fetchDimensions();
      } else {
        throw new Error('Failed to update');
      }
    } catch (error) {
      console.error('Failed to verify:', error);
      toast.error('Failed to update verification status');
    }
  };

  const startEdit = (dimension: RoomDimension) => {
    setEditingId(dimension.id);
    setEditForm({
      room_name: dimension.room_name,
      room_key: dimension.room_key,
      floor: dimension.floor,
      length_m: dimension.length_m,
      width_m: dimension.width_m,
      area_sqm: dimension.area_sqm,
      ceiling_height_m: dimension.ceiling_height_m,
      notes: dimension.notes,
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;

    try {
      const res = await fetch('/api/admin/room-dimensions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId,
          ...editForm,
          length_m: editForm.length_m ? parseFloat(String(editForm.length_m)) : null,
          width_m: editForm.width_m ? parseFloat(String(editForm.width_m)) : null,
          area_sqm: editForm.area_sqm ? parseFloat(String(editForm.area_sqm)) : null,
          ceiling_height_m: editForm.ceiling_height_m ? parseFloat(String(editForm.ceiling_height_m)) : null,
        }),
      });

      if (res.ok) {
        toast.success('Room updated');
        setEditingId(null);
        setEditForm({});
        fetchDimensions();
      } else {
        throw new Error('Failed to update');
      }
    } catch (error) {
      console.error('Failed to save:', error);
      toast.error('Failed to save changes');
    }
  };

  const handleExportCSV = () => {
    const csvRows = [
      ['House Type', 'Room Name', 'Room Key', 'Floor', 'Length (m)', 'Width (m)', 'Area (m²)', 'Ceiling Height (m)', 'Verified', 'Notes'].join(','),
    ];

    dimensions.forEach(dim => {
      csvRows.push([
        dim.house_type_code || '',
        dim.room_name,
        dim.room_key,
        dim.floor || '',
        dim.length_m?.toString() || '',
        dim.width_m?.toString() || '',
        dim.area_sqm || '',
        dim.ceiling_height_m || '',
        dim.verified ? 'Yes' : 'No',
        dim.notes || '',
      ].map(v => `"${v}"`).join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `room-dimensions-${selectedDevelopmentId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const toggleHouseType = (houseTypeId: string) => {
    const newExpanded = new Set(expandedHouseTypes);
    if (newExpanded.has(houseTypeId)) {
      newExpanded.delete(houseTypeId);
    } else {
      newExpanded.add(houseTypeId);
    }
    setExpandedHouseTypes(newExpanded);
  };

  const getDimensionsByHouseType = (houseTypeId: string) => {
    return dimensions.filter(d => d.house_type_id === houseTypeId);
  };

  const selectRoomTemplate = (template: typeof ROOM_TEMPLATES[0]) => {
    setNewRoom({
      ...newRoom,
      room_key: template.room_key,
      room_name: template.room_name,
      floor: template.floor,
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Ruler className="w-7 h-7 text-gold-500" />
              Room Dimensions
            </h1>
            <p className="text-gray-600 mt-1">
              Manage room dimensions by house type. This data powers the AI assistant's ability to answer questions like "How big is my living room?"
            </p>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="mb-6 p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-600" />
            Dimension Feature Settings
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                {settings.enabled ? (
                  <Eye className="w-5 h-5 text-green-500" />
                ) : (
                  <EyeOff className="w-5 h-5 text-gray-400" />
                )}
                <div>
                  <p className="font-medium text-gray-900">Enable Room Dimensions in AI</p>
                  <p className="text-sm text-gray-600">When enabled, the AI assistant can answer questions about room sizes</p>
                </div>
              </div>
              <button
                onClick={() => saveSettings({ ...settings, enabled: !settings.enabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                  settings.enabled ? 'bg-green-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    settings.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <div>
                  <p className="font-medium text-gray-900">Show Disclaimer</p>
                  <p className="text-sm text-gray-600">Display a disclaimer advising users to verify dimensions with floor plans</p>
                </div>
              </div>
              <button
                onClick={() => saveSettings({ ...settings, show_disclaimer: !settings.show_disclaimer })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                  settings.show_disclaimer ? 'bg-green-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    settings.show_disclaimer ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="font-medium text-gray-900">Attach Floor Plans</p>
                  <p className="text-sm text-gray-600">When answering dimension questions, suggest viewing the floor plan document</p>
                </div>
              </div>
              <button
                onClick={() => saveSettings({ ...settings, attach_floorplans: !settings.attach_floorplans })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                  settings.attach_floorplans ? 'bg-green-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    settings.attach_floorplans ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
              <label className="block text-sm font-medium text-amber-900 mb-2">
                Disclaimer Text
              </label>
              <textarea
                value={settings.disclaimer_text}
                onChange={(e) => setSettings({ ...settings, disclaimer_text: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
              />
              <button
                onClick={() => saveSettings(settings)}
                className="mt-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm"
              >
                Save Disclaimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Banner */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-500 mt-0.5" />
          <div>
            <p className="text-sm text-blue-800 font-medium">How this works</p>
            <p className="text-sm text-blue-700 mt-1">
              Enter room dimensions once per house type (e.g., "Type A 3-Bed"). These measurements apply to all units of that type.
              When a homeowner asks "How big is my kitchen?", the AI will look up their house type and provide the verified dimensions.
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Home className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{houseTypes.length}</p>
              <p className="text-sm text-gray-600">House Types</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <Ruler className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-sm text-gray-600">Total Rooms</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{stats.verified}</p>
              <p className="text-sm text-gray-600">Verified</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{stats.unverified}</p>
              <p className="text-sm text-gray-600">Pending</p>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6">
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex gap-4">
              <select
                value={selectedDevelopmentId}
                onChange={(e) => {
                  setSelectedDevelopmentId(e.target.value);
                  setSelectedHouseTypeId('');
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">Select Development</option>
                {developments.map((dev) => (
                  <option key={dev.id} value={dev.id}>{dev.name}</option>
                ))}
              </select>

              <select
                value={selectedHouseTypeId}
                onChange={(e) => setSelectedHouseTypeId(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                disabled={!selectedDevelopmentId}
              >
                <option value="">All House Types</option>
                {houseTypes.map((ht) => (
                  <option key={ht.id} value={ht.id}>{ht.house_type_code}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleExportCSV}
                disabled={dimensions.length === 0}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
              <button
                onClick={() => setShowAddForm(true)}
                disabled={!selectedHouseTypeId}
                className="flex items-center gap-2 px-4 py-2 bg-gold-500 text-white rounded-lg hover:bg-gold-600 transition disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                Add Room
              </button>
            </div>
          </div>
        </div>

        {/* Add Room Form */}
        {showAddForm && selectedHouseTypeId && (
          <div className="p-6 border-b border-gray-200 bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Room</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Quick Select Room Type</label>
              <div className="flex flex-wrap gap-2">
                {ROOM_TEMPLATES.map((template) => (
                  <button
                    key={template.room_key}
                    onClick={() => selectRoomTemplate(template)}
                    className={`px-3 py-1.5 text-xs rounded-full border transition ${
                      newRoom.room_key === template.room_key
                        ? 'bg-gold-500 text-white border-gold-500'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-gold-300'
                    }`}
                  >
                    {template.room_name}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Room Name *</label>
                <input
                  type="text"
                  value={newRoom.room_name}
                  onChange={(e) => setNewRoom({ ...newRoom, room_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="e.g., Living Room"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Room Key *</label>
                <input
                  type="text"
                  value={newRoom.room_key}
                  onChange={(e) => setNewRoom({ ...newRoom, room_key: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="e.g., living_room"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Floor</label>
                <select
                  value={newRoom.floor}
                  onChange={(e) => setNewRoom({ ...newRoom, floor: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="Ground">Ground Floor</option>
                  <option value="First">First Floor</option>
                  <option value="Second">Second Floor</option>
                  <option value="Basement">Basement</option>
                  <option value="Attic">Attic</option>
                  <option value="External">External</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ceiling Height (m)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newRoom.ceiling_height_m}
                  onChange={(e) => setNewRoom({ ...newRoom, ceiling_height_m: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="e.g., 2.4"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Length (m)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newRoom.length_m}
                  onChange={(e) => setNewRoom({ ...newRoom, length_m: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="e.g., 5.2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Width (m)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newRoom.width_m}
                  onChange={(e) => setNewRoom({ ...newRoom, width_m: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="e.g., 3.8"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Area (m²) {newRoom.length_m && newRoom.width_m && <span className="text-gray-400">≈ {(parseFloat(newRoom.length_m) * parseFloat(newRoom.width_m)).toFixed(1)}</span>}</label>
                <input
                  type="number"
                  step="0.01"
                  value={newRoom.area_sqm || (newRoom.length_m && newRoom.width_m ? (parseFloat(newRoom.length_m) * parseFloat(newRoom.width_m)).toFixed(2) : '')}
                  onChange={(e) => setNewRoom({ ...newRoom, area_sqm: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="e.g., 19.76"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
              <input
                type="text"
                value={newRoom.notes}
                onChange={(e) => setNewRoom({ ...newRoom, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="e.g., Includes bay window area"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleAddRoom}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                Add Room
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* House Types & Dimensions List */}
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : houseTypes.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No house types found. Please add house types to this development first.
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {houseTypes
              .filter(ht => !selectedHouseTypeId || ht.id === selectedHouseTypeId)
              .map((houseType) => {
                const htDimensions = getDimensionsByHouseType(houseType.id);
                const isExpanded = expandedHouseTypes.has(houseType.id);
                const verifiedCount = htDimensions.filter(d => d.verified).length;

                return (
                  <div key={houseType.id} className="bg-white">
                    {/* House Type Header */}
                    <div
                      className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition"
                      onClick={() => toggleHouseType(houseType.id)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-gold-100 flex items-center justify-center">
                          <Home className="w-5 h-5 text-gold-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{houseType.house_type_code}</h3>
                          <p className="text-sm text-gray-500">
                            {htDimensions.length} rooms • {verifiedCount} verified
                            {houseType.total_floor_area_sqm && ` • ${houseType.total_floor_area_sqm}m² total`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {htDimensions.length > 0 && (
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            verifiedCount === htDimensions.length
                              ? 'bg-green-100 text-green-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {verifiedCount === htDimensions.length ? 'All Verified' : 'Needs Review'}
                          </span>
                        )}
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>

                    {/* Expanded Room List */}
                    {isExpanded && (
                      <div className="px-4 pb-4">
                        {htDimensions.length === 0 ? (
                          <div className="p-6 bg-gray-50 rounded-lg text-center">
                            <Ruler className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                            <p className="text-gray-600 mb-3">No room dimensions added yet</p>
                            <button
                              onClick={() => {
                                setSelectedHouseTypeId(houseType.id);
                                setShowAddForm(true);
                              }}
                              className="px-4 py-2 bg-gold-500 text-white rounded-lg hover:bg-gold-600 text-sm"
                            >
                              Add First Room
                            </button>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Room</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Floor</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Dimensions</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Area</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {htDimensions.map((dim) => (
                                  <tr key={dim.id} className={`hover:bg-gray-50 ${dim.verified ? '' : 'bg-amber-50/50'}`}>
                                    <td className="px-4 py-3">
                                      {editingId === dim.id ? (
                                        <input
                                          type="text"
                                          value={editForm.room_name || ''}
                                          onChange={(e) => setEditForm({ ...editForm, room_name: e.target.value })}
                                          className="w-32 px-2 py-1 border rounded text-sm"
                                        />
                                      ) : (
                                        <span className="font-medium text-gray-900">{dim.room_name}</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-600">{dim.floor || '-'}</td>
                                    <td className="px-4 py-3">
                                      {editingId === dim.id ? (
                                        <div className="flex gap-1 items-center">
                                          <input
                                            type="number"
                                            step="0.01"
                                            value={editForm.length_m || ''}
                                            onChange={(e) => setEditForm({ ...editForm, length_m: parseFloat(e.target.value) || null })}
                                            className="w-16 px-2 py-1 border rounded text-sm"
                                          />
                                          <span>×</span>
                                          <input
                                            type="number"
                                            step="0.01"
                                            value={editForm.width_m || ''}
                                            onChange={(e) => setEditForm({ ...editForm, width_m: parseFloat(e.target.value) || null })}
                                            className="w-16 px-2 py-1 border rounded text-sm"
                                          />
                                        </div>
                                      ) : (
                                        <span className="text-sm text-gray-900">
                                          {dim.length_m && dim.width_m
                                            ? `${Number(dim.length_m).toFixed(2)}m × ${Number(dim.width_m).toFixed(2)}m`
                                            : '-'}
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3">
                                      {editingId === dim.id ? (
                                        <input
                                          type="number"
                                          step="0.01"
                                          value={editForm.area_sqm || ''}
                                          onChange={(e) => setEditForm({ ...editForm, area_sqm: e.target.value })}
                                          className="w-20 px-2 py-1 border rounded text-sm"
                                        />
                                      ) : (
                                        <span className="text-sm font-medium text-gray-900">
                                          {dim.area_sqm ? `${parseFloat(dim.area_sqm).toFixed(1)} m²` : '-'}
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3">
                                      {dim.verified ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                                          <CheckCircle className="w-3 h-3" />
                                          Verified
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
                                          <AlertTriangle className="w-3 h-3" />
                                          Pending
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex gap-2">
                                        {editingId === dim.id ? (
                                          <>
                                            <button onClick={saveEdit} className="text-green-600 hover:text-green-800 text-sm">Save</button>
                                            <button onClick={() => { setEditingId(null); setEditForm({}); }} className="text-gray-600 hover:text-gray-800 text-sm">Cancel</button>
                                          </>
                                        ) : (
                                          <>
                                            <button onClick={() => startEdit(dim)} className="text-blue-600 hover:text-blue-800 text-sm">Edit</button>
                                            <button
                                              onClick={() => handleVerify(dim.id, !dim.verified)}
                                              className={`text-sm ${dim.verified ? 'text-gray-600' : 'text-green-600'}`}
                                            >
                                              {dim.verified ? 'Unverify' : 'Verify'}
                                            </button>
                                            <button onClick={() => handleDelete(dim.id)} className="text-red-600 hover:text-red-800 text-sm">Delete</button>
                                          </>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Add room button for this house type */}
                        {htDimensions.length > 0 && (
                          <div className="mt-3 flex gap-2">
                            <button
                              onClick={() => {
                                setSelectedHouseTypeId(houseType.id);
                                setShowAddForm(true);
                              }}
                              className="text-sm text-gold-600 hover:text-gold-700 flex items-center gap-1"
                            >
                              <Plus className="w-4 h-4" />
                              Add Room
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Disclaimer Preview */}
      {settings.show_disclaimer && (
        <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-900">Disclaimer shown to homeowners:</p>
              <p className="text-sm text-amber-700 mt-1 italic">"{settings.disclaimer_text}"</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
