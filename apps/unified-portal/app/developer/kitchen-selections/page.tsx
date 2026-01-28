'use client';

import { useState, useMemo, useEffect } from 'react';
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
} from 'lucide-react';
import { useDevelopment } from '@/contexts/DevelopmentContext';

// =============================================================================
// Design Tokens - OpenHouse Brand (matching Sales Pipeline)
// =============================================================================

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

// =============================================================================
// Types
// =============================================================================

interface KitchenUnit {
  id: string;
  unitNumber: string;
  address: string;
  purchaserName: string | null;
  hasKitchen: boolean | null;
  counterType: string | null;
  unitFinish: string | null;
  handleStyle: string | null;
  hasWardrobe: boolean | null;
  wardrobeStyle: string | null;
  status: 'complete' | 'pending';
  updatedAt: string | null;
  commentsCount: number;
}

interface SelectionOptions {
  counterTypes: string[];
  unitFinishes: string[];
  handleStyles: string[];
  wardrobeStyles: string[];
}

// =============================================================================
// Mock Data
// =============================================================================

const defaultOptions: SelectionOptions = {
  counterTypes: ['Granite Black', 'Granite White', 'Quartz Grey', 'Marble White', 'Laminate Oak'],
  unitFinishes: ['Matt White', 'Gloss White', 'Matt Grey', 'Natural Oak', 'Walnut'],
  handleStyles: ['Chrome Bar', 'Brass Knob', 'Matt Black Bar', 'Integrated', 'Antique Bronze'],
  wardrobeStyles: ['Sliding Mirror', 'Hinged White', 'Hinged Oak', 'Walk-in Open'],
};

const mockUnits: KitchenUnit[] = [
  { id: '1', unitNumber: '1', address: '1 Longview Park', purchaserName: 'A. Murphy', hasKitchen: true, counterType: 'Granite Black', unitFinish: 'Matt White', handleStyle: 'Chrome Bar', hasWardrobe: true, wardrobeStyle: 'Sliding Mirror', status: 'complete', updatedAt: '2026-01-25', commentsCount: 2 },
  { id: '2', unitNumber: '2', address: '2 Longview Park', purchaserName: 'S. Walsh', hasKitchen: true, counterType: 'Quartz Grey', unitFinish: 'Gloss White', handleStyle: null, hasWardrobe: false, wardrobeStyle: null, status: 'pending', updatedAt: '2026-01-24', commentsCount: 0 },
  { id: '3', unitNumber: '3', address: '3 Longview Park', purchaserName: 'P. Byrne', hasKitchen: false, counterType: null, unitFinish: null, handleStyle: null, hasWardrobe: true, wardrobeStyle: 'Hinged White', status: 'pending', updatedAt: '2026-01-23', commentsCount: 1 },
  { id: '4', unitNumber: '4', address: '4 Longview Park', purchaserName: 'K. Dolan', hasKitchen: true, counterType: 'Marble White', unitFinish: 'Natural Oak', handleStyle: 'Brass Knob', hasWardrobe: true, wardrobeStyle: 'Walk-in Open', status: 'complete', updatedAt: '2026-01-22', commentsCount: 0 },
  { id: '5', unitNumber: '5', address: '5 Longview Park', purchaserName: 'J. O\'Connor', hasKitchen: null, counterType: null, unitFinish: null, handleStyle: null, hasWardrobe: null, wardrobeStyle: null, status: 'pending', updatedAt: null, commentsCount: 0 },
  { id: '6', unitNumber: '6', address: '6 Longview Park', purchaserName: 'A. Dolan', hasKitchen: true, counterType: 'Laminate Oak', unitFinish: 'Walnut', handleStyle: 'Matt Black Bar', hasWardrobe: false, wardrobeStyle: null, status: 'complete', updatedAt: '2026-01-20', commentsCount: 3 },
  { id: '7', unitNumber: '7', address: '7 Longview Park', purchaserName: 'M. Collins', hasKitchen: true, counterType: null, unitFinish: 'Matt Grey', handleStyle: 'Integrated', hasWardrobe: true, wardrobeStyle: null, status: 'pending', updatedAt: '2026-01-19', commentsCount: 0 },
  { id: '8', unitNumber: '8', address: '8 Longview Park', purchaserName: null, hasKitchen: null, counterType: null, unitFinish: null, handleStyle: null, hasWardrobe: null, wardrobeStyle: null, status: 'pending', updatedAt: null, commentsCount: 0 },
];

