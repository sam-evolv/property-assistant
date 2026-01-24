'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';

// =============================================================================
// Design Tokens - OpenHouse Brand
// =============================================================================

const tokens = {
  gold: '#D4A853',
  goldLight: '#e8c878',
  goldDark: '#b8923f',
  dark: '#1a1a1a',
  darker: '#0f0f0f',
  cream: '#fafaf8',
  warmGray: '#f7f6f3',
  textPrimary: '#1a1a1a',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  success: '#22c55e',
  warning: '#f97316',
  danger: '#ef4444',
  border: 'rgba(0,0,0,0.05)',
  borderLight: '#e5e7eb',
};

// =============================================================================
// Types
// =============================================================================

interface PipelineUnit {
  id: string;
  unitNumber: string;
  address: string;
  type?: string;
  price?: number;
  purchaserName: string | null;
  purchaserEmail?: string | null;
  purchaserPhone?: string | null;
  solicitorName?: string | null;
  solicitorEmail?: string | null;
  releaseDate: string | null;
  saleAgreedDate: string | null;
  depositDate: string | null;
  contractsIssuedDate: string | null;
  signedContractsDate: string | null;
  counterSignedDate: string | null;
  kitchenDate: string | null;
  snagDate: string | null;
  drawdownDate: string | null;
  handoverDate: string | null;
  notesCount: number;
  unresolvedNotesCount: number;
}

interface Development {
  id: string;
  name: string;
}

// =============================================================================
// Constants
// =============================================================================

const stages = ['releaseDate', 'saleAgreedDate', 'depositDate', 'contractsIssuedDate', 'signedContractsDate', 'counterSignedDate', 'kitchenDate', 'snagDate', 'drawdownDate', 'handoverDate'];
const stageLabels: Record<string, string> = {
  releaseDate: 'Released',
  saleAgreedDate: 'Sale Agreed',
  depositDate: 'Deposit Received',
  contractsIssuedDate: 'Contracts Issued',
  signedContractsDate: 'Contracts Signed',
  counterSignedDate: 'Counter-Signed',
  kitchenDate: 'Kitchen Selection',
  snagDate: 'Snagging Complete',
  drawdownDate: 'Drawdown',
  handoverDate: 'Handover',
};
const avgStageDays: Record<string, number> = {
  saleAgreedDate: 14,
  depositDate: 3,
  contractsIssuedDate: 10,
  signedContractsDate: 21,
  counterSignedDate: 3,
  kitchenDate: 14,
  snagDate: 45,
  drawdownDate: 14,
  handoverDate: 1,
};

// =============================================================================
// Utility Functions
// =============================================================================

function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

function formatFullDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatPrice(p: number): string {
  return '€' + p.toLocaleString();
}

function getProgress(unit: PipelineUnit): number {
  let count = 0;
  stages.forEach(s => { if (unit[s as keyof PipelineUnit]) count++; });
  return Math.round((count / stages.length) * 100);
}

function getCurrentStageIndex(unit: PipelineUnit): number {
  for (let i = stages.length - 1; i >= 0; i--) {
    if (unit[stages[i] as keyof PipelineUnit]) return i;
  }
  return -1;
}

function getDaysSinceLastUpdate(unit: PipelineUnit): number | null {
  const idx = getCurrentStageIndex(unit);
  if (idx >= 0) {
    const dateVal = unit[stages[idx] as keyof PipelineUnit];
    if (dateVal && typeof dateVal === 'string') {
      return Math.floor((new Date().getTime() - new Date(dateVal).getTime()) / 86400000);
    }
  }
  return null;
}

