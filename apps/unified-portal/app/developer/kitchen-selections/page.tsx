'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Settings,
  Mail,
  Search,
  Check,
  X,
  Plus,
  MessageCircle,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { useCurrentContext } from '@/contexts/CurrentContext';

const tokens = {
  gold: '#D4AF37',
  goldLight: '#F5D874',
  goldDark: '#B8934C',
  dark: '#111827',
  darker: '#0b0c0f',
  cream: '#f9fafb',
  warmGray: '#f3f4f6',
  textPrimary: '#111827',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  success: '#22c55e',
  warning: '#f97316',
  danger: '#ef4444',
  border: '#e5e7eb',
  borderLight: '#e5e7eb',
};

interface KitchenUnit {
  id: string;
  unitId: string;
  unitNumber: string;
  address: string | null;
  purchaserName: string | null;
  houseType: string;
  bedrooms: number;
  hasKitchen: boolean | null;
  counterType: string | null;
  unitFinish: string | null;
  handleStyle: string | null;
  hasWardrobe: boolean | null;
  wardrobeStyle: string | null;
  notes: string | null;
  status: 'complete' | 'pending';
  pcSumKitchen: number;
  pcSumWardrobes: number;
  pcSumTotal: number;
}

function formatCurrency(value: number): string {
  const absValue = Math.abs(value);
  const formatted = new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(absValue);
  return value < 0 ? `-${formatted}` : formatted;
}

interface SelectionOptions {
  counterTypes: string[];
  unitFinishes: string[];
  handleStyles: string[];
  wardrobeStyles: string[];
  pcSumKitchen4Bed?: number;
  pcSumKitchen3Bed?: number;
  pcSumKitchen2Bed?: number;
  pcSumWardrobes?: number;
}

interface DevelopmentInfo {
  id: string;
  name: string;
  code: string;
}

const defaultOptions: SelectionOptions = {
  counterTypes: ['Granite', 'Quartz', 'Marble', 'Laminate'],
  unitFinishes: ['Matt White', 'Gloss White', 'Oak', 'Walnut'],
  handleStyles: ['Bar', 'Knob', 'Integrated', 'Cup'],
  wardrobeStyles: ['Sliding', 'Hinged', 'Walk-in'],
  pcSumKitchen4Bed: 7000,
  pcSumKitchen3Bed: 6000,
  pcSumKitchen2Bed: 5000,
  pcSumWardrobes: 1000,
};

