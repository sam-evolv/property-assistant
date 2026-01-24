'use client';

import { useState, useEffect } from 'react';
import { Check, ChevronDown, ChevronUp, Calendar, Home, AlertCircle, Loader2 } from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

interface Unit {
  id: string;
  unit_uid?: string;
  unit_code?: string;
  address: string;
  purchaser_name?: string;
  house_type?: string;
  bedrooms?: number;
  handover_complete: boolean;
  current_milestone: string;
  milestone_dates: Record<string, string>;
  est_snagging_date?: string | null;
  est_handover_date?: string | null;
}

const MILESTONE_ORDER = [
  'sale_agreed',
  'contracts_signed',
  'kitchen_selection',
  'snagging',
  'closing',
  'handover',
] as const;

const MILESTONE_LABELS: Record<string, string> = {
  sale_agreed: 'Sale Agreed',
  contracts_signed: 'Contracts Signed',
  kitchen_selection: 'Kitchen Selection',
  snagging: 'Snagging',
  closing: 'Closing',
  handover: 'Handover',
};

interface UnitHandoverStatusProps {
  developmentId: string;
  onUnitUpdated?: () => void;
}

// =============================================================================
// Main Component
// =============================================================================

export function UnitHandoverStatus({ developmentId, onUnitUpdated }: UnitHandoverStatusProps) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedUnitId, setExpandedUnitId] = useState<string | null>(null);
  const [savingUnitId, setSavingUnitId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'complete'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch units for this development
  useEffect(() => {
    if (!developmentId) return;

    const fetchUnits = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/developments/${developmentId}/units`);
        if (!res.ok) throw new Error('Failed to fetch units');
        const data = await res.json();
        setUnits(data.units || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load units');
      } finally {
        setLoading(false);
      }
    };

    fetchUnits();
  }, [developmentId]);

  // Update unit milestone
  const updateUnit = async (unitId: string, updates: Partial<Unit>) => {
    setSavingUnitId(unitId);
    try {
      const res = await fetch(`/api/units/${unitId}/prehandover`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!res.ok) throw new Error('Failed to update unit');

      // Update local state
      setUnits((prev) =>
        prev.map((u) => (u.id === unitId ? { ...u, ...updates } : u))
      );

      onUnitUpdated?.();
    } catch (err: any) {
      console.error('Failed to update unit:', err);
      alert('Failed to update unit. Please try again.');
    } finally {
      setSavingUnitId(null);
    }
  };

  // Toggle milestone completion
  const toggleMilestone = async (unit: Unit, milestone: string) => {
    const currentIndex = MILESTONE_ORDER.indexOf(
      unit.current_milestone as (typeof MILESTONE_ORDER)[number]
    );
    const targetIndex = MILESTONE_ORDER.indexOf(
      milestone as (typeof MILESTONE_ORDER)[number]
    );

    // Moving forward to this milestone
    if (targetIndex > currentIndex) {
      // Mark all milestones up to and including target as complete
      const newDates = { ...unit.milestone_dates };
      for (let i = currentIndex + 1; i <= targetIndex; i++) {
        const ms = MILESTONE_ORDER[i];
        if (!newDates[ms]) {
          newDates[ms] = new Date().toISOString().split('T')[0];
        }
      }

      const updates: Partial<Unit> = {
        current_milestone: milestone,
        milestone_dates: newDates,
      };

      // If completing handover, mark as complete
      if (milestone === 'handover') {
        updates.handover_complete = true;
      }

      await updateUnit(unit.id, updates);
    } else if (targetIndex < currentIndex) {
      // Moving back - reset to this milestone
      const newDates = { ...unit.milestone_dates };
      // Remove dates for milestones after target
      for (let i = targetIndex + 1; i < MILESTONE_ORDER.length; i++) {
        delete newDates[MILESTONE_ORDER[i]];
      }

      await updateUnit(unit.id, {
        current_milestone: milestone,
        milestone_dates: newDates,
        handover_complete: false,
      });
    }
  };

  // Update estimated date
  const updateEstDate = async (
    unit: Unit,
    field: 'est_snagging_date' | 'est_handover_date',
    value: string
  ) => {
    await updateUnit(unit.id, { [field]: value || null });
  };

  // Calculate progress percentage for a unit
  const getProgressPercent = (unit: Unit) => {
    const idx = MILESTONE_ORDER.indexOf(
      unit.current_milestone as (typeof MILESTONE_ORDER)[number]
    );
    return Math.round(((idx + 1) / MILESTONE_ORDER.length) * 100);
  };

  // Filter units
  const filteredUnits = units.filter((unit) => {
    // Filter by status
    if (filterStatus === 'complete' && !unit.handover_complete) return false;
    if (filterStatus === 'pending' && unit.handover_complete) return false;

    // Filter by search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        unit.address?.toLowerCase().includes(term) ||
        unit.purchaser_name?.toLowerCase().includes(term) ||
        unit.unit_uid?.toLowerCase().includes(term) ||
        unit.unit_code?.toLowerCase().includes(term)
      );
    }

    return true;
  });

  // Stats
  const stats = {
    total: units.length,
    complete: units.filter((u) => u.handover_complete).length,
    pending: units.filter((u) => !u.handover_complete).length,
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-gold-500 mx-auto mb-4" />
        <p className="text-gray-500">Loading units...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-4" />
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Units</p>
          <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Handed Over</p>
          <p className="text-2xl font-semibold text-emerald-600">{stats.complete}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">In Progress</p>
          <p className="text-2xl font-semibold text-gold-600">{stats.pending}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by address, name, or unit code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'pending', 'complete'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === status
                  ? 'bg-gold-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {status === 'all' ? 'All' : status === 'pending' ? 'In Progress' : 'Complete'}
            </button>
          ))}
        </div>
      </div>

      {/* Unit List */}
      <div className="space-y-3">
        {filteredUnits.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <Home className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No units found</p>
          </div>
        ) : (
          filteredUnits.map((unit) => (
            <div
              key={unit.id}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            >
              {/* Unit Header */}
              <button
                onClick={() =>
                  setExpandedUnitId(expandedUnitId === unit.id ? null : unit.id)
                }
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      unit.handover_complete
                        ? 'bg-emerald-100 text-emerald-600'
                        : 'bg-gold-100 text-gold-600'
                    }`}
                  >
                    {unit.handover_complete ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <Home className="w-5 h-5" />
                    )}
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-900">
                      {unit.address || unit.unit_code || unit.unit_uid}
                    </p>
                    <p className="text-sm text-gray-500">
                      {unit.purchaser_name || 'No purchaser'}
                      {unit.house_type && ` · ${unit.house_type}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-medium text-gray-900">
                      {MILESTONE_LABELS[unit.current_milestone] || 'Unknown'}
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            unit.handover_complete ? 'bg-emerald-500' : 'bg-gold-500'
                          }`}
                          style={{ width: `${getProgressPercent(unit)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400">
                        {getProgressPercent(unit)}%
                      </span>
                    </div>
                  </div>
                  {expandedUnitId === unit.id ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </button>

              {/* Expanded Details */}
              {expandedUnitId === unit.id && (
                <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/50">
                  {/* Milestone Progress */}
                  <div className="mb-6">
                    <p className="text-sm font-medium text-gray-700 mb-3">
                      Milestone Progress
                    </p>
                    <div className="flex items-center gap-2">
                      {MILESTONE_ORDER.map((milestone, idx) => {
                        const currentIdx = MILESTONE_ORDER.indexOf(
                          unit.current_milestone as (typeof MILESTONE_ORDER)[number]
                        );
                        const isComplete = idx <= currentIdx;
                        const isCurrent = idx === currentIdx;
                        const date = unit.milestone_dates?.[milestone];

                        return (
                          <div key={milestone} className="flex-1">
                            <button
                              onClick={() => toggleMilestone(unit, milestone)}
                              disabled={savingUnitId === unit.id}
                              className={`w-full aspect-square rounded-lg flex items-center justify-center text-xs font-medium transition-all ${
                                isComplete
                                  ? isCurrent
                                    ? 'bg-gold-500 text-white shadow-md'
                                    : 'bg-emerald-500 text-white'
                                  : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                              } ${savingUnitId === unit.id ? 'opacity-50' : ''}`}
                              title={`${MILESTONE_LABELS[milestone]}${
                                date ? ` - ${new Date(date).toLocaleDateString()}` : ''
                              }`}
                            >
                              {isComplete && !isCurrent ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                idx + 1
                              )}
                            </button>
                            <p className="text-[10px] text-center mt-1 text-gray-500 truncate">
                              {MILESTONE_LABELS[milestone]}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Estimated Dates */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <Calendar className="w-4 h-4 inline mr-1" />
                        Est. Snagging Date
                      </label>
                      <input
                        type="date"
                        value={unit.est_snagging_date || ''}
                        onChange={(e) =>
                          updateEstDate(unit, 'est_snagging_date', e.target.value)
                        }
                        disabled={savingUnitId === unit.id}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <Home className="w-4 h-4 inline mr-1" />
                        Est. Handover Date
                      </label>
                      <input
                        type="date"
                        value={unit.est_handover_date || ''}
                        onChange={(e) =>
                          updateEstDate(unit, 'est_handover_date', e.target.value)
                        }
                        disabled={savingUnitId === unit.id}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="mt-4 flex justify-end gap-3">
                    {!unit.handover_complete ? (
                      <button
                        onClick={() =>
                          updateUnit(unit.id, {
                            current_milestone: 'handover',
                            handover_complete: true,
                            milestone_dates: {
                              ...unit.milestone_dates,
                              handover: new Date().toISOString().split('T')[0],
                            },
                          })
                        }
                        disabled={savingUnitId === unit.id}
                        className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50"
                      >
                        {savingUnitId === unit.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Mark as Handed Over'
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                          updateUnit(unit.id, {
                            current_milestone: 'closing',
                            handover_complete: false,
                          })
                        }
                        disabled={savingUnitId === unit.id}
                        className="px-4 py-2 bg-gray-500 text-white rounded-lg text-sm font-medium hover:bg-gray-600 transition-colors disabled:opacity-50"
                      >
                        Revert Handover
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
