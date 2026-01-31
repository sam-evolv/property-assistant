'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  Home,
  FileSpreadsheet,
  Settings,
  MapPin,
  Calendar,
  Users,
  FileText,
  Edit,
  Trash2,
  Upload,
  Download,
  CheckCircle,
  AlertCircle,
  Loader2,
  ChevronRight,
  Image as ImageIcon,
  Package,
  RefreshCw,
  X,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Development {
  id: string;
  name: string;
  code: string;
  address: string;
  description: string;
  is_active: boolean;
  created_at: string;
  logo_url?: string;
  sidebar_logo_url?: string;
  assistant_logo_url?: string;
  toolbar_logo_url?: string;
  tenant?: {
    id: string;
    name: string;
  };
  developer?: {
    id: string;
    email: string;
  };
  _count?: {
    units: number;
    homeowners: number;
    documents: number;
  };
}

interface Unit {
  id: string;
  unit_number: string;
  address: string;
  bedrooms: number;
  house_type_code: string;
  has_pipeline: boolean;
}

interface SheetInfo {
  name: string;
  rowCount: number;
}

interface ColumnMapping {
  spreadsheetColumn: string;
  mapsTo: string;
}

interface PreviewRow {
  address: string;
  status: string;
  price: string;
  purchaser: string;
  release_date: string;
  sale_agreed_date: string;
  queries_raised_date: string;
  deposit_date: string;
  contracts_issued_date: string;
  signed_contracts_date: string;
  counter_signed_date: string;
  snag_date: string;
  drawdown_date: string;
  handover_date: string;
  estimated_close_date: string;
  bedrooms: string;
  house_type_code: string;
  comments: string;
}

type TabType = 'overview' | 'units' | 'import' | 'settings';