function naturalSort(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function YesNoToggle({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div className="h-14 flex items-center justify-center">
      <div className="flex gap-1">
        <button
          onClick={() => onChange(true)}
          className={`w-8 h-7 flex items-center justify-center rounded-l-lg text-xs font-semibold transition-all ${
            value === true
              ? 'bg-emerald-500 text-white border border-emerald-500'
              : 'bg-white text-gray-400 border border-gray-200 hover:border-gray-300'
          }`}
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onChange(false)}
          className={`w-8 h-7 flex items-center justify-center rounded-r-lg text-xs font-semibold transition-all ${
            value === false
              ? 'bg-red-500 text-white border border-red-500'
              : 'bg-white text-gray-400 border border-gray-200 hover:border-gray-300'
          }`}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function InlineDropdown({
  value,
  options,
  onChange,
  disabled,
}: {
  value: string | null;
  options: string[];
  onChange: (v: string | null) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (disabled) {
    return (
      <div className="h-14 flex items-center px-2">
        <span className="text-xs text-gray-300">—</span>
      </div>
    );
  }

  return (
    <div className="relative h-14 flex items-center px-2">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 px-2 py-1.5 rounded-lg border text-xs transition-all w-full justify-between ${
          value
            ? 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
            : 'bg-gray-50 border-gray-200 text-gray-400 hover:bg-white hover:border-gray-300'
        }`}
      >
        <span className="truncate">{value || 'Select'}</span>
        <ChevronDown className="w-3 h-3 flex-shrink-0" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-2 right-2 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-1 max-h-48 overflow-y-auto">
            <button
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:bg-gray-50"
            >
              Clear
            </button>
            {options.map((opt) => (
              <button
                key={opt}
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-amber-50 ${
                  value === opt ? 'bg-amber-50 text-amber-700 font-medium' : 'text-gray-700'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function NotesModal({
  open,
  onClose,
  unit,
  notes,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  unit: KitchenUnit | null;
  notes: string;
  onSave: (notes: string) => void;
}) {
  const [value, setValue] = useState(notes);

  useEffect(() => {
    setValue(notes);
  }, [notes, open]);

  if (!open || !unit) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-2xl shadow-2xl z-50">
        <div className="p-6">
          <h3 className="text-lg font-bold" style={{ color: tokens.dark }}>
            Notes for Unit {unit.unitNumber}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {unit.purchaserName || 'No purchaser assigned'}
          </p>

          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Add notes about this unit's kitchen/wardrobe selections..."
            className="w-full mt-4 p-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 resize-none"
            rows={5}
          />

          <div className="flex justify-end gap-3 mt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onSave(value);
                onClose();
              }}
              className="px-4 py-2 text-sm font-medium text-white rounded-xl transition-colors"
              style={{ backgroundColor: tokens.gold }}
            >
              Save Notes
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function SettingsModal({
  open,
  onClose,
  options,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  options: SelectionOptions;
  onSave: (options: SelectionOptions) => void;
}) {
  const safeOptions = options || defaultOptions;
  const [localOptions, setLocalOptions] = useState<SelectionOptions>(safeOptions);
  const [newItem, setNewItem] = useState({ category: '', value: '' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setLocalOptions(options || defaultOptions);
      setError(null);
    } catch (err) {
      console.error('Error loading settings:', err);
      setError('Failed to load settings');
    }
  }, [options, open]);

  if (!open) return null;
  
  if (error) {
    return (
      <>
        <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-2xl shadow-2xl z-50 p-6">
          <h3 className="text-lg font-bold text-gray-900">Settings Error</h3>
          <p className="text-sm text-red-600 mt-2">{error}</p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </>
    );
  }

  type ArrayCategory = 'counterTypes' | 'unitFinishes' | 'handleStyles' | 'wardrobeStyles';
  
  const categories: { key: ArrayCategory; label: string }[] = [
    { key: 'counterTypes', label: 'Counter Types' },
    { key: 'unitFinishes', label: 'Unit Finishes' },
    { key: 'handleStyles', label: 'Handle Styles' },
    { key: 'wardrobeStyles', label: 'Wardrobe Styles' },
  ];

  const addItem = (category: ArrayCategory) => {
    if (!newItem.value.trim()) return;
    setLocalOptions((prev) => ({
      ...prev,
      [category]: [...(prev[category] || []), newItem.value.trim()],
    }));
    setNewItem({ category: '', value: '' });
  };

  const removeItem = (category: ArrayCategory, index: number) => {
    setLocalOptions((prev) => ({
      ...prev,
      [category]: (prev[category] || []).filter((_: string, i: number) => i !== index),
    }));
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[80vh] overflow-y-auto bg-white rounded-2xl shadow-2xl z-50">
        <div className="p-6">
          <h3 className="text-lg font-bold" style={{ color: tokens.dark }}>
            Selection Options
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Configure the available options for kitchen and wardrobe selections
          </p>

          {/* PC Sum Amounts Section */}
          <div className="mt-6 mb-6 p-4 bg-amber-50 rounded-xl border border-amber-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">PC Sum Allowances</h4>
            <p className="text-xs text-gray-500 mb-4">Set the PC sum deduction amounts when purchasers opt for their own kitchen/wardrobes</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">4 Bed Kitchen</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
                  <input
                    type="number"
                    value={localOptions.pcSumKitchen4Bed ?? 7000}
                    onChange={(e) => setLocalOptions(prev => ({ ...prev, pcSumKitchen4Bed: parseInt(e.target.value) || 0 }))}
                    className="w-full pl-7 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">3 Bed Kitchen</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
                  <input
                    type="number"
                    value={localOptions.pcSumKitchen3Bed ?? 6000}
                    onChange={(e) => setLocalOptions(prev => ({ ...prev, pcSumKitchen3Bed: parseInt(e.target.value) || 0 }))}
                    className="w-full pl-7 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">2 Bed Kitchen</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
                  <input
                    type="number"
                    value={localOptions.pcSumKitchen2Bed ?? 5000}
                    onChange={(e) => setLocalOptions(prev => ({ ...prev, pcSumKitchen2Bed: parseInt(e.target.value) || 0 }))}
                    className="w-full pl-7 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Wardrobes</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
                  <input
                    type="number"
                    value={localOptions.pcSumWardrobes ?? 1000}
                    onChange={(e) => setLocalOptions(prev => ({ ...prev, pcSumWardrobes: parseInt(e.target.value) || 0 }))}
                    className="w-full pl-7 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {categories.map(({ key, label }) => (
              <div key={key}>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">{label}</h4>
                <div className="flex flex-wrap gap-2">
                  {(localOptions[key] || []).map((item, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-sm text-gray-700 rounded-lg"
                    >
                      {item}
                      <button
                        onClick={() => removeItem(key, idx)}
                        className="ml-1 text-gray-400 hover:text-red-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {newItem.category === key ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={newItem.value}
                        onChange={(e) => setNewItem((prev) => ({ ...prev, value: e.target.value }))}
                        onKeyDown={(e) => e.key === 'Enter' && addItem(key)}
                        className="w-32 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-amber-500"
                        autoFocus
                      />
                      <button
                        onClick={() => addItem(key)}
                        className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setNewItem({ category: '', value: '' })}
                        className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setNewItem({ category: key, value: '' })}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-500 border border-dashed border-gray-300 rounded-lg hover:border-gray-400 hover:text-gray-600"
                    >
                      <Plus className="w-3 h-3" />
                      Add
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 mt-8">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onSave(localOptions);
                onClose();
              }}
              className="px-4 py-2 text-sm font-medium text-white rounded-xl transition-colors"
              style={{ backgroundColor: tokens.gold }}
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function KitchenSelectionsPage() {
  const router = useRouter();
  const { developmentId, developmentName } = useCurrentContext();

  const [units, setUnits] = useState<KitchenUnit[]>([]);
  const [development, setDevelopment] = useState<DevelopmentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'complete' | 'pending'>('all');
  const [showSettings, setShowSettings] = useState(false);
  const [options, setOptions] = useState<SelectionOptions>(defaultOptions);
  const [notesModal, setNotesModal] = useState<{ open: boolean; unit: KitchenUnit | null }>({
    open: false,
    unit: null,
  });

  const fetchData = useCallback(async () => {
    if (!developmentId) {
      setLoading(false);
      setError('Please select a development first');
      return;
    }

    try {
      setLoading(true);
      console.log('[Kitchen Selections] Fetching for development:', developmentId, 'name:', developmentName);
      
      const nameParam = developmentName ? `?name=${encodeURIComponent(developmentName)}` : '';
      const res = await fetch(`/api/kitchen-selections/${developmentId}${nameParam}`, {
        credentials: 'include',
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch data');
      }
      
      const data = await res.json();
      setDevelopment(data.development);
      setUnits(data.units || []);
      setOptions(data.options || defaultOptions);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching kitchen selections:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [developmentId, developmentName]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const stats = useMemo(() => {
    const total = units.length;
    const complete = units.filter((u) => u.status === 'complete').length;
    const pending = units.filter((u) => u.status === 'pending').length;
    const completionRate = total > 0 ? Math.round((complete / total) * 100) : 0;
    const totalPcSumDeductions = units.reduce((acc, u) => acc + (u.pcSumTotal || 0), 0);
    const unitsWithDeductions = units.filter((u) => (u.pcSumTotal || 0) < 0).length;
    return { total, complete, pending, completionRate, totalPcSumDeductions, unitsWithDeductions };
  }, [units]);

  const filteredUnits = useMemo(() => {
    return units
      .filter((u) => {
        const matchesSearch =
          !searchQuery ||
          u.unitNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
          u.purchaserName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          u.houseType?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesTab =
          activeTab === 'all' ||
          (activeTab === 'complete' && u.status === 'complete') ||
          (activeTab === 'pending' && u.status === 'pending');
        return matchesSearch && matchesTab;
      })
      .sort((a, b) => naturalSort(a.unitNumber, b.unitNumber));
  }, [units, searchQuery, activeTab]);

  const updateUnit = async (unitId: string, field: string, value: any) => {
    if (!developmentId) return;

    setUnits((prev) =>
      prev.map((u) => {
        if (u.unitId !== unitId) return u;
        const updated = { ...u, [field]: value };

        const hasAllKitchenFields =
          updated.hasKitchen === true && updated.counterType && updated.unitFinish && updated.handleStyle;
        const hasAllWardrobeFields = updated.hasWardrobe === true && updated.wardrobeStyle;

        const kitchenComplete = updated.hasKitchen === false || hasAllKitchenFields;
        const wardrobeComplete = updated.hasWardrobe === false || hasAllWardrobeFields;

        const hasAnySelection = updated.hasKitchen !== null || updated.hasWardrobe !== null;
        const isComplete =
          hasAnySelection &&
          (updated.hasKitchen !== null ? kitchenComplete : true) &&
          (updated.hasWardrobe !== null ? wardrobeComplete : true) &&
          (updated.hasKitchen === true || updated.hasWardrobe === true);

        updated.status = isComplete ? 'complete' : 'pending';
        return updated;
      })
    );

    try {
      const nameParam = developmentName ? `?name=${encodeURIComponent(developmentName)}` : '';
      await fetch(`/api/kitchen-selections/${developmentId}${nameParam}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ unitId, field, value }),
      });
    } catch (err) {
      console.error('Error updating kitchen selection:', err);
    }
  };

  const handleSaveNotes = async (notes: string) => {
    if (!notesModal.unit) return;
    await updateUnit(notesModal.unit.unitId, 'notes', notes);
  };

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center" style={{ backgroundColor: tokens.cream }}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-amber-500" />
          <p className="mt-3 text-gray-500">Loading kitchen selections...</p>
        </div>
      </div>
    );
  }

  if (error || !developmentId) {
    return (
      <div className="min-h-full flex items-center justify-center" style={{ backgroundColor: tokens.cream }}>
        <div className="text-center max-w-md">
          <p className="text-gray-500">{error || 'Please select a development to view kitchen selections.'}</p>
          <button
            onClick={() => router.push('/developer')}
            className="mt-4 px-4 py-2 text-sm font-medium text-white rounded-xl"
            style={{ backgroundColor: tokens.gold }}
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full" style={{ backgroundColor: tokens.cream }}>
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/developer')}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-xl font-bold" style={{ color: tokens.dark }}>
                  Kitchen Selections
                </h1>
                <p className="text-sm text-gray-500">{development?.name || 'Loading...'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowSettings(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                <Settings className="w-4 h-4" />
                Settings
              </button>
              {stats.pending > 0 && (
                <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-xl transition-colors shadow-lg" style={{ backgroundColor: tokens.gold }}>
                  <Mail className="w-4 h-4" />
                  Send Reminders ({stats.pending})
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="max-w-[1600px] mx-auto space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold" style={{ color: tokens.dark }}>
                    Selection Progress
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {stats.complete} of {stats.total} units complete
                  </p>
                </div>
                <div className="relative w-14 h-14">
                  <svg className="w-14 h-14" style={{ transform: 'rotate(-90deg)' }} viewBox="0 0 56 56">
                    <circle cx="28" cy="28" r="24" fill="none" stroke="#f0efec" strokeWidth="4" />
                    <circle
                      cx="28"
                      cy="28"
                      r="24"
                      fill="none"
                      stroke={stats.completionRate === 100 ? tokens.success : tokens.gold}
                      strokeWidth="4"
                      strokeDasharray={2 * Math.PI * 24}
                      strokeDashoffset={2 * Math.PI * 24 - (stats.completionRate / 100) * 2 * Math.PI * 24}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-bold" style={{ color: tokens.dark }}>
                    {stats.completionRate}%
                  </span>
                </div>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${stats.completionRate}%`,
                    backgroundColor: stats.completionRate === 100 ? tokens.success : tokens.gold,
                  }}
                />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold" style={{ color: tokens.dark }}>
                    PC Sum Deductions
                  </h3>
                  <p className={`text-2xl font-bold mt-2 ${stats.totalPcSumDeductions < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                    {formatCurrency(stats.totalPcSumDeductions)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {stats.unitsWithDeductions} units with deductions
                  </p>
                </div>
                {stats.totalPcSumDeductions < 0 && (
                  <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex bg-gray-100 rounded-xl p-1">
              {(['all', 'complete', 'pending'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                    activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab === 'all' && `All (${stats.total})`}
                  {tab === 'complete' && `Complete (${stats.complete})`}
                  {tab === 'pending' && `Pending (${stats.pending})`}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search units..."
                className="w-64 pl-9 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr style={{ backgroundColor: tokens.warmGray }}>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                      Unit
                    </th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                      Address
                    </th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                      Purchaser
                    </th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                      Type
                    </th>
                    <th className="text-center px-2 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 border-l border-gray-100">
                      Kitchen
                    </th>
                    <th className="text-left px-2 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 border-l border-gray-100">
                      Counter
                    </th>
                    <th className="text-left px-2 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 border-l border-gray-100">
                      Units
                    </th>
                    <th className="text-left px-2 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 border-l border-gray-100">
                      Handle
                    </th>
                    <th className="text-center px-2 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 border-l border-gray-100">
                      Wardrobe
                    </th>
                    <th className="text-left px-2 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 border-l border-gray-100">
                      Style
                    </th>
                    <th className="text-right px-3 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 border-l border-gray-100">
                      PC Sum
                    </th>
                    <th className="text-center px-3 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 border-l border-gray-100">
                      Status
                    </th>
                    <th className="text-center px-3 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 border-l border-gray-100">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUnits.map((unit, idx) => (
                    <tr
                      key={unit.unitId}
                      className="hover:bg-amber-50/30 transition-colors group"
                      style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa' }}
                    >
                      <td className="px-4 border-b border-gray-100">
                        <div className="h-14 flex items-center">
                          <span className="text-sm font-semibold" style={{ color: tokens.dark }}>
                            {unit.unitNumber}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 border-b border-gray-100">
                        <div className="h-14 flex items-center">
                          <span className={`text-sm ${unit.address ? 'text-gray-700' : 'text-gray-300'}`}>
                            {unit.address || '—'}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 border-b border-gray-100">
                        <div className="h-14 flex items-center">
                          <span className={`text-sm ${unit.purchaserName ? 'text-gray-700' : 'text-gray-300'}`}>
                            {unit.purchaserName || '—'}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 border-b border-gray-100">
                        <div className="h-14 flex items-center">
                          <span className="text-xs text-gray-500">{unit.houseType}</span>
                        </div>
                      </td>

                      <td className="border-b border-gray-100 border-l">
                        <YesNoToggle value={unit.hasKitchen} onChange={(val) => updateUnit(unit.unitId, 'hasKitchen', val)} />
                      </td>

                      <td className="border-b border-gray-100 border-l">
                        <InlineDropdown
                          value={unit.counterType}
                          options={options.counterTypes}
                          onChange={(val) => updateUnit(unit.unitId, 'counterType', val)}
                          disabled={unit.hasKitchen !== true}
                        />
                      </td>

                      <td className="border-b border-gray-100 border-l">
                        <InlineDropdown
                          value={unit.unitFinish}
                          options={options.unitFinishes}
                          onChange={(val) => updateUnit(unit.unitId, 'unitFinish', val)}
                          disabled={unit.hasKitchen !== true}
                        />
                      </td>

                      <td className="border-b border-gray-100 border-l">
                        <InlineDropdown
                          value={unit.handleStyle}
                          options={options.handleStyles}
                          onChange={(val) => updateUnit(unit.unitId, 'handleStyle', val)}
                          disabled={unit.hasKitchen !== true}
                        />
                      </td>

                      <td className="border-b border-gray-100 border-l">
                        <YesNoToggle value={unit.hasWardrobe} onChange={(val) => updateUnit(unit.unitId, 'hasWardrobe', val)} />
                      </td>

                      <td className="border-b border-gray-100 border-l">
                        <InlineDropdown
                          value={unit.wardrobeStyle}
                          options={options.wardrobeStyles}
                          onChange={(val) => updateUnit(unit.unitId, 'wardrobeStyle', val)}
                          disabled={unit.hasWardrobe !== true}
                        />
                      </td>

                      <td className="px-3 border-b border-gray-100 border-l">
                        <div className="h-14 flex items-center justify-end">
                          <span className={`text-sm font-medium ${
                            unit.hasKitchen === null
                              ? 'text-gray-400'
                              : unit.pcSumTotal < 0 
                                ? 'text-red-600' 
                                : 'text-gray-500'
                          }`}>
                            {unit.hasKitchen === null 
                              ? '—' 
                              : unit.pcSumTotal !== 0 
                                ? formatCurrency(unit.pcSumTotal) 
                                : '€0'}
                          </span>
                        </div>
                      </td>

                      <td className="border-b border-gray-100 border-l">
                        <div className="h-14 flex items-center justify-center">
                          <span
                            className={`px-2.5 py-1 text-[10px] font-semibold rounded-md ${
                              unit.status === 'complete'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {unit.status === 'complete' ? 'Complete' : 'Pending'}
                          </span>
                        </div>
                      </td>

                      <td className="border-b border-gray-100 border-l">
                        <div className="h-14 flex items-center justify-center">
                          <button
                            onClick={() => setNotesModal({ open: true, unit })}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors group/btn"
                          >
                            {unit.notes ? (
                              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-blue-50 border border-blue-200">
                                <MessageCircle className="w-3.5 h-3.5 text-blue-600" />
                              </div>
                            ) : (
                              <MessageCircle className="w-4 h-4 text-gray-300 group-hover/btn:text-gray-500" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredUnits.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-gray-400">No units found</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} options={options} onSave={async (newOptions) => {
        try {
          const nameParam = developmentName ? `?name=${encodeURIComponent(developmentName)}` : '';
          const res = await fetch(`/api/kitchen-selections/${developmentId}${nameParam}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ options: newOptions }),
          });
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            console.error('Failed to save options:', errorData.error || 'Unknown error');
            alert('Failed to save settings. Please try again.');
            return;
          }
          const data = await res.json();
          setOptions(data.options || newOptions);
        } catch (err) {
          console.error('Error saving options:', err);
          alert('Failed to save settings. Please try again.');
        }
      }} />
      <NotesModal
        open={notesModal.open}
        onClose={() => setNotesModal({ open: false, unit: null })}
        unit={notesModal.unit}
        notes={notesModal.unit?.notes || ''}
        onSave={handleSaveNotes}
      />
    </div>
  );
}
