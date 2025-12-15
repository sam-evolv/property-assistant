'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Pencil, Trash2, FileText, X, Loader2, Upload, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface UnitType {
  id: string;
  name: string;
  floor_plan_pdf_url: string | null;
  specification_json: Record<string, any> | null;
  created_at: string;
}

interface Project {
  id: string;
  name: string;
}

interface UnitTypesClientProps {
  projectId: string;
}

export function UnitTypesClient({ projectId }: UnitTypesClientProps) {
  const [unitTypes, setUnitTypes] = useState<UnitType[]>([]);
  const [unitsCount, setUnitsCount] = useState<number | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingType, setEditingType] = useState<UnitType | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    floor_plan_pdf_url: '',
    specification_json: '',
  });

  useEffect(() => {
    fetchData();
  }, [projectId]);

  async function fetchData() {
    setIsLoading(true);
    try {
      const [typesRes, projectRes, statusRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/unit-types`),
        fetch(`/api/developments/${projectId}`),
        fetch(`/api/projects/${projectId}/status`),
      ]);

      if (typesRes.ok) {
        const typesData = await typesRes.json();
        setUnitTypes(typesData.unitTypes || []);
      }

      if (projectRes.ok) {
        const projectData = await projectRes.json();
        setProject({
          id: projectData.development?.id || projectId,
          name: projectData.development?.name || 'Project',
        });
      }

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setUnitsCount(statusData.unitsCount || 0);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }

  function openCreateModal() {
    setEditingType(null);
    setFormData({ name: '', floor_plan_pdf_url: '', specification_json: '' });
    setShowModal(true);
  }

  function openEditModal(unitType: UnitType) {
    setEditingType(unitType);
    setFormData({
      name: unitType.name,
      floor_plan_pdf_url: unitType.floor_plan_pdf_url || '',
      specification_json: unitType.specification_json
        ? JSON.stringify(unitType.specification_json, null, 2)
        : '',
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);

    try {
      let specJson = null;
      if (formData.specification_json.trim()) {
        try {
          specJson = JSON.parse(formData.specification_json);
        } catch {
          toast.error('Invalid JSON in specification');
          setIsSaving(false);
          return;
        }
      }

      const payload = {
        name: formData.name,
        floor_plan_pdf_url: formData.floor_plan_pdf_url || null,
        specification_json: specJson,
      };

      let response;
      if (editingType) {
        response = await fetch(
          `/api/projects/${projectId}/unit-types/${editingType.id}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }
        );
      } else {
        response = await fetch(`/api/projects/${projectId}/unit-types`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save');
      }

      toast.success(editingType ? 'Unit type updated' : 'Unit type created');
      setShowModal(false);
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(unitType: UnitType) {
    if (!confirm(`Delete unit type "${unitType.name}"? This cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(
        `/api/projects/${projectId}/unit-types/${unitType.id}`,
        { method: 'DELETE' }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete');
      }

      toast.success('Unit type deleted');
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete');
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-gold-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/super/developments"
            className="p-2 hover:bg-grey-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-grey-900">Unit Types</h1>
            <p className="text-grey-600">{project?.name || 'Project'}</p>
          </div>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 border border-gold-500 text-gold-600 hover:bg-gold-50 rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Unit Type
        </button>
      </div>

      {unitTypes.length > 0 && unitsCount !== null && unitsCount === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-amber-800 mb-2">Setup Required</h3>
              <p className="text-amber-700 text-sm mb-4">
                Units have not been uploaded for this project. Upload an Excel file to complete setup.
              </p>
              <Link
                href={`/super/projects/${projectId}/import-units`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium"
              >
                <Upload className="w-4 h-4" />
                Upload Excel
              </Link>
            </div>
          </div>
        </div>
      )}

      {unitTypes.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-grey-200">
          <Upload className="w-12 h-12 text-grey-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-grey-900 mb-2">
            No units yet
          </h3>
          <p className="text-grey-600 mb-6 max-w-md mx-auto">
            This project has no units yet. Upload an Excel file to create units in bulk, or add unit types manually.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href={`/super/projects/${projectId}/import-units`}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold-500 hover:bg-gold-600 text-white rounded-lg font-medium transition-colors"
            >
              <Upload className="w-4 h-4" />
              Upload Units via Excel
            </Link>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 border border-grey-300 text-grey-700 hover:bg-grey-50 rounded-lg font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Unit Type Manually
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-grey-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-grey-50 border-b border-grey-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-grey-700">
                  Name
                </th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-grey-700">
                  Floor Plan
                </th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-grey-700">
                  Specifications
                </th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-grey-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-grey-100">
              {unitTypes.map((unitType) => (
                <tr key={unitType.id} className="hover:bg-grey-50">
                  <td className="px-4 py-3">
                    <span className="font-medium text-grey-900">
                      {unitType.name}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {unitType.floor_plan_pdf_url ? (
                      <a
                        href={unitType.floor_plan_pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gold-600 hover:text-gold-700 text-sm flex items-center gap-1"
                      >
                        <FileText className="w-4 h-4" />
                        View PDF
                      </a>
                    ) : (
                      <span className="text-grey-400 text-sm">Not set</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {unitType.specification_json ? (
                      <span className="text-sm text-grey-600">
                        {Object.keys(unitType.specification_json).length} fields
                      </span>
                    ) : (
                      <span className="text-grey-400 text-sm">None</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(unitType)}
                        className="p-2 hover:bg-grey-100 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4 text-grey-600" />
                      </button>
                      <button
                        onClick={() => handleDelete(unitType)}
                        className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-grey-200">
              <h2 className="text-lg font-semibold text-grey-900">
                {editingType ? 'Edit Unit Type' : 'Add Unit Type'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-grey-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-grey-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-grey-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-gold-500"
                  placeholder="e.g., BD01, Apartment A"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-grey-700 mb-1">
                  Floor Plan PDF URL
                </label>
                <input
                  type="url"
                  value={formData.floor_plan_pdf_url}
                  onChange={(e) =>
                    setFormData({ ...formData, floor_plan_pdf_url: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-grey-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-gold-500"
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-grey-700 mb-1">
                  Specifications (JSON)
                </label>
                <textarea
                  value={formData.specification_json}
                  onChange={(e) =>
                    setFormData({ ...formData, specification_json: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-grey-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-gold-500 font-mono text-sm"
                  rows={4}
                  placeholder='{"bedrooms": 3, "bathrooms": 2}'
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-grey-300 text-grey-700 rounded-lg hover:bg-grey-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-gold-500 hover:bg-gold-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingType ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