function getInitials(name: string | null): string {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

function getTodayISO(): string {
  return new Date().toISOString().split('T')[0];
}

interface Prediction {
  date: Date | null;
  confidence: number;
  status: 'complete' | 'available' | 'not_started' | 'on_track' | 'delayed' | 'at_risk';
}

function getPredictedClose(unit: PipelineUnit): Prediction {
  if (unit.handoverDate) {
    return { date: new Date(unit.handoverDate), confidence: 100, status: 'complete' };
  }
  if (!unit.purchaserName) {
    return { date: null, confidence: 0, status: 'available' };
  }
  const idx = getCurrentStageIndex(unit);
  if (idx < 0) {
    return { date: null, confidence: 0, status: 'not_started' };
  }
  const currentStage = stages[idx];
  const dateVal = unit[currentStage as keyof PipelineUnit];
  if (!dateVal || typeof dateVal !== 'string') {
    return { date: null, confidence: 0, status: 'not_started' };
  }
  const lastDate = new Date(dateVal);
  let daysToAdd = 0;
  for (let i = idx + 1; i < stages.length; i++) {
    const stage = stages[i];
    const baseDays = avgStageDays[stage] || 7;
    daysToAdd += baseDays;
  }
  const daysInCurrent = getDaysSinceLastUpdate(unit) || 0;
  const nextStage = stages[idx + 1];
  const expectedDaysInCurrent = nextStage ? avgStageDays[nextStage] || 14 : 14;
  let confidence = 85;
  if (daysInCurrent > expectedDaysInCurrent * 1.5) confidence -= 20;
  if (unit.unresolvedNotesCount > 2) confidence -= 15;
  if (idx >= 7) confidence += 10;
  confidence = Math.max(40, Math.min(95, confidence));
  const predictedDate = new Date(lastDate);
  predictedDate.setDate(predictedDate.getDate() + daysToAdd);
  let status: Prediction['status'] = 'on_track';
  if (daysInCurrent > expectedDaysInCurrent * 2) status = 'at_risk';
  else if (daysInCurrent > expectedDaysInCurrent * 1.3) status = 'delayed';
  return { date: predictedDate, confidence, status };
}

// =============================================================================
// Icons
// =============================================================================

const BackIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
  </svg>
);

const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const ExportIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

const CloseIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const MailIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const UserIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const PencilIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const PhoneIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
  </svg>
);

const BuildingIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

const CopyIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
  </svg>
);

// =============================================================================
// Toast Component
// =============================================================================

interface ToastProps {
  message: string;
  visible: boolean;
}