// =============================================================================
// Utility Functions
// =============================================================================

function naturalSort(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

// =============================================================================
// Inline Dropdown Component
// =============================================================================

interface InlineDropdownProps {
  value: string | null;
  options: string[];
  onChange: (value: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
}

function InlineDropdown({ value, options, onChange, disabled, placeholder = 'Select...' }: InlineDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (disabled) {
    return (
      <div className="h-11 px-3 flex items-center">
        <span className="text-xs text-gray-300">—</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="h-11 px-3 flex items-center gap-1 w-full hover:bg-gray-50 transition-colors text-left group"
      >
        <span className={`text-xs truncate ${value ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
          {value || placeholder}
        </span>
        <ChevronDown className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </button>
      
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-44 bg-white rounded-lg shadow-xl border border-gray-200 z-50 py-1 max-h-48 overflow-auto">
            <button
              onClick={() => { onChange(null); setIsOpen(false); }}
              className="w-full px-3 py-2 text-left text-xs text-gray-400 hover:bg-gray-50"
            >
              Clear
            </button>
            {options.map((opt) => (
              <button
                key={opt}
                onClick={() => { onChange(opt); setIsOpen(false); }}
                className={`w-full px-3 py-2 text-left text-xs hover:bg-amber-50 flex items-center justify-between ${value === opt ? 'bg-amber-50 text-amber-700 font-medium' : 'text-gray-700'}`}
              >
                {opt}
                {value === opt && <Check className="w-3 h-3 text-amber-600" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// =============================================================================
// Yes/No Toggle Component
// =============================================================================

interface YesNoToggleProps {
  value: boolean | null;
  onChange: (value: boolean) => void;
}

function YesNoToggle({ value, onChange }: YesNoToggleProps) {
  return (
    <div className="h-11 px-2 flex items-center justify-center gap-1">
      <button
        onClick={() => onChange(true)}
        className={`px-2.5 py-1 text-[10px] font-semibold rounded transition-all ${
          value === true
            ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
        }`}
      >
        Yes
      </button>
      <button
        onClick={() => onChange(false)}
        className={`px-2.5 py-1 text-[10px] font-semibold rounded transition-all ${
          value === false
            ? 'bg-gray-200 text-gray-600 border border-gray-300'
            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
        }`}
      >
        No
      </button>
    </div>
  );
}

// =============================================================================
// Settings Modal Component
// =============================================================================

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  options: SelectionOptions;
  onSave: (options: SelectionOptions) => void;
}

function SettingsModal({ open, onClose, options, onSave }: SettingsModalProps) {
  const [localOptions, setLocalOptions] = useState(options);
  const [newItems, setNewItems] = useState<Record<string, string>>({
    counterTypes: '',
    unitFinishes: '',
    handleStyles: '',
    wardrobeStyles: '',
  });

  useEffect(() => {
    setLocalOptions(options);
  }, [options, open]);

  if (!open) return null;

  const addItem = (category: keyof SelectionOptions) => {
    const value = newItems[category].trim();
    if (value && !localOptions[category].includes(value)) {
      setLocalOptions({
        ...localOptions,
        [category]: [...localOptions[category], value],
      });
      setNewItems({ ...newItems, [category]: '' });
    }
  };

  const removeItem = (category: keyof SelectionOptions, item: string) => {
    setLocalOptions({
      ...localOptions,
      [category]: localOptions[category].filter((i) => i !== item),
    });
  };

  const categoryLabels: Record<keyof SelectionOptions, string> = {
    counterTypes: 'Counter Types',
    unitFinishes: 'Unit Finishes',
    handleStyles: 'Handle Styles',
    wardrobeStyles: 'Wardrobe Styles',
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-bold" style={{ color: tokens.dark }}>Selection Options</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6 overflow-auto max-h-[60vh]">
            {(Object.keys(categoryLabels) as Array<keyof SelectionOptions>).map((category) => (
              <div key={category}>
                <label className="text-sm font-semibold text-gray-700 mb-2 block">{categoryLabels[category]}</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {localOptions[category].map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-800 rounded-full text-sm font-medium border border-amber-200"
                    >
                      {item}
                      <button
                        onClick={() => removeItem(category, item)}
                        className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-amber-200 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newItems[category]}
                    onChange={(e) => setNewItems({ ...newItems, [category]: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && addItem(category)}
                    placeholder={`Add ${categoryLabels[category].toLowerCase().slice(0, -1)}...`}
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                  <button
                    onClick={() => addItem(category)}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => { onSave(localOptions); onClose(); }}
              className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors"
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

// =============================================================================
// Main Kitchen Selections Page
// =============================================================================

export default function KitchenSelectionsPage() {
  const router = useRouter();
  const { developmentId } = useDevelopment();
  
  const [units, setUnits] = useState<KitchenUnit[]>(mockUnits);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'complete' | 'pending'>('all');
  const [showSettings, setShowSettings] = useState(false);
  const [options, setOptions] = useState<SelectionOptions>(defaultOptions);

  // Calculate stats
  const stats = useMemo(() => {
    const total = units.length;
    const complete = units.filter((u) => u.status === 'complete').length;
    const pending = units.filter((u) => u.status === 'pending').length;
    const completionRate = total > 0 ? Math.round((complete / total) * 100) : 0;
    return { total, complete, pending, completionRate };
  }, [units]);

  // Filter units
  const filteredUnits = useMemo(() => {
    return units
      .filter((u) => {
        const matchesSearch =
          !searchQuery ||
          u.unitNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
          u.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
          u.purchaserName?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesTab =
          activeTab === 'all' ||
          (activeTab === 'complete' && u.status === 'complete') ||
          (activeTab === 'pending' && u.status === 'pending');
        return matchesSearch && matchesTab;
      })
      .sort((a, b) => naturalSort(a.unitNumber, b.unitNumber));
  }, [units, searchQuery, activeTab]);

  // Update unit field
  const updateUnit = (unitId: string, field: keyof KitchenUnit, value: any) => {
    setUnits((prev) =>
      prev.map((u) => {
        if (u.id !== unitId) return u;
        const updated = { ...u, [field]: value, updatedAt: new Date().toISOString().split('T')[0] };
        
        // Auto-calculate status
        const hasKitchenSelection = updated.hasKitchen !== null;
        const kitchenComplete = updated.hasKitchen === false || 
          (updated.hasKitchen === true && updated.counterType && updated.unitFinish && updated.handleStyle);
        const hasWardrobeSelection = updated.hasWardrobe !== null;
        const wardrobeComplete = updated.hasWardrobe === false ||
          (updated.hasWardrobe === true && updated.wardrobeStyle);
        
        updated.status = hasKitchenSelection && kitchenComplete && hasWardrobeSelection && wardrobeComplete
          ? 'complete'
          : 'pending';
        
        return updated;
      })
    );
  };

  return (
    <div className="min-h-full" style={{ backgroundColor: tokens.cream }}>
      {/* Header */}
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
                <h1 className="text-xl font-bold" style={{ color: tokens.dark }}>Kitchen Selections</h1>
                <p className="text-sm text-gray-500">{developmentId ? 'Selected Development' : 'All Developments'}</p>
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
                <button
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-xl transition-colors shadow-lg"
                  style={{ backgroundColor: tokens.gold }}
                >
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
          {/* Progress Overview */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold" style={{ color: tokens.dark }}>Selection Progress</h3>
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
                  background: stats.completionRate === 100
                    ? tokens.success
                    : `linear-gradient(to right, ${tokens.gold}, ${tokens.goldLight})`,
                }}
              />
            </div>
          </div>

          {/* Filters & Search */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl">
              {(['all', 'complete', 'pending'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                    activeTab === tab
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab === 'all' ? 'All Units' : tab === 'complete' ? 'Complete' : 'Pending'}
                  <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded ${
                    activeTab === tab ? 'bg-gray-100' : 'bg-gray-200/50'
                  }`}>
                    {tab === 'all' ? stats.total : tab === 'complete' ? stats.complete : stats.pending}
                  </span>
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

          {/* Table */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr style={{ backgroundColor: tokens.warmGray }}>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">Address</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">Purchaser</th>
                    <th className="text-center px-2 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 border-l border-gray-100">Kitchen</th>
                    <th className="text-left px-2 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 border-l border-gray-100">Counter</th>
                    <th className="text-left px-2 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 border-l border-gray-100">Units</th>
                    <th className="text-left px-2 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 border-l border-gray-100">Handle</th>
                    <th className="text-center px-2 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 border-l border-gray-100">Wardrobe</th>
                    <th className="text-left px-2 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 border-l border-gray-100">Style</th>
                    <th className="text-center px-3 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 border-l border-gray-100">Status</th>
                    <th className="text-center px-3 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 border-l border-gray-100">Updated</th>
                    <th className="text-center px-3 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 border-l border-gray-100">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUnits.map((unit, idx) => (
                    <tr
                      key={unit.id}
                      className="hover:bg-amber-50/30 transition-colors group"
                      style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa' }}
                    >
                      {/* Address */}
                      <td className="px-4 border-b border-gray-100">
                        <div className="h-14 flex flex-col justify-center">
                          <p className="text-sm font-semibold" style={{ color: tokens.dark }}>{unit.address}</p>
                          <p className="text-xs text-gray-400">Unit {unit.unitNumber}</p>
                        </div>
                      </td>
                      
                      {/* Purchaser */}
                      <td className="px-4 border-b border-gray-100">
                        <div className="h-14 flex items-center">
                          <span className={`text-sm ${unit.purchaserName ? 'text-gray-700' : 'text-gray-300'}`}>
                            {unit.purchaserName || '—'}
                          </span>
                        </div>
                      </td>

                      {/* Kitchen Y/N */}
                      <td className="border-b border-gray-100 border-l">
                        <YesNoToggle
                          value={unit.hasKitchen}
                          onChange={(val) => updateUnit(unit.id, 'hasKitchen', val)}
                        />
                      </td>

                      {/* Counter */}
                      <td className="border-b border-gray-100 border-l">
                        <InlineDropdown
                          value={unit.counterType}
                          options={options.counterTypes}
                          onChange={(val) => updateUnit(unit.id, 'counterType', val)}
                          disabled={unit.hasKitchen !== true}
                        />
                      </td>

                      {/* Units (Finish) */}
                      <td className="border-b border-gray-100 border-l">
                        <InlineDropdown
                          value={unit.unitFinish}
                          options={options.unitFinishes}
                          onChange={(val) => updateUnit(unit.id, 'unitFinish', val)}
                          disabled={unit.hasKitchen !== true}
                        />
                      </td>

                      {/* Handle */}
                      <td className="border-b border-gray-100 border-l">
                        <InlineDropdown
                          value={unit.handleStyle}
                          options={options.handleStyles}
                          onChange={(val) => updateUnit(unit.id, 'handleStyle', val)}
                          disabled={unit.hasKitchen !== true}
                        />
                      </td>

                      {/* Wardrobe Y/N */}
                      <td className="border-b border-gray-100 border-l">
                        <YesNoToggle
                          value={unit.hasWardrobe}
                          onChange={(val) => updateUnit(unit.id, 'hasWardrobe', val)}
                        />
                      </td>

                      {/* Wardrobe Style */}
                      <td className="border-b border-gray-100 border-l">
                        <InlineDropdown
                          value={unit.wardrobeStyle}
                          options={options.wardrobeStyles}
                          onChange={(val) => updateUnit(unit.id, 'wardrobeStyle', val)}
                          disabled={unit.hasWardrobe !== true}
                        />
                      </td>

                      {/* Status */}
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

                      {/* Updated */}
                      <td className="border-b border-gray-100 border-l">
                        <div className="h-14 flex items-center justify-center">
                          <span className="text-xs text-gray-400">{formatDate(unit.updatedAt)}</span>
                        </div>
                      </td>

                      {/* Notes */}
                      <td className="border-b border-gray-100 border-l">
                        <div className="h-14 flex items-center justify-center">
                          <button className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors group/btn">
                            {unit.commentsCount > 0 ? (
                              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-blue-50 border border-blue-200">
                                <MessageCircle className="w-3.5 h-3.5 text-blue-600" />
                                <span className="text-xs font-semibold text-blue-700">{unit.commentsCount}</span>
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

      {/* Settings Modal */}
      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        options={options}
        onSave={setOptions}
      />
    </div>
  );
}
