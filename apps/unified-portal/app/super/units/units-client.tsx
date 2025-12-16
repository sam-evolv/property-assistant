'use client';

import { useEffect, useState, useRef } from 'react';
import { Home, AlertTriangle, CheckCircle, User, Copy, ChevronDown, ChevronUp, Database, Upload, FileSpreadsheet, Loader2, X, QrCode, Download } from 'lucide-react';
import { InsightCard } from '@/components/admin-enterprise/InsightCard';
import { SectionHeader } from '@/components/admin-enterprise/SectionHeader';
import { TableSkeleton } from '@/components/admin-enterprise/LoadingSkeleton';
import { DataTable, Column } from '@/components/admin-enterprise/DataTable';
import { useProjectContext } from '@/contexts/ProjectContext';
import toast from 'react-hot-toast';

interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

interface Unit {
  id: string;
  address: string;
  unit_type_name: string;
  project_name: string;
  project_address: string;
  purchaser_name: string | null;
  user_id: string | null;
  handover_date: string | null;
  has_snag_list: boolean;
  created_at: string;
}

function naturalSort(a: string, b: string): number {
  const aMatch = a.match(/^(\d+)(.*)$/);
  const bMatch = b.match(/^(\d+)(.*)$/);
  
  if (aMatch && bMatch) {
    const aNum = parseInt(aMatch[1], 10);
    const bNum = parseInt(bMatch[1], 10);
    if (aNum !== bNum) return aNum - bNum;
    return (aMatch[2] || '').localeCompare(bMatch[2] || '');
  }
  
  if (aMatch) return -1;
  if (bMatch) return 1;
  
  return a.localeCompare(b);
}

