'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ChefHat,
  Download,
  Upload,
  Search,
  Check,
  X,
  RefreshCw,
  TrendingDown,
} from 'lucide-react';

const tokens = {
  gold: '#D4AF37',
  goldDark: '#B8934C',
  dark: '#111827',
  success: '#22c55e',
  danger: '#ef4444',
};

const COUNTER_OPTIONS = [
  { code: 'CT1', label: 'Show House Counter' },
  { code: 'CT2', label: 'White with Gold/Black Vein' },
  { code: 'CT3', label: 'Wood' },
  { code: 'CT4', label: 'Black/Yellow' },
  { code: 'CT5', label: 'Grey Counter' },
  { code: 'CT6', label: 'White with Brown Vein' },
];

const CABINET_OPTIONS = ['Green', 'Charcoal', 'Navy', 'White', 'Dust Grey', 'Light Grey'];

const HANDLE_OPTIONS = Array.from({ length: 16 }, (_, i) => `H${i + 1}`);

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
  cabinetColor: string | null;
  handleStyle: string | null;
  hasWardrobe: boolean | null;
  notes: string | null;
  kitchenDate: string | null;
  status: 'complete' | 'pending' | 'none';
  pcSumKitchen: number;
  pcSumWardrobes: number;
  pcSumTotal: number;
}

interface Development {
  id: string;
  name: string;
  code: string;
}

interface Summary {
  total: number;
  decided: number;
  takingKitchen: number;
  takingOwnKitchen: number;
  pending: number;
  totalPcSumImpact: number;
  unitsWithDeductions: number;
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

export default function KitchenSelectionsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const developmentId = params.developmentId as string;
  const highlightUnitId = searchParams.get('unit');

  const [development, setDevelopment] = useState<Development | null>(null);
  const [units, setUnits] = useState<KitchenUnit[]>([]);
  const [summary, setSummary] = useState<Summary>({ total: 0, decided: 0, takingKitchen: 0, takingOwnKitchen: 0, pending: 0, totalPcSumImpact: 0, unitsWithDeductions: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast] = useState({ message: '', visible: false });

  const showToast = useCallback((message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 2000);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(`/api/kitchen-selections/${developmentId}`);
      if (!response.ok) throw new Error('Failed to fetch data');
      const data = await response.json();
      setDevelopment(data.development);
      setUnits(data.units || []);
      setSummary(data.summary || { total: 0, decided: 0, takingKitchen: 0, takingOwnKitchen: 0, pending: 0, totalPcSumImpact: 0, unitsWithDeductions: 0 });
    } catch (err) {
      console.error('Error fetching kitchen selections:', err);
    } finally {
      setIsLoading(false);
    }
  }, [developmentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (highlightUnitId && units.length > 0) {
      const element = document.getElementById(`unit-${highlightUnitId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('ring-2', 'ring-amber-400');
        setTimeout(() => element.classList.remove('ring-2', 'ring-amber-400'), 3000);
      }
    }
  }, [highlightUnitId, units]);

  const handleUpdate = async (unitId: string, field: string, value: any) => {
    setUnits(prev =>
      prev.map(u => (u.unitId === unitId ? { ...u, [field]: value } : u))
    );

    setSaving(unitId);
    try {
      const response = await fetch(`/api/kitchen-selections/${developmentId}/${unitId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      if (!response.ok) throw new Error('Failed to save');
      const data = await response.json();
      
      if (data.selection) {
        setUnits(prev =>
          prev.map(u => u.unitId === unitId ? {
            ...u,
            pcSumKitchen: data.selection.pcSumKitchen || 0,
            pcSumWardrobes: data.selection.pcSumWardrobes || 0,
            pcSumTotal: data.selection.pcSumTotal || 0,
          } : u)
        );
        
        const newTotal = units.reduce((sum, u) => {
          if (u.unitId === unitId) {
            return sum + (data.selection.pcSumTotal || 0);
          }
          return sum + u.pcSumTotal;
        }, 0);
        setSummary(prev => ({ ...prev, totalPcSumImpact: newTotal }));
      }
      
      showToast('Saved');
    } catch (err) {
      console.error('Error saving:', err);
      showToast('Failed to save');
    } finally {
      setSaving(null);
    }
  };

  const filteredUnits = units.filter(u => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      u.unitNumber.toLowerCase().includes(query) ||
      u.purchaserName?.toLowerCase().includes(query)
    );
  });