const TABS: { id: TabType; label: string; icon: any }[] = [
  { id: 'overview', label: 'Overview', icon: Building2 },
  { id: 'units', label: 'Units', icon: Home },
  { id: 'import', label: 'Sales Pipeline Import', icon: FileSpreadsheet },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const STATUS_OPTIONS = [
  { value: '', label: 'Select...' },
  { value: 'unit_address', label: 'Unit Address' },
  { value: 'house_type_code', label: 'House Type Code' },
  { value: 'bedrooms', label: 'Bedrooms' },
  { value: 'sale_price', label: 'Sale Price' },
  { value: 'status', label: 'Status' },
  { value: 'purchaser_name', label: 'Purchaser Name' },
  { value: 'release_date', label: 'Release Date' },
  { value: 'deposit_date', label: 'Deposit Date' },
  { value: 'sale_agreed_date', label: 'Sale Agreed Date' },
  { value: 'contracts_issued_date', label: 'Contracts Issued Date' },
  { value: 'queries_raised_date', label: 'Queries Raised Date' },
  { value: 'queries_replied_date', label: 'Queries Replied Date' },
  { value: 'signed_contracts_date', label: 'Signed Contracts Date' },
  { value: 'counter_signed_date', label: 'Counter Signed Date' },
  { value: 'estimated_close_date', label: 'Estimated Close Date' },
  { value: 'snag_date', label: 'Snag Date' },
  { value: 'handover_date', label: 'Handover Date' },
  { value: 'drawdown_date', label: 'Drawdown Date' },
  { value: 'comments', label: 'Comments' },
  { value: 'housing_agency', label: 'Housing Agency' },
];

export default function DevelopmentDetailClient({
  developmentId,
}: {
  developmentId: string;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [development, setDevelopment] = useState<Development | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [unitsLoading, setUnitsLoading] = useState(false);

  const [importStep, setImportStep] = useState<'upload' | 'sheet' | 'mapping' | 'preview' | 'importing' | 'success'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [sheets, setSheets] = useState<SheetInfo[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [spreadsheetColumns, setSpreadsheetColumns] = useState<string[]>([]);
  const [columnMappings, setColumnMappings] = useState<Record<string, string>>({});
  const [previewData, setPreviewData] = useState<PreviewRow[]>([]);
  const [importProgress, setImportProgress] = useState({ units: 0, pipeline: 0, total: 0 });
  const [importResult, setImportResult] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractHandover, setExtractHandover] = useState(true);
  const [autoDrawdown, setAutoDrawdown] = useState(true);
  const [autoSnag, setAutoSnag] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingDevelopment, setEditingDevelopment] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', address: '', description: '' });
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const fetchDevelopment = useCallback(async () => {
    try {
      const res = await fetch(`/api/super/developments/${developmentId}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setDevelopment(data.development);
    } catch (err) {
      console.error('Error fetching development:', err);
    } finally {
      setLoading(false);
    }
  }, [developmentId]);

  const fetchUnits = useCallback(async () => {
    setUnitsLoading(true);
    try {
      const res = await fetch(`/api/super/developments/${developmentId}/units`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setUnits(data.units || []);
    } catch (err) {
      console.error('Error fetching units:', err);
    } finally {
      setUnitsLoading(false);
    }
  }, [developmentId]);

  useEffect(() => {
    fetchDevelopment();
  }, [fetchDevelopment]);

  useEffect(() => {
    if (activeTab === 'units') {
      fetchUnits();
    }
  }, [activeTab, fetchUnits]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const validateAndSetFile = (f: File) => {
    const name = f.name.toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
      alert('Please upload an Excel file (.xlsx, .xls)');
      return;
    }
    setFile(f);
    parseExcelFile(f);
  };

  const parseExcelFile = async (f: File) => {
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append('file', f);
      formData.append('action', 'parse');

      const res = await fetch(`/api/super/developments/${developmentId}/pipeline-import`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Failed to parse file');
      const data = await res.json();

      setSheets(data.sheets);
      if (data.sheets.length === 1) {
        setSelectedSheet(data.sheets[0].name);
        setSpreadsheetColumns(data.columns);
        autoMapColumns(data.columns);
        setImportStep('mapping');
      } else {
        const matchingSheet = data.sheets.find((s: SheetInfo) =>
          development?.name && s.name.toLowerCase().includes(development.name.toLowerCase().substring(0, 10))
        );
        if (matchingSheet) {
          setSelectedSheet(matchingSheet.name);
        }
        setImportStep('sheet');
      }
    } catch (err) {
      console.error('Error parsing file:', err);
      alert('Failed to parse Excel file');
    } finally {
      setIsProcessing(false);
    }
  };

  const selectSheet = async (sheetName: string) => {
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append('file', file!);
      formData.append('action', 'getColumns');
      formData.append('sheet', sheetName);

      const res = await fetch(`/api/super/developments/${developmentId}/pipeline-import`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Failed to get columns');
      const data = await res.json();

      setSpreadsheetColumns(data.columns);
      autoMapColumns(data.columns);
      setImportStep('mapping');
    } catch (err) {
      console.error('Error getting columns:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const autoMapColumns = (columns: string[]) => {
    const mappings: Record<string, string> = {};
    const lowerColumns = columns.map(c => c.toLowerCase());

    const autoMappings: Record<string, string[]> = {
      'unit_address': ['address', 'dwelling', 'unit', 'property address'],
      'house_type_code': ['property designation', 'type', 'house type', 'designation'],
      'bedrooms': ['bedrooms', 'beds', 'bed'],
      'sale_price': ['price', 'sale price', 'amount'],
      'status': ['status'],
      'purchaser_name': ['purchaser', 'buyer', 'name', 'purchaser information'],
      'release_date': ['release'],
      'deposit_date': ['deposit'],
      'sale_agreed_date': ['sale agreed', 'agreed', 'loan approved'],
      'contracts_issued_date': ['contract issue', 'contracts issued', 'issue'],
      'queries_raised_date': ['queries raised', 'raised'],
      'queries_replied_date': ['reply', 'replied', 'queries replied'],
      'signed_contracts_date': ['receipt of signed', 'signed contract'],
      'counter_signed_date': ['one part', 'counter signed', 'countersigned'],
      'estimated_close_date': ['projected handover', 'estimated close', 'projected'],
      'snag_date': ['snagging', 'snag'],
      'comments': ['comments', 'notes'],
      'housing_agency': ['housing body', 'agency', 'ahb'],
    };

    columns.forEach((col, idx) => {
      const lowerCol = col.toLowerCase();
      for (const [mapTo, keywords] of Object.entries(autoMappings)) {
        if (keywords.some(kw => lowerCol.includes(kw))) {
          mappings[col] = mapTo;
          break;
        }
      }
    });

    setColumnMappings(mappings);
  };

  const handlePreview = async () => {
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append('file', file!);
      formData.append('action', 'preview');
      formData.append('sheet', selectedSheet);
      formData.append('mappings', JSON.stringify(columnMappings));
      formData.append('options', JSON.stringify({ extractHandover, autoDrawdown, autoSnag }));

      const res = await fetch(`/api/super/developments/${developmentId}/pipeline-import`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Failed to preview');
      const data = await res.json();

      setPreviewData(data.rows);
      setImportStep('preview');
    } catch (err) {
      console.error('Error previewing:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    setImportStep('importing');
    setImportProgress({ units: 0, pipeline: 0, total: previewData.length });

    try {
      const formData = new FormData();
      formData.append('file', file!);
      formData.append('action', 'import');
      formData.append('sheet', selectedSheet);
      formData.append('mappings', JSON.stringify(columnMappings));
      formData.append('options', JSON.stringify({ extractHandover, autoDrawdown, autoSnag }));

      const res = await fetch(`/api/super/developments/${developmentId}/pipeline-import`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Failed to import');
      const data = await res.json();

      setImportResult(data);
      setImportStep('success');
    } catch (err) {
      console.error('Error importing:', err);
      alert('Import failed');
      setImportStep('preview');
    }
  };

  const resetImport = () => {
    setFile(null);
    setSheets([]);
    setSelectedSheet('');
    setSpreadsheetColumns([]);
    setColumnMappings({});
    setPreviewData([]);
    setImportResult(null);
    setImportStep('upload');
  };

  const handleEditDevelopment = async () => {
    try {
      const res = await fetch(`/api/super/developments/${developmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error('Failed to update');
      await fetchDevelopment();
      setEditingDevelopment(false);
    } catch (err) {
      console.error('Error updating development:', err);
      alert('Failed to update development');
    }
  };

  const handleDeleteDevelopment = async () => {
    try {
      const res = await fetch(`/api/super/developments/${developmentId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete');
      router.push('/super/developments');
    } catch (err) {
      console.error('Error deleting development:', err);
      alert('Failed to delete development');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-neutral-400 animate-spin" />
      </div>
    );
  }

  if (!development) {
    return (
      <div className="min-h-screen bg-white p-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-neutral-900">Development not found</h2>
          <button
            onClick={() => router.push('/super/developments')}
            className="mt-4 text-[#D4AF37] hover:underline"
          >
            Back to Developments
          </button>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto p-8">
        <button
          onClick={() => router.push('/super/developments')}
          className="flex items-center gap-2 text-neutral-600 hover:text-neutral-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Developments
        </button>

        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-4">
            {development.logo_url || development.toolbar_logo_url ? (
              <img
                src={development.toolbar_logo_url || development.logo_url}
                alt={development.name}
                className="w-16 h-16 rounded-xl object-cover border-2 border-neutral-200"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#D4AF37]/20 to-[#D4AF37]/10 flex items-center justify-center border-2 border-neutral-200">
                <Building2 className="w-8 h-8 text-[#D4AF37]" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">{development.name}</h1>
              <div className="flex items-center gap-3 text-sm text-neutral-600 mt-1">
                {development.address && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {development.address}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm text-neutral-500 mt-1">
                <span>Code: {development.code}</span>
                <span>Created: {formatDate(development.created_at)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setEditForm({
                  name: development.name,
                  address: development.address || '',
                  description: development.description || '',
                });
                setEditingDevelopment(true);
              }}
              className="flex items-center gap-2 px-4 py-2 border-2 border-neutral-200 rounded-lg text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              <Edit className="w-4 h-4" />
              Edit
            </button>
            <button
              onClick={() => setDeleteConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 border-2 border-red-200 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>

        <div className="border-b-2 border-neutral-200 mb-6">
          <nav className="flex gap-0">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 -mb-[2px] transition-colors',
                  activeTab === tab.id
                    ? 'border-[#D4AF37] text-[#D4AF37]'
                    : 'border-transparent text-neutral-500 hover:text-neutral-900'
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="bg-white border-2 border-neutral-200 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-neutral-900 mb-4">Development Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <span className="text-sm text-neutral-500">Name</span>
                    <p className="text-neutral-900 font-medium">{development.name}</p>
                  </div>
                  <div>
                    <span className="text-sm text-neutral-500">Code</span>
                    <p className="text-neutral-900 font-medium">{development.code}</p>
                  </div>
                  <div>
                    <span className="text-sm text-neutral-500">Address</span>
                    <p className="text-neutral-900 font-medium">{development.address || '—'}</p>
                  </div>
                  <div>
                    <span className="text-sm text-neutral-500">Description</span>
                    <p className="text-neutral-900">{development.description || '—'}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <span className="text-sm text-neutral-500">Tenant/Organisation</span>
                    <p className="text-neutral-900 font-medium">{development.tenant?.name || '—'}</p>
                  </div>
                  <div>
                    <span className="text-sm text-neutral-500">Assigned Developer</span>
                    <p className="text-neutral-900 font-medium">{development.developer?.email || '—'}</p>
                  </div>
                  <div>
                    <span className="text-sm text-neutral-500">Status</span>
                    <p className={cn('font-medium', development.is_active ? 'text-green-600' : 'text-neutral-500')}>
                      {development.is_active ? 'Active ✓' : 'Inactive'}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-neutral-500">Created</span>
                    <p className="text-neutral-900">{formatDate(development.created_at)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white border-2 border-neutral-200 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-neutral-900 mb-4">Branding Preview</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="border-2 border-neutral-200 rounded-lg p-4 text-center">
                  {development.toolbar_logo_url ? (
                    <img src={development.toolbar_logo_url} alt="Pre-Handover Portal" className="h-16 mx-auto object-contain" />
                  ) : (
                    <div className="h-16 flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-neutral-300" />
                    </div>
                  )}
                  <p className="text-sm text-neutral-500 mt-2">Pre-Handover Portal Logo</p>
                </div>
                <div className="border-2 border-neutral-200 rounded-lg p-4 text-center">
                  {development.assistant_logo_url ? (
                    <img src={development.assistant_logo_url} alt="Property Assistant" className="h-16 mx-auto object-contain" />
                  ) : (
                    <div className="h-16 flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-neutral-300" />
                    </div>
                  )}
                  <p className="text-sm text-neutral-500 mt-2">Property Assistant Logo</p>
                </div>
                <div className="border-2 border-neutral-200 rounded-lg p-4 text-center">
                  {development.sidebar_logo_url ? (
                    <img src={development.sidebar_logo_url} alt="Developer Dashboard" className="h-16 mx-auto object-contain" />
                  ) : (
                    <div className="h-16 flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-neutral-300" />
                    </div>
                  )}
                  <p className="text-sm text-neutral-500 mt-2">Developer Dashboard Logo</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white border-2 border-neutral-200 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-neutral-900">{development._count?.units || 0}</p>
                <p className="text-sm text-neutral-500">Total Units</p>
              </div>
              <div className="bg-white border-2 border-neutral-200 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-neutral-900">0</p>
                <p className="text-sm text-neutral-500">With Data</p>
              </div>
              <div className="bg-white border-2 border-neutral-200 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-neutral-900">{development._count?.units ? 'Set' : 'Not Set'}</p>
                <p className="text-sm text-neutral-500">Pipeline</p>
              </div>
              <div className="bg-white border-2 border-neutral-200 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-neutral-900">{development._count?.documents || 0}</p>
                <p className="text-sm text-neutral-500">Documents</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'units' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <input
                  type="text"
                  placeholder="Search units..."
                  className="w-full pl-4 pr-4 py-2.5 text-sm bg-white border-2 border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20 focus:border-[#D4AF37] transition-colors text-neutral-900"
                />
              </div>
              <div className="flex gap-2">
                <button className="flex items-center gap-2 px-4 py-2.5 border-2 border-neutral-200 rounded-lg text-neutral-700 hover:bg-neutral-50 transition-colors">
                  + Add Unit
                </button>
                <button
                  onClick={() => setActiveTab('import')}
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#D4AF37] text-white rounded-lg hover:bg-[#C5A028] transition-colors font-medium"
                >
                  <Upload className="w-4 h-4" />
                  Bulk Import Units
                </button>
              </div>
            </div>

            {unitsLoading ? (
              <div className="bg-white border-2 border-neutral-200 rounded-xl p-8 text-center">
                <RefreshCw className="w-8 h-8 text-neutral-300 animate-spin mx-auto" />
                <p className="text-sm text-neutral-500 mt-3">Loading units...</p>
              </div>
            ) : units.length === 0 ? (
              <div className="bg-white border-2 border-neutral-200 rounded-xl p-12 text-center">
                <Package className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-neutral-900 mb-2">No units yet</h3>
                <p className="text-neutral-500 mb-6">
                  Units will be created when you import your sales pipeline data, or you can add them manually.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button className="flex items-center gap-2 px-4 py-2.5 border-2 border-neutral-200 rounded-lg text-neutral-700 hover:bg-neutral-50 transition-colors">
                    + Add Unit Manually
                  </button>
                  <button
                    onClick={() => setActiveTab('import')}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#D4AF37] text-white rounded-lg hover:bg-[#C5A028] transition-colors font-medium"
                  >
                    <Upload className="w-4 h-4" />
                    Import from Sales Pipeline
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white border-2 border-neutral-200 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-neutral-50 border-b-2 border-neutral-200">
                    <tr>
                      <th className="text-left px-6 py-3 text-sm font-semibold text-neutral-900">Unit</th>
                      <th className="text-left px-6 py-3 text-sm font-semibold text-neutral-900">Address</th>
                      <th className="text-left px-6 py-3 text-sm font-semibold text-neutral-900">Bedrooms</th>
                      <th className="text-left px-6 py-3 text-sm font-semibold text-neutral-900">Type Code</th>
                      <th className="text-left px-6 py-3 text-sm font-semibold text-neutral-900">Pipeline</th>
                      <th className="text-left px-6 py-3 text-sm font-semibold text-neutral-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {units.map((unit) => (
                      <tr key={unit.id} className="hover:bg-neutral-50">
                        <td className="px-6 py-4 text-sm text-neutral-900 font-medium">{unit.unit_number}</td>
                        <td className="px-6 py-4 text-sm text-neutral-900">{unit.address}</td>
                        <td className="px-6 py-4 text-sm text-neutral-900">{unit.bedrooms}</td>
                        <td className="px-6 py-4 text-sm text-neutral-900">{unit.house_type_code}</td>
                        <td className="px-6 py-4 text-sm">
                          {unit.has_pipeline ? (
                            <span className="text-green-600">✓ Linked</span>
                          ) : (
                            <span className="text-red-500">✗ Missing</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <button className="text-sm text-[#D4AF37] hover:underline">Edit</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'import' && (
          <div className="space-y-6">
            <div className="bg-white border-2 border-neutral-200 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-neutral-900 mb-2">Import Sales Pipeline Data</h2>
              <p className="text-neutral-600 mb-6">
                Upload your Excel spreadsheet to import units and sales pipeline data.
                This will create units and populate all sales tracking information.
              </p>

              {importStep === 'upload' && (
                <>
                  <div
                    className={cn(
                      'border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer',
                      dragActive
                        ? 'border-[#D4AF37] bg-[#D4AF37]/5'
                        : 'border-neutral-300 hover:border-neutral-400'
                    )}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={(e) => e.target.files?.[0] && validateAndSetFile(e.target.files[0])}
                      className="hidden"
                    />
                    <FileSpreadsheet className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
                    <p className="text-neutral-600 mb-2">Drop Excel file here or click to upload</p>
                    <p className="text-sm text-neutral-400">Supports .xlsx, .xls</p>
                  </div>

                  <button className="mt-4 flex items-center gap-2 text-[#D4AF37] hover:underline text-sm">
                    <Download className="w-4 h-4" />
                    Download Sample Template
                  </button>
                </>
              )}

              {importStep === 'sheet' && (
                <div className="space-y-4">
                  <h3 className="text-base font-semibold text-neutral-900">Select Sheet to Import</h3>
                  <p className="text-sm text-neutral-600">Found {sheets.length} sheets in your file:</p>

                  <div className="space-y-2">
                    {sheets.map((sheet) => (
                      <label
                        key={sheet.name}
                        className={cn(
                          'flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors',
                          selectedSheet === sheet.name
                            ? 'border-[#D4AF37] bg-[#D4AF37]/5'
                            : 'border-neutral-200 hover:border-neutral-300'
                        )}
                      >
                        <input
                          type="radio"
                          name="sheet"
                          value={sheet.name}
                          checked={selectedSheet === sheet.name}
                          onChange={() => setSelectedSheet(sheet.name)}
                          className="text-[#D4AF37] focus:ring-[#D4AF37]"
                        />
                        <span className="text-neutral-900 font-medium">{sheet.name}</span>
                        <span className="text-sm text-neutral-500">({sheet.rowCount} rows)</span>
                      </label>
                    ))}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={resetImport}
                      className="px-4 py-2.5 border-2 border-neutral-200 rounded-lg text-neutral-700 hover:bg-neutral-50 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => selectSheet(selectedSheet)}
                      disabled={!selectedSheet || isProcessing}
                      className="flex items-center gap-2 px-4 py-2.5 bg-[#D4AF37] text-white rounded-lg hover:bg-[#C5A028] transition-colors font-medium disabled:opacity-50"
                    >
                      {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      Continue
                    </button>
                  </div>
                </div>
              )}

              {importStep === 'mapping' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-neutral-900">Map Your Columns</h3>
                    <span className="text-sm text-neutral-500">{spreadsheetColumns.length} columns detected</span>
                  </div>

                  <div className="border-2 border-neutral-200 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-neutral-50 border-b-2 border-neutral-200">
                        <tr>
                          <th className="text-left px-4 py-3 text-sm font-semibold text-neutral-900">Your Spreadsheet Column</th>
                          <th className="text-center px-4 py-3 text-sm font-semibold text-neutral-900 w-12"></th>
                          <th className="text-left px-4 py-3 text-sm font-semibold text-neutral-900">Maps To</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {spreadsheetColumns.map((col) => (
                          <tr key={col}>
                            <td className="px-4 py-3 text-sm text-neutral-900">{col}</td>
                            <td className="px-4 py-3 text-center text-neutral-400">→</td>
                            <td className="px-4 py-3">
                              <select
                                value={columnMappings[col] || ''}
                                onChange={(e) => setColumnMappings({ ...columnMappings, [col]: e.target.value })}
                                className="w-full px-3 py-2 border-2 border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20 focus:border-[#D4AF37] text-neutral-900"
                              >
                                {STATUS_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="space-y-2 pt-4 border-t-2 border-neutral-200">
                    <label className="flex items-center gap-2 text-sm text-neutral-700">
                      <input
                        type="checkbox"
                        checked={extractHandover}
                        onChange={(e) => setExtractHandover(e.target.checked)}
                        className="rounded border-neutral-300 text-[#D4AF37] focus:ring-[#D4AF37]"
                      />
                      Extract handover date from Comments if "Complete" mentioned
                    </label>
                    <label className="flex items-center gap-2 text-sm text-neutral-700">
                      <input
                        type="checkbox"
                        checked={autoDrawdown}
                        onChange={(e) => setAutoDrawdown(e.target.checked)}
                        className="rounded border-neutral-300 text-[#D4AF37] focus:ring-[#D4AF37]"
                      />
                      Auto-calculate drawdown (handover - 14 days)
                    </label>
                    <label className="flex items-center gap-2 text-sm text-neutral-700">
                      <input
                        type="checkbox"
                        checked={autoSnag}
                        onChange={(e) => setAutoSnag(e.target.checked)}
                        className="rounded border-neutral-300 text-[#D4AF37] focus:ring-[#D4AF37]"
                      />
                      Auto-calculate snag date if not provided
                    </label>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => setImportStep(sheets.length > 1 ? 'sheet' : 'upload')}
                      className="px-4 py-2.5 border-2 border-neutral-200 rounded-lg text-neutral-700 hover:bg-neutral-50 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      onClick={handlePreview}
                      disabled={isProcessing || !Object.values(columnMappings).includes('unit_address')}
                      className="flex items-center gap-2 px-4 py-2.5 bg-[#D4AF37] text-white rounded-lg hover:bg-[#C5A028] transition-colors font-medium disabled:opacity-50"
                    >
                      {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      Preview Import
                    </button>
                  </div>
                </div>
              )}

              {importStep === 'preview' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-neutral-900">Preview Import</h3>
                    <span className="text-sm text-neutral-500">{previewData.length} units to import</span>
                  </div>

                  <div className="border-2 border-neutral-200 rounded-lg overflow-x-auto">
                    <table className="w-full min-w-[1200px]">
                      <thead className="bg-neutral-50 border-b-2 border-neutral-200">
                        <tr>
                          <th className="text-left px-4 py-3 text-sm font-semibold text-neutral-900">#</th>
                          <th className="text-left px-4 py-3 text-sm font-semibold text-neutral-900">Address</th>
                          <th className="text-left px-4 py-3 text-sm font-semibold text-neutral-900">Status</th>
                          <th className="text-left px-4 py-3 text-sm font-semibold text-neutral-900">Price</th>
                          <th className="text-left px-4 py-3 text-sm font-semibold text-neutral-900">Purchaser</th>
                          <th className="text-left px-4 py-3 text-sm font-semibold text-neutral-900">Release</th>
                          <th className="text-left px-4 py-3 text-sm font-semibold text-neutral-900">Agreed</th>
                          <th className="text-left px-4 py-3 text-sm font-semibold text-neutral-900">Queries</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {previewData.slice(0, 20).map((row, idx) => (
                          <tr key={idx} className="hover:bg-neutral-50">
                            <td className="px-4 py-3 text-sm text-neutral-900">{idx + 1}</td>
                            <td className="px-4 py-3 text-sm text-neutral-900 font-medium">{row.address}</td>
                            <td className="px-4 py-3 text-sm">
                              <span className={cn(
                                'px-2 py-1 rounded-full text-xs font-medium',
                                row.status === 'For Sale' && 'bg-blue-100 text-blue-700',
                                row.status === 'Agreed' && 'bg-amber-100 text-amber-700',
                                row.status === 'Signed' && 'bg-green-100 text-green-700',
                                row.status === 'Sold' && 'bg-purple-100 text-purple-700'
                              )}>
                                {row.status || '—'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-neutral-900">{row.price || '—'}</td>
                            <td className="px-4 py-3 text-sm text-neutral-900 max-w-[200px] truncate">{row.purchaser || '—'}</td>
                            <td className="px-4 py-3 text-sm text-neutral-900">{row.release_date || '—'}</td>
                            <td className="px-4 py-3 text-sm text-neutral-900">{row.sale_agreed_date || '—'}</td>
                            <td className="px-4 py-3 text-sm text-neutral-900">{row.queries_raised_date || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {previewData.length > 20 && (
                    <p className="text-sm text-neutral-500 text-center">
                      Showing 20 of {previewData.length} rows. Scroll horizontally to see more columns.
                    </p>
                  )}

                  <div className="bg-neutral-50 border-2 border-neutral-200 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-neutral-900 mb-2">Summary</h4>
                    <ul className="text-sm text-neutral-600 space-y-1">
                      <li>• {previewData.length} total units</li>
                      <li>• {previewData.filter(r => r.status === 'For Sale').length} For Sale</li>
                      <li>• {previewData.filter(r => r.status === 'Agreed').length} Agreed</li>
                      <li>• {previewData.filter(r => r.status === 'Signed').length} Signed</li>
                      <li>• {previewData.filter(r => r.purchaser).length} with purchaser assigned</li>
                    </ul>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => setImportStep('mapping')}
                      className="px-4 py-2.5 border-2 border-neutral-200 rounded-lg text-neutral-700 hover:bg-neutral-50 transition-colors"
                    >
                      Back to Mapping
                    </button>
                    <button
                      onClick={handleImport}
                      className="flex items-center gap-2 px-6 py-2.5 bg-[#D4AF37] text-white rounded-lg hover:bg-[#C5A028] transition-colors font-medium"
                    >
                      <Upload className="w-4 h-4" />
                      Import {previewData.length} Units
                    </button>
                  </div>
                </div>
              )}

              {importStep === 'importing' && (
                <div className="py-12 text-center">
                  <Loader2 className="w-12 h-12 text-[#D4AF37] animate-spin mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-neutral-900 mb-2">Importing...</h3>
                  <p className="text-neutral-500">Please wait while we import your data.</p>
                </div>
              )}

              {importStep === 'success' && importResult && (
                <div className="py-8 text-center">
                  <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-neutral-900 mb-2">Import Successful!</h3>

                  <div className="bg-neutral-50 border-2 border-neutral-200 rounded-lg p-6 max-w-md mx-auto mt-6">
                    <h4 className="text-sm font-semibold text-neutral-900 mb-3">Created:</h4>
                    <ul className="text-sm text-neutral-600 space-y-1">
                      <li>• {importResult.unitsCreated} units</li>
                      <li>• {importResult.pipelineCreated} pipeline records</li>
                    </ul>

                    {importResult.summary && (
                      <div className="mt-4 pt-4 border-t border-neutral-200">
                        <h4 className="text-sm font-semibold text-neutral-900 mb-2">Summary:</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="text-neutral-600">For Sale</div>
                          <div className="text-neutral-900 font-medium text-right">{importResult.summary.for_sale || 0}</div>
                          <div className="text-neutral-600">Agreed</div>
                          <div className="text-neutral-900 font-medium text-right">{importResult.summary.agreed || 0}</div>
                          <div className="text-neutral-600">Signed</div>
                          <div className="text-neutral-900 font-medium text-right">{importResult.summary.signed || 0}</div>
                          <div className="text-neutral-600">Sold/Complete</div>
                          <div className="text-neutral-900 font-medium text-right">{importResult.summary.sold || 0}</div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-center gap-3 mt-8">
                    <button
                      onClick={() => setActiveTab('units')}
                      className="px-4 py-2.5 border-2 border-neutral-200 rounded-lg text-neutral-700 hover:bg-neutral-50 transition-colors"
                    >
                      View Units
                    </button>
                    <button
                      onClick={resetImport}
                      className="px-4 py-2.5 bg-[#D4AF37] text-white rounded-lg hover:bg-[#C5A028] transition-colors font-medium"
                    >
                      Import Another File
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="bg-white border-2 border-neutral-200 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-neutral-900 mb-4">Edit Development Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={editForm.name || development.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-4 py-2.5 border-2 border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20 focus:border-[#D4AF37] text-neutral-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Address</label>
                  <input
                    type="text"
                    value={editForm.address || development.address || ''}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    className="w-full px-4 py-2.5 border-2 border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20 focus:border-[#D4AF37] text-neutral-900"
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-neutral-700 mb-1">Description</label>
                <textarea
                  value={editForm.description || development.description || ''}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2.5 border-2 border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20 focus:border-[#D4AF37] text-neutral-900"
                />
              </div>
              <div className="mt-4">
                <button
                  onClick={handleEditDevelopment}
                  className="px-4 py-2.5 bg-[#D4AF37] text-white rounded-lg hover:bg-[#C5A028] transition-colors font-medium"
                >
                  Save Changes
                </button>
              </div>
            </div>

            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-red-900 mb-2">Danger Zone</h2>
              <p className="text-red-700 text-sm mb-4">
                These actions are irreversible. Please be certain before proceeding.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {}}
                  className="px-4 py-2.5 border-2 border-red-300 rounded-lg text-red-700 hover:bg-red-100 transition-colors"
                >
                  Deactivate Development
                </button>
                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Delete Development
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-neutral-900 mb-2">Delete Development?</h3>
            <p className="text-neutral-600 mb-6">
              This will permanently delete "{development.name}" and all associated data. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(false)}
                className="px-4 py-2 border-2 border-neutral-200 rounded-lg text-neutral-700 hover:bg-neutral-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteDevelopment}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
