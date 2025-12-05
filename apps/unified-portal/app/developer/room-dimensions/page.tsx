'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

interface Development {
  id: string;
  name: string;
}

interface HouseType {
  id: string;
  house_type_code: string;
  development_id: string;
}

interface RoomDimension {
  id: string;
  tenant_id: string;
  development_id: string;
  house_type_id: string;
  unit_id: string | null;
  unit_type_code: string;
  room_name: string;
  room_key: string;
  floor: string | null;
  length_m: number | null;
  width_m: number | null;
  area_sqm: string | null;
  ceiling_height_m: string | null;
  source: string;
  verified: boolean;
  confidence: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  development_name: string | null;
  house_type_code: string | null;
  unit_number: string | null;
}

interface Stats {
  total: number;
  verified: number;
  unverified: number;
}

type FilterTab = 'all' | 'verified' | 'unverified';

export default function RoomDimensionsPage() {
  const [dimensions, setDimensions] = useState<RoomDimension[]>([]);
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [houseTypes, setHouseTypes] = useState<HouseType[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, verified: 0, unverified: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedDevelopmentId, setSelectedDevelopmentId] = useState<string>('');
  const [selectedHouseTypeId, setSelectedHouseTypeId] = useState<string>('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<RoomDimension>>({});

  useEffect(() => {
    fetchDevelopments();
  }, []);

  useEffect(() => {
    if (selectedDevelopmentId) {
      fetchHouseTypes(selectedDevelopmentId);
      fetchDimensions();
    }
  }, [selectedDevelopmentId]);

  useEffect(() => {
    fetchDimensions();
  }, [selectedHouseTypeId, filterTab]);

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
      const res = await fetch(`/api/developments/${developmentId}/houses`);
      if (res.ok) {
        const data = await res.json();
        setHouseTypes(data.houseTypes || []);
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
      if (filterTab === 'verified') {
        params.set('verified_only', 'true');
      }

      const res = await fetch(`/api/admin/room-dimensions?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        let dims = data.dimensions || [];
        
        if (filterTab === 'unverified') {
          dims = dims.filter((d: RoomDimension) => !d.verified);
        }
        
        setDimensions(dims);
        setStats(data.stats || { total: 0, verified: 0, unverified: 0 });
      }
    } catch (error) {
      console.error('Failed to fetch dimensions:', error);
      toast.error('Failed to load room dimensions');
    } finally {
      setLoading(false);
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
        toast.success(verified ? 'Dimension verified' : 'Verification removed');
        fetchDimensions();
      } else {
        throw new Error('Failed to update');
      }
    } catch (error) {
      console.error('Failed to verify:', error);
      toast.error('Failed to update verification status');
    }
  };

  const handleBatchVerify = async (verified: boolean) => {
    if (selectedIds.size === 0) {
      toast.error('No items selected');
      return;
    }

    try {
      const res = await fetch('/api/admin/room-dimensions/batch-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          verified,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`${data.updated_count} dimensions ${verified ? 'verified' : 'unverified'}`);
        setSelectedIds(new Set());
        fetchDimensions();
      } else {
        throw new Error('Failed to batch update');
      }
    } catch (error) {
      console.error('Failed to batch verify:', error);
      toast.error('Failed to batch update');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this dimension?')) return;

    try {
      const res = await fetch(`/api/admin/room-dimensions?id=${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.success('Dimension deleted');
        fetchDimensions();
      } else {
        throw new Error('Failed to delete');
      }
    } catch (error) {
      console.error('Failed to delete:', error);
      toast.error('Failed to delete dimension');
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
        toast.success('Dimension updated');
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

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === dimensions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(dimensions.map(d => d.id)));
    }
  };

  const getSourceBadgeColor = (source: string) => {
    switch (source) {
      case 'verified_unit':
      case 'verified_house_type':
        return 'bg-green-100 text-green-800';
      case 'vision_floorplan':
        return 'bg-blue-100 text-blue-800';
      case 'intelligence_profile':
        return 'bg-purple-100 text-purple-800';
      case 'house_types':
        return 'bg-gray-100 text-gray-800';
      case 'manual':
        return 'bg-amber-100 text-amber-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatSource = (source: string) => {
    switch (source) {
      case 'verified_unit': return 'Verified Unit';
      case 'verified_house_type': return 'Verified House Type';
      case 'vision_floorplan': return 'Vision Extraction';
      case 'intelligence_profile': return 'Intelligence Profile';
      case 'house_types': return 'House Types';
      case 'manual': return 'Manual Entry';
      default: return source;
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Room Dimensions</h1>
        <p className="text-gray-600 mt-1">
          Verify and manage room dimension data extracted from floor plans
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="p-4 border-b border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-sm text-gray-600">Total Dimensions</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{stats.verified}</div>
              <div className="text-sm text-gray-600">Verified</div>
            </div>
            <div className="text-center p-3 bg-amber-50 rounded-lg">
              <div className="text-2xl font-bold text-amber-600">{stats.unverified}</div>
              <div className="text-sm text-gray-600">Pending Verification</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex gap-4">
              <select
                value={selectedDevelopmentId}
                onChange={(e) => {
                  setSelectedDevelopmentId(e.target.value);
                  setSelectedHouseTypeId('');
                }}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="">All Developments</option>
                {developments.map((dev) => (
                  <option key={dev.id} value={dev.id}>{dev.name}</option>
                ))}
              </select>

              <select
                value={selectedHouseTypeId}
                onChange={(e) => setSelectedHouseTypeId(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
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
                onClick={() => setFilterTab('all')}
                className={`px-4 py-2 text-sm rounded-md ${
                  filterTab === 'all'
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterTab('verified')}
                className={`px-4 py-2 text-sm rounded-md ${
                  filterTab === 'verified'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Verified
              </button>
              <button
                onClick={() => setFilterTab('unverified')}
                className={`px-4 py-2 text-sm rounded-md ${
                  filterTab === 'unverified'
                    ? 'bg-amber-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Pending
              </button>
            </div>
          </div>

          {selectedIds.size > 0 && (
            <div className="mt-4 flex items-center gap-4 p-3 bg-blue-50 rounded-lg">
              <span className="text-sm text-blue-800">
                {selectedIds.size} item{selectedIds.size > 1 ? 's' : ''} selected
              </span>
              <button
                onClick={() => handleBatchVerify(true)}
                className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
              >
                Verify Selected
              </button>
              <button
                onClick={() => handleBatchVerify(false)}
                className="px-3 py-1.5 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700"
              >
                Unverify Selected
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="px-3 py-1.5 text-gray-600 text-sm hover:text-gray-800"
              >
                Clear Selection
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : dimensions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No room dimensions found. Upload floor plan documents to extract dimensions.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === dimensions.length && dimensions.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Room</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">House Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Floor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dimensions</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Area</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {dimensions.map((dim) => (
                  <tr key={dim.id} className={`hover:bg-gray-50 ${dim.verified ? 'bg-green-50/30' : ''}`}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(dim.id)}
                        onChange={() => toggleSelect(dim.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-4 py-3">
                      {editingId === dim.id ? (
                        <input
                          type="text"
                          value={editForm.room_name || ''}
                          onChange={(e) => setEditForm({ ...editForm, room_name: e.target.value })}
                          className="w-32 px-2 py-1 border rounded text-sm"
                        />
                      ) : (
                        <div>
                          <div className="font-medium text-gray-900">{dim.room_name}</div>
                          <div className="text-xs text-gray-500">{dim.room_key}</div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900">{dim.house_type_code || dim.unit_type_code}</div>
                      {dim.unit_number && (
                        <div className="text-xs text-gray-500">Unit {dim.unit_number}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingId === dim.id ? (
                        <input
                          type="text"
                          value={editForm.floor || ''}
                          onChange={(e) => setEditForm({ ...editForm, floor: e.target.value })}
                          className="w-20 px-2 py-1 border rounded text-sm"
                        />
                      ) : (
                        <span className="text-sm text-gray-600">{dim.floor || '-'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingId === dim.id ? (
                        <div className="flex gap-1 items-center">
                          <input
                            type="number"
                            step="0.1"
                            value={editForm.length_m || ''}
                            onChange={(e) => setEditForm({ ...editForm, length_m: parseFloat(e.target.value) || null })}
                            className="w-16 px-2 py-1 border rounded text-sm"
                            placeholder="L"
                          />
                          <span>×</span>
                          <input
                            type="number"
                            step="0.1"
                            value={editForm.width_m || ''}
                            onChange={(e) => setEditForm({ ...editForm, width_m: parseFloat(e.target.value) || null })}
                            className="w-16 px-2 py-1 border rounded text-sm"
                            placeholder="W"
                          />
                        </div>
                      ) : (
                        <span className="text-sm text-gray-900">
                          {dim.length_m && dim.width_m 
                            ? `${dim.length_m.toFixed(1)}m × ${dim.width_m.toFixed(1)}m`
                            : '-'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingId === dim.id ? (
                        <input
                          type="number"
                          step="0.1"
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
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getSourceBadgeColor(dim.source)}`}>
                        {formatSource(dim.source)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {dim.verified ? (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-800">
                          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {editingId === dim.id ? (
                          <>
                            <button
                              onClick={saveEdit}
                              className="text-green-600 hover:text-green-800 text-sm"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => { setEditingId(null); setEditForm({}); }}
                              className="text-gray-600 hover:text-gray-800 text-sm"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(dim)}
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleVerify(dim.id, !dim.verified)}
                              className={`text-sm ${dim.verified ? 'text-gray-600 hover:text-gray-800' : 'text-green-600 hover:text-green-800'}`}
                            >
                              {dim.verified ? 'Unverify' : 'Verify'}
                            </button>
                            <button
                              onClick={() => handleDelete(dim.id)}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              Delete
                            </button>
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
      </div>
    </div>
  );
}
