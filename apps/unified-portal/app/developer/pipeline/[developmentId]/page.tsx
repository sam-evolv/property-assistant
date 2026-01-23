'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  AlertCircle,
  Plus,
  X,
  Check,
  Search,
  Loader2,
  ChevronDown,
  Calendar,
  Users,
  Home,
  CheckCircle2,
  Clock,
  Filter,
  MoreHorizontal,
  Mail,
  Download,
  GripVertical,
  Building,
  FileText,
  Pencil,
  LayoutGrid,
  List,
} from 'lucide-react';

// ============================================================================
// Design Tokens (from brief)
// ============================================================================
const tokens = {
  colors: {
    bg: {
      page: '#f5f5f5',
      card: '#ffffff',
      subtle: '#f9f9f9',
      hover: '#fafafa',
    },
    border: {
      light: '#f0f0f0',
      default: '#e5e5e5',
      hover: '#d0d0d0',
    },
    text: {
      primary: '#1a1a1a',
      secondary: '#666666',
      muted: '#999999',
    },
    accent: {
      amber: '#f5b800',
      amberHover: '#e5ac00',
      amberLight: '#fef9e7',
    },
    status: {
      success: '#10b981',
      successLight: '#ecfdf5',
      error: '#ef4444',
      errorLight: '#fef2f2',
      warning: '#f59e0b',
      warningLight: '#fffbeb',
      info: '#3b82f6',
      infoLight: '#eff6ff',
    },
  },
};

// ============================================================================
// Types
// ============================================================================

type PipelineStage = 'available' | 'reserved' | 'contracts_out' | 'signed' | 'complete';

interface PipelineUnit {
  id: string;
  pipelineId: string | null;
  unitNumber: string;
  address: string;
  houseTypeCode: string;
  purchaserName: string | null;
  purchaserEmail: string | null;
  purchaserPhone: string | null;
  stage: PipelineStage;
  daysInStage: number;
  mortgageExpiry: string | null;
  releaseDate: string | null;
  saleAgreedDate: string | null;
  depositDate: string | null;
  contractsIssuedDate: string | null;
  signedContractsDate: string | null;
  counterSignedDate: string | null;
  handoverDate: string | null;
}

interface Development {
  id: string;
  name: string;
  code: string;
  address: string;
}

// ============================================================================
// Pipeline Stage Configuration
// ============================================================================

const PIPELINE_STAGES: { key: PipelineStage; label: string; color: string; bgColor: string }[] = [
  { key: 'available', label: 'Available', color: tokens.colors.text.muted, bgColor: tokens.colors.bg.subtle },
  { key: 'reserved', label: 'Reserved', color: tokens.colors.status.info, bgColor: tokens.colors.status.infoLight },
  { key: 'contracts_out', label: 'Contracts Out', color: tokens.colors.status.warning, bgColor: tokens.colors.status.warningLight },
  { key: 'signed', label: 'Signed', color: tokens.colors.status.success, bgColor: tokens.colors.status.successLight },
  { key: 'complete', label: 'Complete', color: '#059669', bgColor: '#d1fae5' },
];

// ============================================================================
// Utility Functions
// ============================================================================

function deriveStageFromUnit(unit: any): PipelineStage {
  if (unit.handoverDate) return 'complete';
  if (unit.signedContractsDate || unit.counterSignedDate) return 'signed';
  if (unit.contractsIssuedDate) return 'contracts_out';
  if (unit.saleAgreedDate || unit.depositDate) return 'reserved';
  if (unit.releaseDate) return 'available';
  return 'available';
}

function calculateDaysInStage(unit: any): number {
  const stage = deriveStageFromUnit(unit);
  let stageDate: string | null = null;

  switch (stage) {
    case 'complete':
      stageDate = unit.handoverDate;
      break;
    case 'signed':
      stageDate = unit.counterSignedDate || unit.signedContractsDate;
      break;
    case 'contracts_out':
      stageDate = unit.contractsIssuedDate;
      break;
    case 'reserved':
      stageDate = unit.depositDate || unit.saleAgreedDate;
      break;
    case 'available':
      stageDate = unit.releaseDate;
      break;
  }

  if (!stageDate) return 0;
  const date = new Date(stageDate);
  const now = new Date();
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });
}