function Toast({ message, visible }: ToastProps) {
  return (
    <div
      className={`fixed bottom-28 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}
      style={{
        background: 'linear-gradient(135deg, #1f1f1f 0%, #171717 100%)',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.25)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
      }}
    >
      <div className="w-5 h-5 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: tokens.success }}>
        <CheckIcon />
      </div>
      <span className="text-sm font-medium text-white">{message}</span>
    </div>
  );
}

// =============================================================================
// Date Cell Component
// =============================================================================

interface DateCellProps {
  value: string | null;
  unitId: string;
  field: string;
  onUpdate: (unitId: string, field: string, value: string) => void;
}

function DateCell({ value, unitId, field, onUpdate }: DateCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!value) {
      onUpdate(unitId, field, getTodayISO());
    } else {
      setIsEditing(true);
    }
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      onUpdate(unitId, field, e.target.value);
    }
    setIsEditing(false);
  };

  const isEmpty = !value;
  const formatted = formatDate(value);

  if (isEditing) {
    return (
      <td className="border-l border-gray-50">
        <div className="h-11 px-1 flex items-center justify-center" style={{ boxShadow: `inset 0 0 0 2px ${tokens.gold}`, background: 'white' }}>
          <input
            ref={inputRef}
            type="date"
            defaultValue={value || ''}
            onChange={handleChange}
            onBlur={() => setIsEditing(false)}
            className="w-full h-full bg-transparent text-xs text-center outline-none"
          />
        </div>
      </td>
    );
  }

  return (
    <td className="border-l border-gray-50">
      <div
        onClick={handleClick}
        className={`h-11 px-2 flex items-center justify-center text-xs font-medium cursor-pointer transition-all ${
          isEmpty ? 'text-gray-400 hover:bg-gray-100' : ''
        }`}
        style={!isEmpty ? {
          background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
          color: '#166534',
        } : { background: '#fafaf9' }}
      >
        {formatted || '—'}
      </div>
    </td>
  );
}

// =============================================================================
// Queries Cell Component
// =============================================================================

interface QueriesCellProps {
  count: number;
  unresolvedCount: number;
  onClick: (e: React.MouseEvent) => void;
}

function QueriesCell({ count, unresolvedCount, onClick }: QueriesCellProps) {
  return (
    <td className="border-l border-gray-50">
      <div
        onClick={onClick}
        className="h-11 px-2 flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-all"
      >
        {unresolvedCount > 0 ? (
          <span
            className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: tokens.danger }}
          >
            {unresolvedCount}
          </span>
        ) : count > 0 ? (
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
            {count}
          </span>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </div>
    </td>
  );
}

// =============================================================================
// Progress Cell Component
// =============================================================================

interface ProgressCellProps {
  progress: number;
}

function ProgressCell({ progress }: ProgressCellProps) {
  const circ = 2 * Math.PI * 12;
  const isComplete = progress === 100;

  return (
    <td className="border-l border-gray-50">
      <div className="h-11 px-2 flex items-center justify-center">
        <div className="relative w-8 h-8">
          <svg className="w-8 h-8" style={{ transform: 'rotate(-90deg)' }} viewBox="0 0 32 32">
            <circle cx="16" cy="16" r="12" fill="none" stroke="#f0efec" strokeWidth="2.5" />
            <circle
              cx="16"
              cy="16"
              r="12"
              fill="none"
              stroke={isComplete ? tokens.success : tokens.gold}
              strokeWidth="2.5"
              strokeDasharray={circ}
              strokeDashoffset={circ - (progress / 100) * circ}
              strokeLinecap="round"
            />
          </svg>
          <span
            className={`absolute inset-0 flex items-center justify-center text-[10px] font-bold ${isComplete ? 'text-emerald-600' : 'text-gray-600'}`}
          >
            {progress}
          </span>
        </div>
      </div>
    </td>
  );
}

// =============================================================================
// Predicted Close Cell Component
// =============================================================================

interface PredictedCellProps {
  unit: PipelineUnit;
}

function PredictedCell({ unit }: PredictedCellProps) {
  const prediction = getPredictedClose(unit);

  if (prediction.status === 'complete') {
    return (
      <td className="border-l border-gray-50">
        <div className="h-11 px-2 flex items-center justify-center">
          <span className="text-[10px] font-semibold px-2 py-1 rounded" style={{ backgroundColor: '#dcfce7', color: '#166534' }}>
            Complete
          </span>
        </div>
      </td>
    );
  }

  if (prediction.status === 'available' || !prediction.date) {
    return (
      <td className="border-l border-gray-50">
        <div className="h-11 px-2 flex items-center justify-center text-xs text-gray-300">—</div>
      </td>
    );
  }

  const dateStr = formatDate(prediction.date.toISOString());
  const statusStyles = {
    on_track: { bg: '#f0fdf4', color: '#15803d' },
    delayed: { bg: '#fffbeb', color: '#b45309' },
    at_risk: { bg: '#fef2f2', color: '#dc2626' },
    not_started: { bg: '#f5f5f5', color: '#6b7280' },
  };
  const style = statusStyles[prediction.status] || statusStyles.not_started;

  return (
    <td className="border-l border-gray-50">
      <div className="h-11 px-2 flex items-center justify-center">
        <span
          className="text-xs font-semibold px-2.5 py-1 rounded-md"
          style={{ backgroundColor: style.bg, color: style.color }}
        >
          {dateStr}
        </span>
      </div>
    </td>
  );
}

// =============================================================================
// Profile Panel Component
// =============================================================================

interface ProfilePanelProps {
  unit: PipelineUnit | null;
  onClose: () => void;
  onCopy: (text: string, label: string) => void;
}

function ProfilePanel({ unit, onClose, onCopy }: ProfilePanelProps) {
  if (!unit) return null;

  const progress = getProgress(unit);
  const idx = getCurrentStageIndex(unit);
  const days = getDaysSinceLastUpdate(unit);
  const prediction = getPredictedClose(unit);
  const predDateStr = prediction.date ? formatFullDate(prediction.date.toISOString()) : '—';

  const predStatusClass = prediction.status === 'at_risk' ? 'text-red-600' : prediction.status === 'delayed' ? 'text-amber-600' : 'text-emerald-600';

  return (
    <>
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 animate-fadeIn" onClick={onClose} />
      <div
        className="fixed right-0 top-0 bottom-0 w-[520px] bg-white z-50 overflow-hidden animate-slideIn"
        style={{ boxShadow: '-20px 0 60px rgba(0, 0, 0, 0.12)' }}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div
            className="relative px-6 py-6"
            style={{ background: `linear-gradient(to bottom right, ${tokens.dark}, #111827, ${tokens.darker})` }}
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-all"
            >
              <CloseIcon />
            </button>

            <div className="flex items-start gap-4">
              <div
                className={`w-14 h-14 rounded-xl flex items-center justify-center text-lg font-bold shadow-lg ${unit.purchaserName ? '' : 'bg-gray-600 text-gray-400'}`}
                style={unit.purchaserName ? { background: `linear-gradient(135deg, ${tokens.gold} 0%, ${tokens.goldDark} 100%)`, color: tokens.dark } : {}}
              >
                {getInitials(unit.purchaserName)}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-white truncate">{unit.purchaserName || 'No Purchaser'}</h2>
                <p className="text-white/50 text-sm">{unit.unitNumber} {unit.address?.split(',')[0]?.replace(unit.unitNumber, '').trim()}</p>
                <div className="flex items-center gap-2 mt-2">
                  {unit.type && <span className="px-2 py-0.5 text-xs font-medium bg-white/10 text-white/70 rounded">{unit.type}</span>}
                  {unit.price && <span className="px-2 py-0.5 text-xs font-semibold rounded" style={{ backgroundColor: `${tokens.gold}30`, color: tokens.gold }}>{formatPrice(unit.price)}</span>}
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-5">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-white/40">Sale Progress</span>
                <span className="text-sm font-bold text-white">{progress}%</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${progress}%`, background: `linear-gradient(to right, ${tokens.gold}, ${tokens.goldLight})` }}
                />
              </div>
            </div>
          </div>

          {/* Stats Row */}
          <div className="px-6 py-4 border-b border-gray-100" style={{ backgroundColor: `${tokens.warmGray}80` }}>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-xl p-3 border border-gray-100">
                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Est. Close</p>
                <p className={`text-sm font-bold mt-1 ${prediction.status === 'complete' ? 'text-emerald-600' : predStatusClass}`}>
                  {prediction.status === 'complete' ? 'Complete' : predDateStr}
                </p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-gray-100">
                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Days in Stage</p>
                <p className={`text-sm font-bold mt-1 ${(days || 0) > 14 ? 'text-amber-600' : ''}`} style={{ color: (days || 0) > 14 ? undefined : tokens.dark }}>
                  {days !== null ? days : '—'}
                </p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-gray-100">
                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Queries</p>
                <p className={`text-sm font-bold mt-1 ${unit.unresolvedNotesCount > 0 ? 'text-red-500' : ''}`} style={{ color: unit.unresolvedNotesCount > 0 ? undefined : tokens.dark }}>
                  {unit.unresolvedNotesCount || 'None'}
                </p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto">
            {unit.purchaserName ? (
              <>
                {/* Purchaser Section */}
                <div className="px-6 py-5 border-b border-gray-100">
                  <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Purchaser</h3>
                  <div className="space-y-1">
                    {unit.purchaserEmail && (
                      <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-all group">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: tokens.warmGray }}>
                          <MailIcon />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: tokens.dark }}>{unit.purchaserEmail}</p>
                          <p className="text-xs text-gray-400">Email</p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); onCopy(unit.purchaserEmail!, 'Email'); }}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-amber-500 hover:bg-amber-50 transition-all"
                        >
                          <CopyIcon />
                        </button>
                      </div>
                    )}
                    {unit.purchaserPhone && (
                      <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-all group">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: tokens.warmGray }}>
                          <PhoneIcon />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium" style={{ color: tokens.dark }}>{unit.purchaserPhone}</p>
                          <p className="text-xs text-gray-400">Phone</p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); onCopy(unit.purchaserPhone!, 'Phone'); }}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-amber-500 hover:bg-amber-50 transition-all"
                        >
                          <CopyIcon />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Solicitor Section */}
                {unit.solicitorName && (
                  <div className="px-6 py-5 border-b border-gray-100">
                    <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Solicitor</h3>
                    <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: `${tokens.warmGray}80` }}>
                      <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center shadow-sm">
                        <BuildingIcon />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" style={{ color: tokens.dark }}>{unit.solicitorName}</p>
                        <p className="text-xs text-gray-400">{unit.solicitorEmail}</p>
                      </div>
                      {unit.solicitorEmail && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onCopy(unit.solicitorEmail!, 'Solicitor email'); }}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-amber-500 hover:bg-amber-50 transition-all"
                        >
                          <CopyIcon />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="px-6 py-12 text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: tokens.warmGray }}>
                  <UserIcon />
                </div>
                <h3 className="text-base font-semibold mb-1" style={{ color: tokens.dark }}>Available for Sale</h3>
                <p className="text-sm text-gray-500">This unit hasn't been reserved yet</p>
              </div>
            )}

            {/* Timeline */}
            <div className="px-6 py-5">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Timeline</h3>
              <div className="relative">
                <div className="absolute left-[15px] top-3 bottom-3 w-px bg-gradient-to-b from-emerald-300 via-gray-200 to-gray-200" />
                <div className="space-y-0.5">
                  {stages.map((s, i) => {
                    const dateVal = unit[s as keyof PipelineUnit];
                    const done = !!dateVal;
                    const curr = i === idx;
                    return (
                      <div key={s} className={`relative flex items-center gap-4 p-2 rounded-lg ${curr ? 'bg-amber-50/50' : ''} transition-colors`}>
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                            done ? '' : curr ? '' : 'bg-gray-200'
                          }`}
                          style={done ? {
                            background: `linear-gradient(135deg, ${tokens.success} 0%, #16a34a 100%)`,
                            boxShadow: `0 2px 8px rgba(34, 197, 94, 0.25)`,
                          } : curr ? {
                            background: `linear-gradient(135deg, ${tokens.gold} 0%, #c49743 100%)`,
                            boxShadow: `0 2px 8px rgba(212, 168, 83, 0.35)`,
                          } : {}}
                        >
                          {done ? (
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : curr ? (
                            <div className="w-2 h-2 bg-white rounded-full" />
                          ) : (
                            <div className="w-2 h-2 bg-gray-400 rounded-full" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${done || curr ? '' : 'text-gray-400'}`} style={{ color: done || curr ? tokens.dark : undefined }}>
                            {stageLabels[s]}
                          </p>
                          {typeof dateVal === 'string' && <p className="text-xs text-gray-400">{formatFullDate(dateVal)}</p>}
                        </div>
                        {curr && <span className="text-[10px] font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: '#fef3c7', color: '#b45309' }}>Current</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="shrink-0 px-6 py-4 border-t border-gray-100" style={{ backgroundColor: `${tokens.warmGray}50` }}>
            <div className="grid grid-cols-4 gap-2">
              {['Message', 'Docs', 'Notes', 'History'].map((label) => (
                <button
                  key={label}
                  className="flex flex-col items-center gap-1.5 p-3 bg-white rounded-xl border border-gray-100 hover:border-amber-500 hover:shadow-sm transition-all group"
                >
                  <span className="text-xs font-medium text-gray-500 group-hover:text-amber-500">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// =============================================================================
// Bulk Actions Bar Component
// =============================================================================

interface BulkActionsBarProps {
  selectedCount: number;
  onClear: () => void;
  onEmailSolicitors: () => void;
  onEmailPurchasers: () => void;
  onUpdateStage: (stage: string) => void;
  onAddNote: () => void;
  onExport: () => void;
}

function BulkActionsBar({ selectedCount, onClear, onEmailSolicitors, onEmailPurchasers, onUpdateStage, onAddNote, onExport }: BulkActionsBarProps) {
  const [showStageDropdown, setShowStageDropdown] = useState(false);

  if (selectedCount === 0) return null;

  const stageOptions = [
    { key: 'depositDate', label: 'Deposit Received' },
    { key: 'contractsIssuedDate', label: 'Contracts Issued' },
    { key: 'signedContractsDate', label: 'Contracts Signed' },
    { key: 'counterSignedDate', label: 'Counter-Signed' },
    { key: 'kitchenDate', label: 'Kitchen Selection' },
    { key: 'snagDate', label: 'Snagging Complete' },
    { key: 'drawdownDate', label: 'Drawdown' },
    { key: 'handoverDate', label: 'Handover' },
  ];

  return (
    <div
      className="fixed bottom-0 left-0 right-0 px-8 py-4 z-30 animate-slideUp"
      style={{
        background: 'linear-gradient(180deg, #1f1f1f 0%, #171717 100%)',
        boxShadow: '0 -8px 40px rgba(0, 0, 0, 0.2)',
        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
      }}
    >
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onClear}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white"
          >
            <CloseIcon />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold" style={{ color: tokens.gold }}>{selectedCount}</span>
            <span className="text-white/60 text-sm">units selected</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onEmailSolicitors}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-white flex items-center gap-2 transition-all hover:bg-white/10"
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <MailIcon />
            Email Solicitors
          </button>

          <button
            onClick={onEmailPurchasers}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-white flex items-center gap-2 transition-all hover:bg-white/10"
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <UserIcon />
            Email Purchasers
          </button>

          <div className="relative">
            <button
              onClick={() => setShowStageDropdown(!showStageDropdown)}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-white flex items-center gap-2 transition-all hover:bg-white/10"
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <ChevronRightIcon />
              Update Stage
              <ChevronDownIcon />
            </button>
            {showStageDropdown && (
              <div className="absolute bottom-full left-0 mb-2 w-52 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5">
                {stageOptions.map((stage) => (
                  <button
                    key={stage.key}
                    onClick={() => { onUpdateStage(stage.key); setShowStageDropdown(false); }}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    {stage.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={onAddNote}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-white flex items-center gap-2 transition-all hover:bg-white/10"
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <PencilIcon />
            Add Note
          </button>

          <button
            onClick={onExport}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all hover:brightness-110"
            style={{
              background: `linear-gradient(135deg, ${tokens.gold} 0%, #c49743 100%)`,
              color: tokens.dark,
              boxShadow: '0 4px 12px rgba(212, 168, 83, 0.3)',
            }}
          >
            <ExportIcon />
            Export
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Main Page Component
// =============================================================================

export default function PipelineDevelopmentPage() {
  const params = useParams();
  const router = useRouter();
  const developmentId = params.developmentId as string;

  const [development, setDevelopment] = useState<Development | null>(null);
  const [units, setUnits] = useState<PipelineUnit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<PipelineUnit | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState({ message: '', visible: false });

  const showToast = useCallback((message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 2000);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(`/api/pipeline/${developmentId}`);
      if (!response.ok) throw new Error('Failed to fetch data');
      const data = await response.json();
      setDevelopment(data.development);
      setUnits(data.units || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setIsLoading(false);
    }
  }, [developmentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedUnit(null);
        setSelectedRows(new Set());
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const handleUpdate = async (unitId: string, field: string, value: string) => {
    setUnits(prev => prev.map(u => u.id === unitId ? { ...u, [field]: value } : u));
    try {
      const response = await fetch(`/api/pipeline/${developmentId}/${unitId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, value }),
      });
      if (!response.ok) fetchData();
    } catch {
      fetchData();
    }
  };

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label} copied`);
    } catch {
      showToast(`Failed to copy`);
    }
  };

  const toggleRowSelection = (id: string, selected: boolean) => {
    const newSelection = new Set(selectedRows);
    if (selected) newSelection.add(id);
    else newSelection.delete(id);
    setSelectedRows(newSelection);
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) setSelectedRows(new Set(units.map(u => u.id)));
    else setSelectedRows(new Set());
  };

  const handleBulkUpdateStage = async (stage: string) => {
    const today = getTodayISO();
    setUnits(prev => prev.map(u => selectedRows.has(u.id) ? { ...u, [stage]: today } : u));
    showToast(`Updated ${selectedRows.size} unit(s)`);
    setSelectedRows(new Set());
  };

  const handleBulkEmailSolicitors = () => {
    const selected = units.filter(u => selectedRows.has(u.id) && u.solicitorEmail);
    const emails = [...new Set(selected.map(u => u.solicitorEmail))].filter(Boolean);
    if (emails.length > 0) {
      window.location.href = `mailto:${emails.join(',')}`;
    }
    showToast(`Opening email to ${emails.length} solicitor(s)`);
  };

  const handleBulkEmailPurchasers = () => {
    const selected = units.filter(u => selectedRows.has(u.id) && u.purchaserEmail);
    const emails = selected.map(u => u.purchaserEmail).filter(Boolean);
    if (emails.length > 0) {
      window.location.href = `mailto:${emails.join(',')}`;
    }
    showToast(`Opening email to ${emails.length} purchaser(s)`);
  };

  const handleBulkExport = () => {
    showToast(`Exporting ${selectedRows.size} unit(s)`);
  };

  const handleBulkAddNote = () => {
    showToast(`Adding note to ${selectedRows.size} unit(s)`);
  };

  // Stats
  const stats = {
    total: units.length,
    available: units.filter(u => !u.purchaserName).length,
    inProgress: units.filter(u => u.purchaserName && !u.handoverDate).length,
    complete: units.filter(u => u.handoverDate).length,
    openQueries: units.reduce((acc, u) => acc + (u.unresolvedNotesCount || 0), 0),
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: tokens.cream, fontFamily: "'DM Sans', sans-serif" }}>
        <style jsx global>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');`}</style>
        <div className="text-center">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin mx-auto" style={{ borderColor: tokens.gold, borderTopColor: 'transparent' }} />
          <p className="text-sm text-gray-500 mt-3">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: tokens.cream, fontFamily: "'DM Sans', sans-serif" }}>
        <style jsx global>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');`}</style>
        <div className="text-center">
          <p className="text-sm text-red-500 mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2 text-sm font-medium rounded-xl" style={{ backgroundColor: tokens.gold, color: tokens.dark }}>Retry</button>
        </div>
      </div>
    );
  }

  const columnConfig = [
    { key: 'checkbox', label: '', width: 44 },
    { key: 'unit', label: 'Unit / Purchaser', width: 200 },
    { key: 'releaseDate', label: 'Release', width: 72 },
    { key: 'saleAgreedDate', label: 'Agreed', width: 72 },
    { key: 'depositDate', label: 'Deposit', width: 72 },
    { key: 'contractsIssuedDate', label: 'Contracts', width: 80 },
    { key: 'queries', label: 'Queries', width: 60 },
    { key: 'signedContractsDate', label: 'Signed', width: 68 },
    { key: 'counterSignedDate', label: 'Counter', width: 72 },
    { key: 'kitchenDate', label: 'Kitchen', width: 68 },
    { key: 'snagDate', label: 'Snag', width: 58 },
    { key: 'drawdownDate', label: 'Drawdown', width: 78 },
    { key: 'handoverDate', label: 'Handover', width: 78 },
    { key: 'progress', label: 'Progress', width: 70 },
    { key: 'predicted', label: 'Est. Close', width: 100 },
  ];

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes slideUp { from { transform: translateY(100%) scale(0.98); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-slideIn { animation: slideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1); }
        .animate-slideUp { animation: slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1); }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
        .row-checkbox {
          appearance: none;
          width: 16px;
          height: 16px;
          border: 1.5px solid #d4d2cd;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.15s ease;
          position: relative;
          background: white;
        }
        .row-checkbox:hover { border-color: ${tokens.gold}; background: rgba(212, 168, 83, 0.05); }
        .row-checkbox:checked {
          background: linear-gradient(135deg, ${tokens.gold} 0%, #c49743 100%);
          border-color: #c49743;
        }
        .row-checkbox:checked::after {
          content: '';
          position: absolute;
          left: 4.5px;
          top: 1.5px;
          width: 4px;
          height: 8px;
          border: solid white;
          border-width: 0 1.5px 1.5px 0;
          transform: rotate(45deg);
        }
        .table-row { transition: background 0.15s ease; }
        .table-row:hover { background: linear-gradient(90deg, #fdfcfa 0%, #ffffff 100%); }
        .table-row.selected { background: linear-gradient(90deg, rgba(212, 168, 83, 0.08) 0%, rgba(212, 168, 83, 0.03) 100%); }
        .table-row:hover .row-arrow { opacity: 1; transform: translateX(0); }
      `}</style>

      <div className="min-h-screen pb-28" style={{ backgroundColor: tokens.cream, fontFamily: "'DM Sans', sans-serif" }}>
        <div className="p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/developer/pipeline')}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-gray-200/80 text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <BackIcon />
              </button>
              <div>
                <h1 className="text-2xl font-bold" style={{ color: tokens.dark }}>{development?.name || 'Pipeline'}</h1>
                <p className="text-sm text-gray-500 mt-0.5">Sales pipeline · {stats.total} units</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200/80 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all flex items-center gap-2">
                <ExportIcon />
                Export
              </button>
              <button
                className="px-5 py-2.5 text-sm font-semibold rounded-xl hover:shadow-md transition-all flex items-center gap-2"
                style={{ backgroundColor: tokens.gold, color: tokens.dark }}
              >
                <PlusIcon />
                Release Units
              </button>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-5 gap-5 mb-8">
            <div className="bg-white rounded-2xl border border-gray-100 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Units</p>
              <p className="text-3xl font-bold mt-1" style={{ color: tokens.dark }}>{stats.total}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Available</p>
              <p className="text-3xl font-bold mt-1" style={{ color: tokens.dark }}>{stats.available}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">In Progress</p>
              <p className="text-3xl font-bold mt-1" style={{ color: tokens.gold }}>{stats.inProgress}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Complete</p>
              <p className="text-3xl font-bold mt-1" style={{ color: tokens.success }}>{stats.complete}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Open Queries</p>
              <p className="text-3xl font-bold mt-1" style={{ color: stats.openQueries > 0 ? tokens.danger : tokens.dark }}>{stats.openQueries}</p>
            </div>
          </div>

          {/* Table Card */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold" style={{ color: tokens.dark }}>All Units</h2>
                <span className="text-xs px-2.5 py-1 rounded-full" style={{ backgroundColor: tokens.warmGray, color: tokens.textMuted }}>{units.length} units</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: `${tokens.warmGray}80` }} className="border-b border-gray-100">
                    {columnConfig.map((col, i) => (
                      <th
                        key={col.key}
                        className={`${i <= 1 ? 'sticky z-20' : ''} px-3 py-3 ${i === 1 ? 'text-left' : 'text-center'} text-[11px] font-semibold text-gray-400 uppercase tracking-wider ${i > 1 ? 'border-l border-gray-100/50' : ''}`}
                        style={{ left: i === 0 ? '0' : i === 1 ? '44px' : undefined, minWidth: col.width, backgroundColor: `${tokens.warmGray}80` }}
                      >
                        {col.key === 'checkbox' ? (
                          <input
                            type="checkbox"
                            className="row-checkbox"
                            onChange={(e) => toggleSelectAll(e.target.checked)}
                            checked={selectedRows.size === units.length && units.length > 0}
                          />
                        ) : col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {units.map((unit, i) => {
                    const isSelected = selectedRows.has(unit.id);
                    const progress = getProgress(unit);
                    return (
                      <tr
                        key={unit.id}
                        className={`table-row cursor-pointer ${isSelected ? 'selected' : ''}`}
                        onClick={() => setSelectedUnit(unit)}
                      >
                        {/* Checkbox */}
                        <td className="sticky left-0 z-10 bg-white w-11 px-3 py-3">
                          <input
                            type="checkbox"
                            className="row-checkbox"
                            checked={isSelected}
                            onChange={(e) => { e.stopPropagation(); toggleRowSelection(unit.id, e.target.checked); }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>

                        {/* Unit / Purchaser */}
                        <td className="sticky left-[44px] z-10 bg-white px-4 py-3 border-b border-gray-50">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${unit.purchaserName ? '' : 'bg-gray-200 text-gray-500'}`}
                              style={unit.purchaserName ? {
                                background: i % 2 === 0 ? `linear-gradient(135deg, ${tokens.gold} 0%, ${tokens.goldDark} 100%)` : `linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%)`,
                                color: i % 2 === 0 ? tokens.dark : tokens.gold,
                              } : {}}
                            >
                              {getInitials(unit.purchaserName)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold truncate" style={{ color: tokens.dark }}>{unit.unitNumber}</p>
                              <p className={`text-xs truncate ${unit.purchaserName ? 'text-gray-500' : 'text-gray-400'}`}>{unit.purchaserName || 'Available'}</p>
                            </div>
                            <div className="row-arrow opacity-0 transform translate-x-1 transition-all" style={{ color: tokens.gold }}>
                              <ChevronRightIcon />
                            </div>
                          </div>
                        </td>

                        {/* Date Cells */}
                        <DateCell value={unit.releaseDate} unitId={unit.id} field="releaseDate" onUpdate={handleUpdate} />
                        <DateCell value={unit.saleAgreedDate} unitId={unit.id} field="saleAgreedDate" onUpdate={handleUpdate} />
                        <DateCell value={unit.depositDate} unitId={unit.id} field="depositDate" onUpdate={handleUpdate} />
                        <DateCell value={unit.contractsIssuedDate} unitId={unit.id} field="contractsIssuedDate" onUpdate={handleUpdate} />

                        {/* Queries */}
                        <QueriesCell
                          count={unit.notesCount}
                          unresolvedCount={unit.unresolvedNotesCount}
                          onClick={(e) => { e.stopPropagation(); setSelectedUnit(unit); }}
                        />

                        <DateCell value={unit.signedContractsDate} unitId={unit.id} field="signedContractsDate" onUpdate={handleUpdate} />
                        <DateCell value={unit.counterSignedDate} unitId={unit.id} field="counterSignedDate" onUpdate={handleUpdate} />
                        <DateCell value={unit.kitchenDate} unitId={unit.id} field="kitchenDate" onUpdate={handleUpdate} />
                        <DateCell value={unit.snagDate} unitId={unit.id} field="snagDate" onUpdate={handleUpdate} />
                        <DateCell value={unit.drawdownDate} unitId={unit.id} field="drawdownDate" onUpdate={handleUpdate} />
                        <DateCell value={unit.handoverDate} unitId={unit.id} field="handoverDate" onUpdate={handleUpdate} />

                        {/* Progress */}
                        <ProgressCell progress={progress} />

                        {/* Est. Close */}
                        <PredictedCell unit={unit} />
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {units.length === 0 && (
                <div className="px-6 py-16 text-center">
                  <p className="text-sm text-gray-500 mb-4">No units released yet.</p>
                  <button
                    className="px-4 py-2 text-sm font-medium rounded-xl"
                    style={{ backgroundColor: tokens.gold, color: tokens.dark }}
                  >
                    Release Units
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Profile Panel */}
      {selectedUnit && (
        <ProfilePanel unit={selectedUnit} onClose={() => setSelectedUnit(null)} onCopy={handleCopy} />
      )}

      {/* Bulk Actions Bar */}
      <BulkActionsBar
        selectedCount={selectedRows.size}
        onClear={() => setSelectedRows(new Set())}
        onEmailSolicitors={handleBulkEmailSolicitors}
        onEmailPurchasers={handleBulkEmailPurchasers}
        onUpdateStage={handleBulkUpdateStage}
        onAddNote={handleBulkAddNote}
        onExport={handleBulkExport}
      />

      {/* Toast */}
      <Toast message={toast.message} visible={toast.visible} />
    </>
  );
}