  const stats = {
    total: units.length,
    decided: units.filter(u => u.hasKitchen !== null || u.hasWardrobe !== null).length,
    complete: units.filter(u => u.status === 'complete').length,
    withKitchen: units.filter(u => u.hasKitchen === true).length,
    takingOwn: units.filter(u => u.hasKitchen === false).length,
    withWardrobes: units.filter(u => u.hasWardrobe === true).length,
    unitsWithDeductions: units.filter(u => u.pcSumTotal < 0).length,
    totalPcSumImpact: units.reduce((acc, u) => acc + (u.pcSumTotal || 0), 0),
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <button
          onClick={() => router.push(`/developer/pipeline/${developmentId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Sales Pipeline
        </button>

        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${tokens.gold}20 0%, ${tokens.gold}10 100%)` }}
            >
              <ChefHat className="w-6 h-6" style={{ color: tokens.gold }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Kitchen Selections</h1>
              <p className="text-sm text-gray-500">{development?.name} · {units.length} units</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Import
            </button>
            <button className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Selection Progress</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.decided} of {stats.total}</p>
            <p className="text-xs text-gray-500 mt-0.5">({stats.total > 0 ? Math.round((stats.decided / stats.total) * 100) : 0}% complete)</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-500" />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Taking Kitchen</p>
            </div>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.withKitchen}</p>
            <p className="text-xs text-gray-500 mt-0.5">({stats.decided > 0 ? Math.round((stats.withKitchen / stats.decided) * 100) : 0}% of decided)</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2">
              <X className="w-4 h-4 text-red-500" />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Taking Own</p>
            </div>
            <p className="text-2xl font-bold text-red-600 mt-1">{stats.takingOwn}</p>
            <p className="text-xs text-gray-500 mt-0.5">({stats.decided > 0 ? Math.round((stats.takingOwn / stats.decided) * 100) : 0}% of decided)</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">PC Sum Deductions</p>
                <p className={`text-2xl font-bold mt-1 ${stats.totalPcSumImpact < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {formatCurrency(stats.totalPcSumImpact)}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">({stats.unitsWithDeductions} units)</p>
              </div>
              {stats.totalPcSumImpact < 0 && (
                <TrendingDown className="w-5 h-5 text-red-500" />
              )}
            </div>
          </div>
        </div>

        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by unit or purchaser..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400"
            />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Unit</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Purchaser</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Kitchen</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Counter Top</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Cabinet Color</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Handle</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Wardrobes</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">PC Sum</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[180px]">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUnits.map((unit) => (
                  <tr
                    key={unit.unitId}
                    id={`unit-${unit.unitId}`}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div>
                        <span className="text-sm font-bold text-gray-900">{unit.unitNumber}</span>
                        {unit.houseType && (
                          <span className="ml-2 px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-600 rounded">
                            {unit.houseType}
                          </span>
                        )}
                        <span className="ml-1 text-[10px] text-gray-400">{unit.bedrooms} bed</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm ${unit.purchaserName ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
                        {unit.purchaserName || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        <button
                          onClick={() => handleUpdate(unit.unitId, 'hasKitchen', unit.hasKitchen === true ? false : true)}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                            unit.hasKitchen === true
                              ? 'bg-emerald-500 text-white'
                              : unit.hasKitchen === false
                              ? 'bg-red-500 text-white'
                              : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                          }`}
                        >
                          {unit.hasKitchen === true ? <Check className="w-4 h-4" /> : unit.hasKitchen === false ? <X className="w-4 h-4" /> : '?'}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={unit.counterType || ''}
                        onChange={(e) => handleUpdate(unit.unitId, 'counterType', e.target.value || null)}
                        disabled={unit.hasKitchen === false}
                        className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400 disabled:bg-gray-50 disabled:text-gray-400"
                      >
                        <option value="">Select...</option>
                        {COUNTER_OPTIONS.map((opt) => (
                          <option key={opt.code} value={opt.code}>
                            {opt.code} - {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={unit.cabinetColor || ''}
                        onChange={(e) => handleUpdate(unit.unitId, 'cabinetColor', e.target.value || null)}
                        disabled={unit.hasKitchen === false}
                        className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400 disabled:bg-gray-50 disabled:text-gray-400"
                      >
                        <option value="">Select...</option>
                        {CABINET_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={unit.handleStyle || ''}
                        onChange={(e) => handleUpdate(unit.unitId, 'handleStyle', e.target.value || null)}
                        disabled={unit.hasKitchen === false}
                        className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400 disabled:bg-gray-50 disabled:text-gray-400"
                      >
                        <option value="">Select...</option>
                        {HANDLE_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        <button
                          onClick={() => handleUpdate(unit.unitId, 'hasWardrobe', unit.hasWardrobe === true ? false : true)}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                            unit.hasWardrobe === true
                              ? 'bg-emerald-500 text-white'
                              : unit.hasWardrobe === false
                              ? 'bg-red-500 text-white'
                              : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                          }`}
                        >
                          {unit.hasWardrobe === true ? <Check className="w-4 h-4" /> : unit.hasWardrobe === false ? <X className="w-4 h-4" /> : '?'}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
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
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={unit.notes || ''}
                        onChange={(e) => handleUpdate(unit.unitId, 'notes', e.target.value || null)}
                        placeholder="Add notes..."
                        className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400"
                        title={unit.notes || ''}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredUnits.length === 0 && (
              <div className="px-6 py-16 text-center">
                <ChefHat className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-sm text-gray-500">
                  {searchQuery ? 'No units match your search.' : 'No units found for this development.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {toast.visible && (
        <div
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl bg-gray-900 text-white shadow-xl"
        >
          <Check className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