export function UnitsExplorer() {
  const { selectedProjectId, selectedProject, projects, isLoading: projectsLoading } = useProjectContext();
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'with_purchaser' | 'unassigned'>('all');
  const [showVerifySQL, setShowVerifySQL] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const [showImportModal, setShowImportModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDownloadingQR, setIsDownloadingQR] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProjectId) return;

    setIsUploading(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/projects/${selectedProjectId}/smart-import`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Import failed');
      }

      setImportResult(data);
      
      if (data.errors && data.errors.length > 0) {
        toast.error(`Import had ${data.errors.length} error(s) - check details`);
      } else if (data.created > 0 || data.updated > 0) {
        toast.success(`${data.created} created, ${data.updated} updated`);
      } else {
        toast.success('No changes needed - all units already up to date');
      }
      
      if (data.created > 0 || data.updated > 0) {
        const fetchRes = await fetch(`/api/super/units?projectId=${selectedProjectId}`);
        if (fetchRes.ok) {
          const fetchData = await fetchRes.json();
          const sortedUnits = [...(fetchData.units || [])].sort((a: Unit, b: Unit) => {
            const addrCompare = naturalSort(a.address, b.address);
            if (addrCompare !== 0) return addrCompare;
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          });
          setUnits(sortedUnits);
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Import failed');
      setImportResult({ created: 0, updated: 0, skipped: 0, errors: [err.message] });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  useEffect(() => {
    if (projectsLoading) return;

    async function fetchUnits() {
      setLoading(true);
      setError(null);

      try {
        if (selectedProjectId) {
          const url = `/api/super/units?projectId=${selectedProjectId}`;
          console.log('[UnitsExplorer] Fetching Supabase units:', url);

          const res = await fetch(url);
          if (!res.ok) throw new Error('Failed to fetch units');
          const data = await res.json();

          console.log('[UnitsExplorer] Received:', data.count, 'Supabase units for projectId:', data.projectId);
          const sortedUnits = [...(data.units || [])].sort((a: Unit, b: Unit) => {
            const addrCompare = naturalSort(a.address, b.address);
            if (addrCompare !== 0) return addrCompare;
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          });
          setUnits(sortedUnits);
        } else {
          const url = '/api/admin/units';
          console.log('[UnitsExplorer] Fetching Drizzle units (All Schemes):', url);

          const res = await fetch(url);
          if (!res.ok) throw new Error('Failed to fetch units');
          const data = await res.json();

          const mappedUnits = (data.units || []).map((u: any) => ({
            id: u.id,
            address: u.address || u.unit_number || '',
            unit_type_name: u.house_type_code || 'Unknown',
            project_name: u.development_name || 'Unknown',
            project_address: '',
            purchaser_name: u.purchaser_name || null,
            user_id: null,
            handover_date: null,
            has_snag_list: false,
            created_at: new Date().toISOString(),
          }));

          console.log('[UnitsExplorer] Received:', mappedUnits.length, 'Drizzle units');
          setUnits(mappedUnits);
        }
      } catch (err: any) {
        console.error('[UnitsExplorer] Error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchUnits();
  }, [selectedProjectId, projectsLoading]);

  const handleCopyProjectId = async () => {
    if (!selectedProjectId) return;
    try {
      await navigator.clipboard.writeText(selectedProjectId);
      setCopied(true);
      toast.success('Project ID copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleDownloadQRPack = async () => {
    if (!selectedProjectId) return;
    
    setIsDownloadingQR(true);
    try {
      const res = await fetch(`/api/admin/qr-pack?projectId=${selectedProjectId}`);
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to generate QR pack');
      }
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedProject?.name?.toLowerCase().replace(/\s+/g, '-') || 'project'}-qr-pack.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast.success('QR Pack downloaded successfully');
    } catch (err: any) {
      console.error('[UnitsExplorer] QR Pack error:', err);
      toast.error(err.message || 'Failed to download QR pack');
    } finally {
      setIsDownloadingQR(false);
    }
  };

  const unitsSql = selectedProjectId
    ? `SELECT id, project_id, address, unit_type_id, created_at
FROM public.units
WHERE project_id = '${selectedProjectId}'
ORDER BY created_at DESC;`
    : '';

  const unitTypesSql = selectedProjectId
    ? `SELECT id, project_id, name, created_at
FROM public.unit_types
WHERE project_id = '${selectedProjectId}'
ORDER BY created_at DESC;`
    : '';

  const unitCountsSql = `SELECT project_id, count(*) as unit_count
FROM public.units
GROUP BY project_id
ORDER BY unit_count DESC;`;

  if (loading || projectsLoading) {
    return (
      <div className="p-8 bg-gray-50 min-h-screen">
        <SectionHeader title="Units Explorer" description="Loading..." />
        <TableSkeleton rows={10} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-gray-50 min-h-screen">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-600 font-medium">Failed to load units</p>
          <p className="text-red-500 text-sm mt-2">{error}</p>
        </div>
      </div>
    );
  }

  const filteredUnits = units.filter((u) => {
    if (filter === 'with_purchaser') return u.purchaser_name !== null;
    if (filter === 'unassigned') return u.purchaser_name === null;
    return true;
  });

  const withPurchaserCount = units.filter((u) => u.purchaser_name !== null).length;
  const withHandoverCount = units.filter((u) => u.handover_date !== null).length;
  const withSnagListCount = units.filter((u) => u.has_snag_list).length;

  const columns: Column<Unit>[] = [
    {
      key: 'address',
      label: 'Unit',
      sortable: true,
      render: (item) => (
        <div>
          <p className="font-semibold text-gray-900">{item.address}</p>
          <p className="text-xs text-gray-500">{item.unit_type_name}</p>
        </div>
      ),
    },
    {
      key: 'project_name',
      label: 'Project',
      sortable: true,
      render: (item) => (
        <div>
          <p className="text-gray-700">{item.project_name}</p>
          <p className="text-xs text-gray-400">{item.project_address}</p>
        </div>
      ),
    },
    {
      key: 'purchaser_name',
      label: 'Purchaser',
      sortable: false,
      render: (item) =>
        item.purchaser_name ? (
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-green-600" />
            <p className="text-sm font-medium text-gray-900">{item.purchaser_name}</p>
          </div>
        ) : (
          <span className="text-gray-400 text-sm">Unassigned</span>
        ),
    },
    {
      key: 'handover_date',
      label: 'Handover',
      sortable: true,
      render: (item) =>
        item.handover_date ? (
          <span className="text-gray-700 text-sm">
            {new Date(item.handover_date).toLocaleDateString()}
          </span>
        ) : (
          <span className="text-gray-400 text-sm">Not set</span>
        ),
    },
    {
      key: 'has_snag_list',
      label: 'Snag List',
      sortable: false,
      render: (item) =>
        item.has_snag_list ? (
          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium flex items-center gap-1 w-fit">
            <CheckCircle className="w-3 h-3" />
            Yes
          </span>
        ) : (
          <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-medium w-fit">
            No
          </span>
        ),
    },
    {
      key: 'created_at',
      label: 'Created',
      sortable: true,
      render: (item) => (
        <span className="text-gray-500 text-sm">
          {new Date(item.created_at).toLocaleDateString()}
        </span>
      ),
    },
  ];

  const scopeLabel = selectedProject ? selectedProject.name : 'All Projects';

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <SectionHeader
        title="Units Explorer"
        description={`Viewing ${units.length} units in ${scopeLabel}`}
      />

      {selectedProjectId && selectedProject && (
        <div className="mb-6 bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-sm text-gray-500">Selected Project</p>
              <p className="font-semibold text-gray-900">{selectedProject.name}</p>
              {selectedProject.address && (
                <p className="text-sm text-gray-500">{selectedProject.address}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setShowImportModal(true); setImportResult(null); }}
                className="flex items-center gap-2 px-4 py-2 bg-gold-500 text-white rounded-lg hover:bg-gold-600 transition-colors font-medium"
              >
                <Upload className="w-4 h-4" />
                Import/Update Units
              </button>
              <button
                onClick={handleDownloadQRPack}
                disabled={isDownloadingQR || units.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                title="Generates a multi-page PDF with one QR page per unit"
              >
                {isDownloadingQR ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <QrCode className="w-4 h-4" />
                )}
                {isDownloadingQR ? 'Generating...' : 'Download QR Pack'}
              </button>
              <div className="text-right">
                <p className="text-xs text-gray-400">Project ID</p>
                <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                  {selectedProjectId}
                </code>
              </div>
              <button
                onClick={handleCopyProjectId}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Copy Project ID"
              >
                <Copy className={`w-4 h-4 ${copied ? 'text-green-500' : 'text-gray-400'}`} />
              </button>
            </div>
          </div>

          <button
            onClick={() => setShowVerifySQL(!showVerifySQL)}
            className="mt-3 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800"
          >
            <Database className="w-4 h-4" />
            Verify in Supabase
            {showVerifySQL ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showVerifySQL && (
            <div className="mt-3 space-y-3">
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1">Units Query:</p>
                <pre className="text-xs bg-gray-900 text-green-400 p-3 rounded overflow-x-auto">
                  {unitsSql}
                </pre>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1">Unit Types Query:</p>
                <pre className="text-xs bg-gray-900 text-green-400 p-3 rounded overflow-x-auto">
                  {unitTypesSql}
                </pre>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1">Unit Counts by Project:</p>
                <pre className="text-xs bg-gray-900 text-green-400 p-3 rounded overflow-x-auto">
                  {unitCountsSql}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <InsightCard
          title="Total Units"
          value={units.length}
          subtitle={scopeLabel}
          icon={<Home className="w-5 h-5" />}
        />
        <InsightCard
          title="With Purchaser"
          value={withPurchaserCount}
          subtitle={`${Math.round((withPurchaserCount / units.length) * 100) || 0}% assigned`}
          icon={<User className="w-5 h-5" />}
        />
        <InsightCard
          title="With Handover"
          value={withHandoverCount}
          subtitle={`${Math.round((withHandoverCount / units.length) * 100) || 0}% scheduled`}
          icon={<CheckCircle className="w-5 h-5" />}
        />
        <InsightCard
          title="Unassigned"
          value={units.length - withPurchaserCount}
          subtitle="Available"
          icon={<AlertTriangle className="w-5 h-5" />}
        />
      </div>

      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg transition-all duration-premium font-medium shadow-sm ${
            filter === 'all'
              ? 'bg-gold-500 text-white shadow-md'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gold-50 hover:border-gold-200'
          }`}
        >
          All Units ({units.length})
        </button>
        <button
          onClick={() => setFilter('with_purchaser')}
          className={`px-4 py-2 rounded-lg transition-all duration-premium font-medium flex items-center gap-2 shadow-sm ${
            filter === 'with_purchaser'
              ? 'bg-gold-600 text-white shadow-md'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gold-50 hover:border-gold-200'
          }`}
        >
          <User className="w-4 h-4" />
          With Purchaser ({withPurchaserCount})
        </button>
        <button
          onClick={() => setFilter('unassigned')}
          className={`px-4 py-2 rounded-lg transition-all duration-premium font-medium flex items-center gap-2 shadow-sm ${
            filter === 'unassigned'
              ? 'bg-amber-600 text-white shadow-md'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gold-50 hover:border-gold-200'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          Unassigned ({units.length - withPurchaserCount})
        </button>
      </div>

      <DataTable
        data={filteredUnits}
        columns={columns}
        searchable={true}
        searchPlaceholder="Search by unit address, type, project..."
        emptyMessage="No units found matching your filter"
      />

      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Import/Update Units</h2>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800 font-medium mb-2">Smart Import</p>
                <p className="text-sm text-blue-700">
                  Upload your Excel file and the system will automatically:
                </p>
                <ul className="text-sm text-blue-700 mt-2 space-y-1 list-disc list-inside">
                  <li>Create new units that don't exist yet</li>
                  <li>Update purchaser names for existing units</li>
                  <li>Skip units that are already up to date</li>
                </ul>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">Expected columns:</p>
                <div className="flex flex-wrap gap-2">
                  {['unit_number / address', 'unit_type / house_type', 'purchaser_name (optional)'].map((col) => (
                    <span key={col} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                      {col}
                    </span>
                  ))}
                </div>
              </div>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="unit-file-upload"
                  disabled={isUploading}
                />
                <label
                  htmlFor="unit-file-upload"
                  className={`cursor-pointer flex flex-col items-center ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isUploading ? (
                    <Loader2 className="w-10 h-10 text-gold-500 animate-spin mb-2" />
                  ) : (
                    <FileSpreadsheet className="w-10 h-10 text-gray-400 mb-2" />
                  )}
                  <p className="text-gray-700 font-medium">
                    {isUploading ? 'Processing...' : 'Click to upload Excel or CSV'}
                  </p>
                  <p className="text-gray-500 text-sm mt-1">
                    .xlsx, .xls, or .csv files
                  </p>
                </label>
              </div>

              {importResult && (
                <div className={`mt-4 p-4 rounded-lg ${importResult.errors.length > 0 ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                  {importResult.errors.length > 0 ? (
                    <div>
                      <p className="text-red-700 font-medium">Import had errors:</p>
                      <ul className="text-sm text-red-600 mt-1 list-disc list-inside">
                        {importResult.errors.slice(0, 5).map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div>
                      <p className="text-green-700 font-medium mb-2">Import Complete!</p>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="bg-white rounded p-2">
                          <p className="text-2xl font-bold text-green-600">{importResult.created}</p>
                          <p className="text-xs text-gray-600">Created</p>
                        </div>
                        <div className="bg-white rounded p-2">
                          <p className="text-2xl font-bold text-blue-600">{importResult.updated}</p>
                          <p className="text-xs text-gray-600">Updated</p>
                        </div>
                        <div className="bg-white rounded p-2">
                          <p className="text-2xl font-bold text-gray-500">{importResult.skipped}</p>
                          <p className="text-xs text-gray-600">Skipped</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