// ============================================================================
// Stat Card Component
// ============================================================================

interface StatCardProps {
  label: string;
  value: number | string;
  change?: string;
  icon: React.ReactNode;
  color?: string;
}

function StatCard({ label, value, change, icon, color = tokens.colors.text.primary }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-[#e5e5e5] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-semibold text-[#999999] uppercase tracking-[0.04em]">
          {label}
        </span>
        <div className="text-[#999999]">{icon}</div>
      </div>
      <div className="flex items-end justify-between">
        <span className="text-[28px] font-semibold tracking-[-0.02em]" style={{ color }}>
          {value}
        </span>
        {change && (
          <span className="text-xs font-medium text-[#10b981]">{change}</span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Unit Card Component (for Kanban view)
// ============================================================================

interface UnitCardProps {
  unit: PipelineUnit;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onClick: (unit: PipelineUnit) => void;
}

function UnitCard({ unit, isSelected, onSelect, onClick }: UnitCardProps) {
  const isOverdue = unit.daysInStage > 30;
  const isWarning = unit.daysInStage > 14 && unit.daysInStage <= 30;

  return (
    <div
      className={cn(
        'bg-white rounded-lg border p-3 cursor-pointer transition-all',
        isSelected
          ? 'border-[#f5b800] ring-2 ring-[#f5b800]/20'
          : 'border-[#e5e5e5] hover:border-[#d0d0d0] hover:shadow-md'
      )}
      onClick={() => onClick(unit)}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onSelect(unit.id);
            }}
            className="w-4 h-4 rounded border-[#d0d0d0] text-[#f5b800] focus:ring-[#f5b800]"
          />
          <span className="text-sm font-semibold text-[#1a1a1a]">
            Unit {unit.unitNumber}
          </span>
        </div>
        <span className="text-[11px] font-medium text-[#999999] bg-[#f5f5f5] px-2 py-0.5 rounded">
          {unit.houseTypeCode}
        </span>
      </div>

      {unit.purchaserName && (
        <p className="text-sm text-[#666666] mb-2 truncate">
          {unit.purchaserName}
        </p>
      )}

      <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#f0f0f0]">
        <span
          className={cn(
            'text-xs font-medium',
            isOverdue
              ? 'text-[#ef4444]'
              : isWarning
              ? 'text-[#f59e0b]'
              : 'text-[#999999]'
          )}
        >
          {unit.daysInStage > 0 ? `${unit.daysInStage} days` : 'New'}
        </span>
        {unit.mortgageExpiry && (
          <div className="flex items-center gap-1 text-xs text-[#f59e0b]">
            <AlertCircle className="w-3 h-3" />
            <span>Expires {formatDate(unit.mortgageExpiry)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Kanban Column Component
// ============================================================================

interface KanbanColumnProps {
  stage: typeof PIPELINE_STAGES[number];
  units: PipelineUnit[];
  selectedIds: Set<string>;
  onSelectUnit: (id: string) => void;
  onUnitClick: (unit: PipelineUnit) => void;
}

function KanbanColumn({ stage, units, selectedIds, onSelectUnit, onUnitClick }: KanbanColumnProps) {
  return (
    <div className="flex-1 min-w-[280px] max-w-[320px]">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span
            className="text-sm font-semibold"
            style={{ color: stage.color }}
          >
            {stage.label}
          </span>
          <span className="text-xs font-medium text-[#999999] bg-[#f5f5f5] px-2 py-0.5 rounded-full">
            {units.length}
          </span>
        </div>
      </div>

      <div
        className="rounded-xl p-2 min-h-[400px] space-y-2"
        style={{ backgroundColor: stage.bgColor }}
      >
        {units.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-10 h-10 rounded-full bg-white/50 flex items-center justify-center mb-2">
              <Building className="w-5 h-5 text-[#999999]" />
            </div>
            <p className="text-xs text-[#999999]">No units in this stage</p>
          </div>
        ) : (
          units.map((unit) => (
            <UnitCard
              key={unit.id}
              unit={unit}
              isSelected={selectedIds.has(unit.id)}
              onSelect={onSelectUnit}
              onClick={onUnitClick}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Table View Component
// ============================================================================

interface TableViewProps {
  units: PipelineUnit[];
  selectedIds: Set<string>;
  onSelectUnit: (id: string) => void;
  onSelectAll: () => void;
  onUnitClick: (unit: PipelineUnit) => void;
}

function TableView({ units, selectedIds, onSelectUnit, onSelectAll, onUnitClick }: TableViewProps) {
  const allSelected = units.length > 0 && selectedIds.size === units.length;

  return (
    <div className="bg-white rounded-xl border border-[#e5e5e5] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#e5e5e5] bg-[#f9f9f9]">
            <th className="w-12 px-4 py-3 text-left">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onSelectAll}
                className="w-4 h-4 rounded border-[#d0d0d0] text-[#f5b800] focus:ring-[#f5b800]"
              />
            </th>
            <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#999999] uppercase tracking-[0.04em]">
              Unit
            </th>
            <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#999999] uppercase tracking-[0.04em]">
              Purchaser
            </th>
            <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#999999] uppercase tracking-[0.04em]">
              Stage
            </th>
            <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#999999] uppercase tracking-[0.04em]">
              Days in Stage
            </th>
            <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#999999] uppercase tracking-[0.04em]">
              Type
            </th>
            <th className="w-12"></th>
          </tr>
        </thead>
        <tbody>
          {units.map((unit) => {
            const stageConfig = PIPELINE_STAGES.find((s) => s.key === unit.stage);
            const isOverdue = unit.daysInStage > 30;
            const isWarning = unit.daysInStage > 14 && unit.daysInStage <= 30;

            return (
              <tr
                key={unit.id}
                className={cn(
                  'border-b border-[#f0f0f0] hover:bg-[#fafafa] cursor-pointer transition-colors',
                  selectedIds.has(unit.id) && 'bg-[#fef9e7]'
                )}
                onClick={() => onUnitClick(unit)}
              >
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(unit.id)}
                    onChange={() => onSelectUnit(unit.id)}
                    className="w-4 h-4 rounded border-[#d0d0d0] text-[#f5b800] focus:ring-[#f5b800]"
                  />
                </td>
                <td className="px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-[#1a1a1a]">Unit {unit.unitNumber}</p>
                    <p className="text-xs text-[#999999] truncate max-w-[200px]">{unit.address}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm text-[#666666]">
                    {unit.purchaserName || <span className="text-[#999999]">—</span>}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <span
                    className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: stageConfig?.bgColor,
                      color: stageConfig?.color,
                    }}
                  >
                    {stageConfig?.label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      'text-sm font-medium',
                      isOverdue
                        ? 'text-[#ef4444]'
                        : isWarning
                        ? 'text-[#f59e0b]'
                        : 'text-[#666666]'
                    )}
                  >
                    {unit.daysInStage > 0 ? `${unit.daysInStage} days` : '—'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-[#666666]">{unit.houseTypeCode}</span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onUnitClick(unit);
                    }}
                    className="p-1.5 text-[#999999] hover:text-[#666666] hover:bg-[#f5f5f5] rounded-lg transition-colors"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {units.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-full bg-[#f5f5f5] flex items-center justify-center mb-4">
            <Building className="w-8 h-8 text-[#999999]" />
          </div>
          <p className="text-sm font-medium text-[#666666]">No units in pipeline</p>
          <p className="text-xs text-[#999999] mt-1">Release units to start tracking</p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Bulk Actions Bar
// ============================================================================

interface BulkActionsBarProps {
  selectedCount: number;
  onClear: () => void;
  onSendEmail: () => void;
  onUpdateStage: () => void;
  onExport: () => void;
}

function BulkActionsBar({ selectedCount, onClear, onSendEmail, onUpdateStage, onExport }: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="bg-[#1a1a1a] text-white rounded-xl shadow-2xl px-4 py-3 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{selectedCount} selected</span>
          <button
            onClick={onClear}
            className="p-1 hover:bg-white/10 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="w-px h-6 bg-white/20" />
        <div className="flex items-center gap-1">
          <button
            onClick={onSendEmail}
            className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-white/10 rounded-lg transition-colors"
          >
            <Mail className="w-4 h-4" />
            <span>Send Email</span>
          </button>
          <button
            onClick={onUpdateStage}
            className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-white/10 rounded-lg transition-colors"
          >
            <Pencil className="w-4 h-4" />
            <span>Update Stage</span>
          </button>
          <button
            onClick={onExport}
            className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-white/10 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Release Units Modal
// ============================================================================

interface ReleaseUnitsModalProps {
  units: PipelineUnit[];
  developmentId: string;
  onClose: () => void;
  onReleased: () => void;
}

function ReleaseUnitsModal({ units, developmentId, onClose, onReleased }: ReleaseUnitsModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unreleasedUnits = units.filter((u) => !u.releaseDate);

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const selectAll = () => {
    if (selectedIds.size === unreleasedUnits.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(unreleasedUnits.map((u) => u.id)));
    }
  };

  const handleRelease = async () => {
    if (selectedIds.size === 0) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/pipeline/${developmentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unitIds: Array.from(selectedIds) }),
      });
      if (response.ok) {
        onReleased();
        onClose();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to release units. Please try again.');
      }
    } catch (err) {
      console.error('Failed to release units:', err);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
          <div className="flex items-center justify-between px-6 py-5 border-b border-[#e5e5e5]">
            <div>
              <h2 className="text-lg font-semibold text-[#1a1a1a]">Release Units</h2>
              <p className="text-sm text-[#666666] mt-0.5">Select units to add to the pipeline</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-[#999999] hover:text-[#666666] hover:bg-[#f5f5f5] rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div className="mx-6 mt-4 p-3 bg-[#fef2f2] border border-[#fecaca] rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-[#ef4444] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-[#b91c1c]">{error}</p>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-6">
            {unreleasedUnits.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 rounded-full bg-[#ecfdf5] flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-6 h-6 text-[#10b981]" />
                </div>
                <p className="text-sm font-medium text-[#666666]">All units released</p>
                <p className="text-xs text-[#999999] mt-1">Every unit has been added to the pipeline</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-[#666666]">
                    {unreleasedUnits.length} unit{unreleasedUnits.length !== 1 ? 's' : ''} available
                  </p>
                  <button
                    onClick={selectAll}
                    className="text-sm font-medium text-[#f5b800] hover:text-[#e5ac00] transition-colors"
                  >
                    {selectedIds.size === unreleasedUnits.length ? 'Deselect all' : 'Select all'}
                  </button>
                </div>
                <div className="space-y-2">
                  {unreleasedUnits.map((unit) => (
                    <button
                      key={unit.id}
                      onClick={() => toggleSelect(unit.id)}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left',
                        selectedIds.has(unit.id)
                          ? 'border-[#f5b800] bg-[#fef9e7]'
                          : 'border-[#e5e5e5] hover:border-[#d0d0d0] hover:bg-[#f9f9f9]'
                      )}
                    >
                      <div
                        className={cn(
                          'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all',
                          selectedIds.has(unit.id)
                            ? 'border-[#f5b800] bg-[#f5b800]'
                            : 'border-[#d0d0d0]'
                        )}
                      >
                        {selectedIds.has(unit.id) && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#1a1a1a] truncate">{unit.address}</p>
                        <p className="text-xs text-[#666666]">
                          Unit {unit.unitNumber} · {unit.houseTypeCode}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {unreleasedUnits.length > 0 && (
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#e5e5e5] bg-[#f9f9f9]">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-[#666666] hover:bg-[#f0f0f0] rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRelease}
                disabled={selectedIds.size === 0 || isSubmitting}
                className={cn(
                  'px-5 py-2 text-sm font-medium rounded-lg transition-all',
                  selectedIds.size > 0 && !isSubmitting
                    ? 'bg-[#1a1a1a] text-white hover:bg-[#333333] shadow-sm'
                    : 'bg-[#e5e5e5] text-[#999999] cursor-not-allowed'
                )}
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Releasing...
                  </span>
                ) : (
                  `Release ${selectedIds.size > 0 ? `(${selectedIds.size})` : ''}`
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ============================================================================
// Unit Detail Slideover
// ============================================================================

interface UnitDetailSlideoverProps {
  unit: PipelineUnit | null;
  onClose: () => void;
  onUpdateStage: (unitId: string, stage: PipelineStage) => void;
}

function UnitDetailSlideover({ unit, onClose, onUpdateStage }: UnitDetailSlideoverProps) {
  if (!unit) return null;

  const stageConfig = PIPELINE_STAGES.find((s) => s.key === unit.stage);

  return (
    <>
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-50 overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-[#e5e5e5] px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#1a1a1a]">Unit {unit.unitNumber}</h2>
            <p className="text-sm text-[#666666]">{unit.houseTypeCode}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#999999] hover:text-[#666666] hover:bg-[#f5f5f5] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Current Stage */}
          <div>
            <h3 className="text-[11px] font-semibold text-[#999999] uppercase tracking-[0.04em] mb-3">
              Current Stage
            </h3>
            <span
              className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium"
              style={{
                backgroundColor: stageConfig?.bgColor,
                color: stageConfig?.color,
              }}
            >
              {stageConfig?.label}
            </span>
          </div>

          {/* Purchaser Info */}
          <div>
            <h3 className="text-[11px] font-semibold text-[#999999] uppercase tracking-[0.04em] mb-3">
              Purchaser
            </h3>
            {unit.purchaserName ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-[#1a1a1a]">{unit.purchaserName}</p>
                {unit.purchaserEmail && (
                  <p className="text-sm text-[#666666]">{unit.purchaserEmail}</p>
                )}
                {unit.purchaserPhone && (
                  <p className="text-sm text-[#666666]">{unit.purchaserPhone}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-[#999999]">No purchaser assigned</p>
            )}
          </div>

          {/* Timeline */}
          <div>
            <h3 className="text-[11px] font-semibold text-[#999999] uppercase tracking-[0.04em] mb-3">
              Timeline
            </h3>
            <div className="space-y-3">
              {unit.releaseDate && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#666666]">Released</span>
                  <span className="text-sm font-medium text-[#1a1a1a]">{formatDate(unit.releaseDate)}</span>
                </div>
              )}
              {unit.saleAgreedDate && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#666666]">Sale Agreed</span>
                  <span className="text-sm font-medium text-[#1a1a1a]">{formatDate(unit.saleAgreedDate)}</span>
                </div>
              )}
              {unit.depositDate && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#666666]">Deposit</span>
                  <span className="text-sm font-medium text-[#1a1a1a]">{formatDate(unit.depositDate)}</span>
                </div>
              )}
              {unit.contractsIssuedDate && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#666666]">Contracts Issued</span>
                  <span className="text-sm font-medium text-[#1a1a1a]">{formatDate(unit.contractsIssuedDate)}</span>
                </div>
              )}
              {unit.signedContractsDate && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#666666]">Signed</span>
                  <span className="text-sm font-medium text-[#1a1a1a]">{formatDate(unit.signedContractsDate)}</span>
                </div>
              )}
              {unit.handoverDate && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#666666]">Handover</span>
                  <span className="text-sm font-medium text-[#1a1a1a]">{formatDate(unit.handoverDate)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Change Stage */}
          <div>
            <h3 className="text-[11px] font-semibold text-[#999999] uppercase tracking-[0.04em] mb-3">
              Move to Stage
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {PIPELINE_STAGES.map((stage) => (
                <button
                  key={stage.key}
                  onClick={() => onUpdateStage(unit.id, stage.key)}
                  disabled={stage.key === unit.stage}
                  className={cn(
                    'px-3 py-2 text-sm font-medium rounded-lg border transition-all',
                    stage.key === unit.stage
                      ? 'border-[#e5e5e5] bg-[#f5f5f5] text-[#999999] cursor-not-allowed'
                      : 'border-[#e5e5e5] hover:border-[#d0d0d0] hover:bg-[#f9f9f9] text-[#666666]'
                  )}
                >
                  {stage.label}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-[#e5e5e5] space-y-2">
            <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1a1a1a] text-white text-sm font-medium rounded-lg hover:bg-[#333333] transition-colors">
              <Mail className="w-4 h-4" />
              Send Email
            </button>
            <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-[#e5e5e5] text-[#666666] text-sm font-medium rounded-lg hover:bg-[#f9f9f9] transition-colors">
              <FileText className="w-4 h-4" />
              View Documents
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function PipelineDevelopmentPage() {
  const params = useParams();
  const router = useRouter();
  const developmentId = params.developmentId as string;

  // State
  const [development, setDevelopment] = useState<Development | null>(null);
  const [units, setUnits] = useState<PipelineUnit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<PipelineStage | 'all'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<PipelineUnit | null>(null);

  // Fetch data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/pipeline/${developmentId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch pipeline data');
      }
      const data = await response.json();
      setDevelopment(data.development);

      // Transform units with derived stage and days
      const transformedUnits: PipelineUnit[] = data.units.map((unit: any) => ({
        ...unit,
        stage: deriveStageFromUnit(unit),
        daysInStage: calculateDaysInStage(unit),
      }));
      setUnits(transformedUnits);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [developmentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filtered units
  const filteredUnits = useMemo(() => {
    return units.filter((unit) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          unit.unitNumber.toLowerCase().includes(query) ||
          unit.address.toLowerCase().includes(query) ||
          unit.purchaserName?.toLowerCase().includes(query) ||
          unit.houseTypeCode.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Stage filter
      if (stageFilter !== 'all' && unit.stage !== stageFilter) {
        return false;
      }

      return true;
    });
  }, [units, searchQuery, stageFilter]);

  // Units grouped by stage (for Kanban view)
  const unitsByStage = useMemo(() => {
    const grouped: Record<PipelineStage, PipelineUnit[]> = {
      available: [],
      reserved: [],
      contracts_out: [],
      signed: [],
      complete: [],
    };

    filteredUnits.forEach((unit) => {
      grouped[unit.stage].push(unit);
    });

    return grouped;
  }, [filteredUnits]);

  // Stats
  const stats = useMemo(() => {
    const total = units.length;
    const released = units.filter((u) => u.releaseDate).length;
    const reserved = units.filter((u) => u.stage === 'reserved').length;
    const contractsOut = units.filter((u) => u.stage === 'contracts_out').length;
    const signed = units.filter((u) => u.stage === 'signed').length;
    const complete = units.filter((u) => u.stage === 'complete').length;

    return { total, released, reserved, contractsOut, signed, complete };
  }, [units]);

  // Selection handlers
  const toggleSelectUnit = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const selectAll = () => {
    if (selectedIds.size === filteredUnits.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredUnits.map((u) => u.id)));
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // Bulk action handlers
  const handleBulkEmail = () => {
    console.log('Send email to:', Array.from(selectedIds));
    // TODO: Implement email modal
  };

  const handleBulkUpdateStage = () => {
    console.log('Update stage for:', Array.from(selectedIds));
    // TODO: Implement stage update modal
  };

  const handleBulkExport = () => {
    console.log('Export:', Array.from(selectedIds));
    // TODO: Implement export
  };

  const handleUpdateUnitStage = (unitId: string, stage: PipelineStage) => {
    console.log('Update unit', unitId, 'to stage', stage);
    // TODO: Implement stage update API call
    setSelectedUnit(null);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-[#f5b800]" />
          <span className="text-[#666666]">Loading pipeline...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-[#fef2f2] flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-[#ef4444]" />
          </div>
          <h2 className="text-lg font-semibold text-[#1a1a1a] mb-2">Failed to load pipeline</h2>
          <p className="text-sm text-[#666666] mb-4">{error}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-[#1a1a1a] text-white text-sm font-medium rounded-lg hover:bg-[#333333] transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      {/* Header */}
      <div className="bg-white border-b border-[#e5e5e5] sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/developer/pipeline')}
                className="p-2 text-[#999999] hover:text-[#666666] hover:bg-[#f5f5f5] rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-[#1a1a1a]">
                  {development?.name || 'Pipeline'}
                </h1>
                <p className="text-sm text-[#666666]">
                  Track every unit from reservation to completion
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#666666] border border-[#e5e5e5] rounded-lg hover:bg-[#f9f9f9] transition-colors">
                <Download className="w-4 h-4" />
                Export
              </button>
              <button
                onClick={() => setShowReleaseModal(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#1a1a1a] text-white rounded-lg hover:bg-[#333333] transition-colors"
              >
                <Plus className="w-4 h-4" />
                Release Units
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard
            label="Total Units"
            value={stats.total}
            icon={<Home className="w-5 h-5" />}
          />
          <StatCard
            label="Available"
            value={unitsByStage.available.length}
            icon={<Building className="w-5 h-5" />}
          />
          <StatCard
            label="Reserved"
            value={stats.reserved}
            icon={<Users className="w-5 h-5" />}
            color={tokens.colors.status.info}
          />
          <StatCard
            label="Contracts Out"
            value={stats.contractsOut}
            icon={<FileText className="w-5 h-5" />}
            color={tokens.colors.status.warning}
          />
          <StatCard
            label="Signed"
            value={stats.signed}
            icon={<CheckCircle2 className="w-5 h-5" />}
            color={tokens.colors.status.success}
          />
          <StatCard
            label="Complete"
            value={stats.complete}
            icon={<Check className="w-5 h-5" />}
            color="#059669"
          />
        </div>

        {/* Filters & View Toggle */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            {/* View Toggle */}
            <div className="flex items-center bg-white border border-[#e5e5e5] rounded-lg p-1">
              <button
                onClick={() => setViewMode('kanban')}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                  viewMode === 'kanban'
                    ? 'bg-[#1a1a1a] text-white'
                    : 'text-[#666666] hover:bg-[#f5f5f5]'
                )}
              >
                <LayoutGrid className="w-4 h-4" />
                Kanban
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                  viewMode === 'table'
                    ? 'bg-[#1a1a1a] text-white'
                    : 'text-[#666666] hover:bg-[#f5f5f5]'
                )}
              >
                <List className="w-4 h-4" />
                Table
              </button>
            </div>

            {/* Stage Filter */}
            <div className="relative">
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value as PipelineStage | 'all')}
                className="appearance-none bg-white border border-[#e5e5e5] rounded-lg px-4 py-2 pr-10 text-sm text-[#666666] focus:outline-none focus:ring-2 focus:ring-[#f5b800]/20 focus:border-[#f5b800]"
              >
                <option value="all">All Stages</option>
                {PIPELINE_STAGES.map((stage) => (
                  <option key={stage.key} value={stage.key}>
                    {stage.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999999] pointer-events-none" />
            </div>

            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999999]" />
              <input
                type="text"
                placeholder="Search units..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-[#e5e5e5] rounded-lg text-sm text-[#1a1a1a] placeholder-[#999999] focus:outline-none focus:ring-2 focus:ring-[#f5b800]/20 focus:border-[#f5b800]"
              />
            </div>
          </div>
        </div>

        {/* Main Content */}
        {viewMode === 'kanban' ? (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {PIPELINE_STAGES.map((stage) => (
              <KanbanColumn
                key={stage.key}
                stage={stage}
                units={unitsByStage[stage.key]}
                selectedIds={selectedIds}
                onSelectUnit={toggleSelectUnit}
                onUnitClick={setSelectedUnit}
              />
            ))}
          </div>
        ) : (
          <TableView
            units={filteredUnits}
            selectedIds={selectedIds}
            onSelectUnit={toggleSelectUnit}
            onSelectAll={selectAll}
            onUnitClick={setSelectedUnit}
          />
        )}
      </div>

      {/* Bulk Actions Bar */}
      <BulkActionsBar
        selectedCount={selectedIds.size}
        onClear={clearSelection}
        onSendEmail={handleBulkEmail}
        onUpdateStage={handleBulkUpdateStage}
        onExport={handleBulkExport}
      />

      {/* Release Units Modal */}
      {showReleaseModal && (
        <ReleaseUnitsModal
          units={units}
          developmentId={developmentId}
          onClose={() => setShowReleaseModal(false)}
          onReleased={fetchData}
        />
      )}

      {/* Unit Detail Slideover */}
      <UnitDetailSlideover
        unit={selectedUnit}
        onClose={() => setSelectedUnit(null)}
        onUpdateStage={handleUpdateUnitStage}
      />
    </div>
  );
}
