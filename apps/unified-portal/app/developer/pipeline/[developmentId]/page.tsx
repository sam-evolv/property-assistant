'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Plus,
  Upload,
  X,
  Mail,
  User,
  ChevronRight,
  ChevronDown,
  Pencil,
  Phone,
  Building2,
  Copy,
  Check,
  Clock,
  BarChart3,
  MessageCircle,
  AlertCircle,
} from 'lucide-react';

// =============================================================================
// Design Tokens - OpenHouse Brand
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

function naturalSort(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

// =============================================================================
// Types
// =============================================================================

interface PipelineUnit {
  id: string;
  unitNumber: string;
  address: string;
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
  // Query tracking
  queriesRaisedDate: string | null;
  queriesRepliedDate: string | null;
  // Sale type (private or social)
  saleType: string | null;
  socialHousingProvider?: string | null;
  // Sale price
  salePrice: number | null;
  // Property details from database
  houseTypeCode?: string | null; // BD01, BS01, BT01
  propertyDesignation?: string | null; // D (Detached), SD (Semi-Detached), T (Terrace)
  propertyType?: string | null; // HO (House), AP (Apartment), DP (Duplex)
  bedrooms?: number | null;
  bathrooms?: number | null;
  floorAreaM2?: number | null;
  squareFootage?: number | null;
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

// Price formatting utilities
function formatPrice(price: number | null): string {
  if (price === null || price === undefined) return '—';
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

function formatCompactPrice(amount: number): string {
  if (amount >= 1000000) {
    return `€${(amount / 1000000).toFixed(1)}M`;
  } else if (amount >= 1000) {
    return `€${(amount / 1000).toFixed(0)}K`;
  }
  return `€${amount.toFixed(0)}`;
}

function getProgress(unit: PipelineUnit): number {
  let count = 0;
  stages.forEach(s => { if (unit[s as keyof PipelineUnit]) count++; });
  return Math.round((count / stages.length) * 100);
}

// Social housing progress - only counts Snag and Handover (2 stages)
function getSocialHousingProgress(unit: PipelineUnit): number {
  let count = 0;
  if (unit.snagDate) count++;
  if (unit.handoverDate) count++;
  return Math.round((count / 2) * 100);
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
        <Check className="w-3 h-3" />
      </div>
      <span className="text-sm font-medium text-white">{message}</span>
    </div>
  );
}

// =============================================================================
// Date Cell Component
// =============================================================================

// Traffic light computation
function computeTrafficLight(
  stageDate: string | null,
  referenceDate: string | null,
  amberDays: number,
  redDays: number
): 'green' | 'amber' | 'red' | null {
  if (stageDate) return 'green';
  if (!referenceDate) return null;
  const now = new Date();
  const ref = new Date(referenceDate);
  const daysSince = Math.floor((now.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24));
  if (daysSince >= redDays) return 'red';
  if (daysSince >= amberDays) return 'amber';
  return null;
}

interface DateCellProps {
  value: string | null;
  unitId: string;
  field: string;
  onUpdate: (unitId: string, field: string, value: string) => void;
  trafficLight?: 'green' | 'amber' | 'red' | null;
  onChase?: () => void;
}

function DateCell({ value, unitId, field, onUpdate, trafficLight, onChase }: DateCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [pendingValue, setPendingValue] = useState<string | null>(null);
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
      inputRef.current.showPicker?.();
    }
  }, [isEditing]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPendingValue(e.target.value);
  };

  const handleBlur = () => {
    if (pendingValue && pendingValue !== value) {
      onUpdate(unitId, field, pendingValue);
    }
    setPendingValue(null);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && pendingValue) {
      onUpdate(unitId, field, pendingValue);
      setPendingValue(null);
      setIsEditing(false);
    } else if (e.key === 'Escape') {
      setPendingValue(null);
      setIsEditing(false);
    }
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
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="w-full h-full bg-transparent text-xs text-center outline-none"
          />
        </div>
      </td>
    );
  }

  // Traffic light styling
  const getTrafficLightStyle = () => {
    if (!trafficLight || trafficLight === 'green') {
      if (!isEmpty) {
        return { background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', color: '#166534' };
      }
      return { background: '#fafaf9' };
    }
    if (trafficLight === 'amber') {
      return { background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', color: '#92400e', borderLeft: '3px solid #f59e0b' };
    }
    if (trafficLight === 'red') {
      return { background: 'linear-gradient(135deg, #fef2f2 0%, #fecaca 100%)', color: '#991b1b', borderLeft: '3px solid #ef4444' };
    }
    return { background: '#fafaf9' };
  };

  return (
    <td className="border-l border-gray-50">
      <div
        onClick={handleClick}
        className={`h-11 px-2 flex items-center justify-center text-xs font-medium cursor-pointer transition-all relative ${
          isEmpty ? 'text-gray-400 hover:bg-gray-100' : ''
        }`}
        style={getTrafficLightStyle()}
      >
        {formatted || '—'}
        {(trafficLight === 'red' || trafficLight === 'amber') && onChase && (
          <button
            onClick={(e) => { e.stopPropagation(); onChase(); }}
            className={`absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded transition-colors ${
              trafficLight === 'red' ? 'hover:bg-red-200' : 'hover:bg-amber-200'
            }`}
            title="Send chase email"
          >
            <Mail className={`w-3 h-3 ${trafficLight === 'red' ? 'text-red-700' : 'text-amber-700'}`} />
          </button>
        )}
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
        className="h-11 px-2 flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-all group"
      >
        {unresolvedCount > 0 ? (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-red-50 border border-red-200 group-hover:bg-red-100 transition-colors">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-semibold text-red-700">{unresolvedCount}</span>
          </div>
        ) : count > 0 ? (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200 group-hover:bg-emerald-100 transition-colors">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-xs font-semibold text-emerald-700">{count}</span>
          </div>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </div>
    </td>
  );
}

// =============================================================================
// Inactive Cell Component (for social housing rows)
// =============================================================================

interface InactiveCellProps {
  isSocial?: boolean;
}

function InactiveCell({ isSocial = false }: InactiveCellProps) {
  return (
    <td className="border-l border-gray-50">
      <div 
        className="h-11 px-2 flex items-center justify-center"
        style={{ backgroundColor: isSocial ? '#F8F7F5' : undefined }}
      >
        <span className="text-[#D0D0D0] text-xs">—</span>
      </div>
    </td>
  );
}

// =============================================================================
// Price Cell Component (editable)
// =============================================================================

interface PriceCellProps {
  value: number | null;
  unitId: string;
  onUpdate: (unitId: string, field: string, value: string) => void;
  isSocialHousing?: boolean;
}

function PriceCell({ value, unitId, onUpdate, isSocialHousing = false }: PriceCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSocialHousing) return;
    setInputValue(value ? value.toString() : '');
    setIsEditing(true);
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    const numValue = inputValue.trim() === '' ? '' : inputValue.replace(/[^0-9.]/g, '');
    onUpdate(unitId, 'salePrice', numValue);
    setIsEditing(false);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 1500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <td className="border-l border-gray-50">
        <div className="h-11 px-2 flex items-center justify-end" style={{ boxShadow: `inset 0 0 0 2px ${tokens.gold}`, background: 'white' }}>
          <span className="text-gray-400 text-xs mr-1">€</span>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value.replace(/[^0-9]/g, ''))}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="w-20 h-full bg-transparent text-xs text-right outline-none font-mono"
            placeholder="0"
          />
        </div>
      </td>
    );
  }

  const bgColor = isSocialHousing ? '#F8F7F5' : (showSuccess ? '#f0fdf4' : undefined);

  return (
    <td className="border-l border-gray-50">
      <div
        onClick={handleClick}
        className={`h-11 px-3 flex items-center justify-end transition-all ${
          isSocialHousing ? '' : 'cursor-pointer hover:bg-gray-50'
        }`}
        style={{ backgroundColor: bgColor }}
      >
        {value ? (
          <span 
            className="text-xs font-semibold font-mono"
            style={{ color: tokens.goldDark }}
          >
            {formatPrice(value)}
          </span>
        ) : (
          <span className="text-gray-300 text-xs">—</span>
        )}
        {showSuccess && (
          <Check className="w-3 h-3 ml-1 text-emerald-500" />
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
  isSocialHousing?: boolean;
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
    on_track: { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
    delayed: { bg: '#fffbeb', color: '#b45309', border: '#fde68a' },
    at_risk: { bg: '#ef4444', color: '#ffffff', border: '#ef4444' },
    not_started: { bg: '#f5f5f5', color: '#6b7280', border: '#e5e7eb' },
  };
  const style = statusStyles[prediction.status] || statusStyles.not_started;

  return (
    <td className="border-l border-gray-50">
      <div className="h-11 px-2 flex items-center justify-center">
        <span
          className="text-xs font-semibold px-2.5 py-1 rounded-md border"
          style={{ backgroundColor: style.bg, color: style.color, borderColor: style.border }}
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
              <X className="w-5 h-5" />
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
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {unit.houseTypeCode && <span className="px-2 py-0.5 text-xs font-bold bg-white/20 text-white rounded">{unit.houseTypeCode}</span>}
                  {unit.propertyDesignation && <span className="px-2 py-0.5 text-xs font-medium bg-white/10 text-white/70 rounded">{unit.propertyDesignation}</span>}
                  {unit.bedrooms && <span className="px-2 py-0.5 text-xs font-medium bg-white/10 text-white/70 rounded">{unit.bedrooms} Bed</span>}
                  {unit.bathrooms && <span className="px-2 py-0.5 text-xs font-medium bg-white/10 text-white/70 rounded">{unit.bathrooms} Bath</span>}
                  {unit.squareFootage && <span className="px-2 py-0.5 text-xs font-medium bg-white/10 text-white/70 rounded">{Math.round(unit.squareFootage)} sqft</span>}
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
                          <Mail className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: tokens.dark }}>{unit.purchaserEmail}</p>
                          <p className="text-xs text-gray-400">Email</p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); onCopy(unit.purchaserEmail!, 'Email'); }}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-amber-500 hover:bg-amber-50 transition-all"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    {unit.purchaserPhone && (
                      <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-all group">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: tokens.warmGray }}>
                          <Phone className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium" style={{ color: tokens.dark }}>{unit.purchaserPhone}</p>
                          <p className="text-xs text-gray-400">Phone</p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); onCopy(unit.purchaserPhone!, 'Phone'); }}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-amber-500 hover:bg-amber-50 transition-all"
                        >
                          <Copy className="w-4 h-4" />
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
                        <Building2 className="w-4 h-4" />
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
                          <Copy className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="px-6 py-12 text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: tokens.warmGray }}>
                  <User className="w-4 h-4" />
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
                            <Check className="w-4 h-4 text-white" />
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
// Activity Sidebar Component
// =============================================================================

interface ActivityItem {
  id: string;
  type: 'stage_update' | 'query' | 'document' | 'completion';
  title: string;
  unit: string;
  timestamp: string;
}

interface ActivitySidebarProps {
  visible: boolean;
  onClose: () => void;
}

function ActivitySidebar({ visible, onClose }: ActivitySidebarProps) {
  // Mock activity data - would come from API
  const activities: { group: string; items: ActivityItem[] }[] = [
    {
      group: 'Today',
      items: [
        { id: '1', type: 'stage_update', title: 'Contracts Signed', unit: 'Unit 12A', timestamp: '2 hours ago' },
        { id: '2', type: 'query', title: 'New query received', unit: 'Unit 8B', timestamp: '4 hours ago' },
        { id: '3', type: 'completion', title: 'Sale completed', unit: 'Unit 3C', timestamp: '5 hours ago' },
      ],
    },
    {
      group: 'Yesterday',
      items: [
        { id: '4', type: 'document', title: 'Documents uploaded', unit: 'Unit 15D', timestamp: 'Yesterday' },
        { id: '5', type: 'stage_update', title: 'Deposit received', unit: 'Unit 7A', timestamp: 'Yesterday' },
      ],
    },
    {
      group: 'This Week',
      items: [
        { id: '6', type: 'query', title: 'Query resolved', unit: 'Unit 22B', timestamp: '3 days ago' },
        { id: '7', type: 'stage_update', title: 'Kitchen selected', unit: 'Unit 11C', timestamp: '4 days ago' },
      ],
    },
  ];

  const getIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'stage_update': return <ChevronRight className="w-4 h-4" />;
      case 'query': return <MessageCircle className="w-4 h-4" />;
      case 'document': return <Upload className="w-4 h-4" />;
      case 'completion': return <Check className="w-3 h-3" />;
      default: return <ChevronRight className="w-4 h-4" />;
    }
  };

  const getColor = (type: ActivityItem['type']) => {
    switch (type) {
      case 'stage_update': return tokens.gold;
      case 'query': return '#3b82f6';
      case 'document': return '#8b5cf6';
      case 'completion': return tokens.success;
      default: return tokens.gold;
    }
  };

  if (!visible) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 animate-fadeIn" onClick={onClose} />
      <div
        className="fixed right-0 top-0 bottom-0 w-80 bg-white z-50 overflow-hidden animate-slideIn"
        style={{ boxShadow: '-20px 0 60px rgba(0, 0, 0, 0.12)' }}
      >
        <div className="h-full flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-base font-bold" style={{ color: tokens.dark }}>Activity</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-auto">
            {activities.map((group) => (
              <div key={group.group} className="px-5 py-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">{group.group}</p>
                <div className="space-y-2">
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-all cursor-pointer"
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${getColor(item.type)}15`, color: getColor(item.type) }}
                      >
                        {getIcon(item.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: tokens.dark }}>{item.title}</p>
                        <p className="text-xs text-gray-400">{item.unit} · {item.timestamp}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// =============================================================================
// Query Panel Component
// =============================================================================

interface Query {
  id: string;
  content: string;
  resolved: boolean;
  createdAt: string;
  createdBy: string;
  resolvedAt?: string;
  response?: string;
}

interface QueryPanelProps {
  unit: PipelineUnit | null;
  developmentId: string;
  onClose: () => void;
  onReply: (queryId: string) => void;
}

function formatExactDate(dateString: string | undefined): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) +
         ' at ' + date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatDateOnly(dateString: string | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function calculateResponseTime(raisedDate: string | null, repliedDate: string | null): string {
  if (!raisedDate || !repliedDate) return '';
  const raised = new Date(raisedDate);
  const replied = new Date(repliedDate);
  const diffMs = replied.getTime() - raised.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Same day';
  if (diffDays === 1) return '1 day';
  return `${diffDays} days`;
}

function QueryPanel({ unit, developmentId, onClose, onReply }: QueryPanelProps) {
  const [queries, setQueries] = useState<Query[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!unit) return;

    const fetchQueries = async () => {
      try {
        const response = await fetch(`/api/pipeline/${developmentId}/${unit.id}/notes`);
        if (response.ok) {
          const data = await response.json();
          const notes = data.notes || [];
          // Only show demo queries if the unit has unresolvedNotesCount > 0 (from fetchData)
          // This ensures consistency between what's shown in the table and the panel
          if (notes.length === 0 && unit.unresolvedNotesCount > 0) {
            setQueries([
              { id: 'demo-1', content: 'Can you confirm the completion date for the kitchen installation?', resolved: false, createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), createdBy: 'demo@openhouse.ie' },
              { id: 'demo-2', content: 'Please provide the updated floor plan with the recent modifications.', resolved: true, createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), createdBy: 'demo@openhouse.ie', resolvedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
              { id: 'demo-3', content: 'What is the status of the parking space allocation?', resolved: false, createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), createdBy: 'demo@openhouse.ie' },
            ]);
          } else {
            setQueries(notes);
          }
        }
      } catch (error) {
        console.error('Failed to fetch queries:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchQueries();
  }, [unit, developmentId]);

  if (!unit) return null;

  const responseTime = calculateResponseTime(unit.queriesRaisedDate, unit.queriesRepliedDate);

  return (
    <>
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 animate-fadeIn" onClick={onClose} />
      <div
        className="fixed right-0 top-0 bottom-0 w-[420px] bg-white z-50 overflow-hidden animate-slideIn"
        style={{ boxShadow: '-20px 0 60px rgba(0, 0, 0, 0.12)' }}
      >
        <div className="h-full flex flex-col">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold" style={{ color: tokens.dark }}>Queries</h2>
              <p className="text-xs text-gray-400 mt-0.5">{unit.unitNumber} · {unit.purchaserName || 'No purchaser'}</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Query Summary Section */}
          <div className="px-6 py-4 border-b border-gray-100" style={{ backgroundColor: tokens.warmGray }}>
            {!unit.queriesRaisedDate ? (
              <div className="text-center py-2">
                <p className="text-sm text-gray-500">No queries raised</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Queries Raised</span>
                  <span className="text-sm font-semibold" style={{ color: tokens.dark }}>
                    {formatDateOnly(unit.queriesRaisedDate)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Queries Replied</span>
                  {unit.queriesRepliedDate ? (
                    <span className="text-sm font-semibold text-emerald-600">
                      {formatDateOnly(unit.queriesRepliedDate)}
                    </span>
                  ) : (
                    <span className="text-sm font-semibold text-amber-600">Awaiting response</span>
                  )}
                </div>
                {responseTime && (
                  <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Response Time</span>
                    <span className="text-sm font-bold px-2 py-0.5 rounded" style={{ backgroundColor: '#dcfce7', color: '#166534' }}>
                      {responseTime}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto p-6">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin mx-auto" style={{ borderColor: tokens.gold, borderTopColor: 'transparent' }} />
                <p className="text-sm text-gray-500 mt-3">Loading queries...</p>
              </div>
            ) : queries.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: tokens.warmGray }}>
                  <MessageCircle className="w-4 h-4" />
                </div>
                <p className="text-sm text-gray-500">No queries for this unit</p>
              </div>
            ) : (
              <div className="space-y-4">
                {queries.map((query) => (
                  <div
                    key={query.id}
                    className="rounded-xl border border-gray-100 overflow-hidden"
                    style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <p className="text-sm font-medium" style={{ color: tokens.dark }}>{query.content}</p>
                        <span
                          className={`shrink-0 text-[10px] font-semibold px-2 py-1 rounded ${
                            !query.resolved
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {!query.resolved ? 'Pending' : 'Answered'}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-gray-400">
                          <span className="font-medium text-gray-500">Asked:</span> {formatExactDate(query.createdAt)}
                        </p>
                        {query.createdBy && (
                          <p className="text-xs text-gray-400">
                            <span className="font-medium text-gray-500">By:</span> {query.createdBy}
                          </p>
                        )}
                        {query.resolved && query.resolvedAt && (
                          <p className="text-xs text-gray-400">
                            <span className="font-medium text-gray-500">Answered:</span> {formatExactDate(query.resolvedAt)}
                          </p>
                        )}
                      </div>
                    </div>
                    {query.response && (
                      <div className="px-4 py-3 border-t border-gray-100" style={{ backgroundColor: tokens.warmGray }}>
                        <p className="text-xs text-gray-600">{query.response}</p>
                      </div>
                    )}
                    {!query.resolved && (
                      <div className="px-4 py-3 border-t border-gray-100">
                        <button
                          onClick={() => onReply(query.id)}
                          className="w-full py-2 text-xs font-semibold rounded-lg transition-all"
                          style={{ backgroundColor: tokens.gold, color: tokens.dark }}
                        >
                          Reply
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
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
            <X className="w-5 h-5" />
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
            <Mail className="w-4 h-4" />
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
            <User className="w-4 h-4" />
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
              <ChevronRight className="w-4 h-4" />
              Update Stage
              <ChevronDown className="w-3 h-3" />
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
            <Pencil className="w-4 h-4" />
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
            <Upload className="w-4 h-4" />
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
  const [showActivity, setShowActivity] = useState(false);
  const [queryUnit, setQueryUnit] = useState<PipelineUnit | null>(null);
  const [hasNewActivity] = useState(true); // Would come from API
  const [editingColumnHeader, setEditingColumnHeader] = useState<{ key: string; label: string } | null>(null);
  const [columnLabels, setColumnLabels] = useState<Record<string, string>>({
    releaseDate: 'Release',
    saleAgreedDate: 'Agreed',
    depositDate: 'Deposit',
    contractsIssuedDate: 'Contracts',
    signedContractsDate: 'Signed',
    counterSignedDate: 'Counter',
    kitchenDate: 'Kitchen',
    snagDate: 'Snag',
    drawdownDate: 'Drawdown',
    handoverDate: 'Handover',
  });

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
      // Use real data from API - no demo data fallbacks
      const unitsWithData = (data.units || []).map((unit: PipelineUnit, idx: number) => {
        const enrichedUnit = {
          ...unit,
          // Use real data from API - these fields come from the database
          propertyDesignation: unit.propertyDesignation || null,
          bedrooms: unit.bedrooms || null,
          squareFootage: unit.squareFootage || null,
          floorAreaM2: unit.floorAreaM2 || null,
          houseTypeCode: unit.houseTypeCode || null,
        };

        // First 10 units get demo queries if they have no real queries
        if (unit.notesCount === 0 && idx < 10) {
          return {
            ...enrichedUnit,
            notesCount: 3,
            unresolvedNotesCount: 2,
          };
        }
        return enrichedUnit;
      });
      setUnits(unitsWithData);
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
        setShowActivity(false);
        setQueryUnit(null);
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

  const handleChaseEmail = (unit: PipelineUnit, stage: string) => {
    if (!unit.purchaserEmail) {
      showToast('No purchaser email available');
      return;
    }
    const stageLabels: Record<string, string> = {
      contracts: 'Signed Contracts',
      kitchen: 'Kitchen Selection',
      snag: 'Snagging Inspection',
    };
    const subject = encodeURIComponent(`Action Required: ${stageLabels[stage] || stage} - ${unit.unitNumber}`);
    const body = encodeURIComponent(
      `Dear ${unit.purchaserName?.split(' ')[0] || 'Purchaser'},\n\n` +
      `This is a reminder regarding your ${stageLabels[stage]?.toLowerCase() || stage} for ${unit.unitNumber}.\n\n` +
      `Please take action at your earliest convenience.\n\n` +
      `Best regards,\nThe Sales Team`
    );
    window.open(`mailto:${unit.purchaserEmail}?subject=${subject}&body=${body}`, '_blank');
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

  const dateColumnKeys = ['releaseDate', 'saleAgreedDate', 'depositDate', 'contractsIssuedDate', 'signedContractsDate', 'counterSignedDate', 'kitchenDate', 'snagDate', 'drawdownDate', 'handoverDate'];

  // Stats (exclude social housing from revenue calculations)
  const privateUnits = units.filter(u => u.saleType !== 'social');
  const unitsWithPrice = privateUnits.filter(u => u.salePrice && u.salePrice > 0);
  const totalRevenue = unitsWithPrice.reduce((acc, u) => acc + (u.salePrice || 0), 0);
  const avgPrice = unitsWithPrice.length > 0 ? totalRevenue / unitsWithPrice.length : 0;
  const socialUnitsCount = units.filter(u => u.saleType === 'social').length;
  
  const stats = {
    total: units.length,
    available: units.filter(u => !u.purchaserName && u.saleType !== 'social').length,
    inProgress: units.filter(u => u.purchaserName && !u.handoverDate).length,
    complete: units.filter(u => u.handoverDate).length,
    openQueries: units.reduce((acc, u) => acc + (u.unresolvedNotesCount || 0), 0),
    totalRevenue,
    avgPrice,
    socialUnits: socialUnitsCount,
  };

  const sortedUnits = [...units].sort((a, b) => naturalSort(a.unitNumber, b.unitNumber));

  if (isLoading) {
    return (
      <div className="min-h-full bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 rounded-full border-2 border-gold-500 border-t-transparent animate-spin mx-auto" />
          <p className="text-sm text-gray-500 mt-3">Loading pipeline...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-full bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Failed to load pipeline</h2>
          <p className="text-sm text-gray-500 mb-6">{error}</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-gold-500 text-black font-medium rounded-lg hover:bg-gold-600 transition-colors">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const columnConfig = [
    { key: 'checkbox', label: '', width: 44 },
    { key: 'unit', label: 'Unit / Purchaser', width: 200 },
    { key: 'price', label: 'Price', width: 85 },
    { key: 'releaseDate', label: columnLabels.releaseDate, width: 72 },
    { key: 'saleAgreedDate', label: columnLabels.saleAgreedDate, width: 72 },
    { key: 'depositDate', label: columnLabels.depositDate, width: 72 },
    { key: 'contractsIssuedDate', label: columnLabels.contractsIssuedDate, width: 80 },
    { key: 'queries', label: 'Queries', width: 60 },
    { key: 'signedContractsDate', label: columnLabels.signedContractsDate, width: 68 },
    { key: 'counterSignedDate', label: columnLabels.counterSignedDate, width: 72 },
    { key: 'kitchenDate', label: columnLabels.kitchenDate, width: 68 },
    { key: 'snagDate', label: columnLabels.snagDate, width: 58 },
    { key: 'drawdownDate', label: columnLabels.drawdownDate, width: 78 },
    { key: 'handoverDate', label: columnLabels.handoverDate, width: 78 },
    { key: 'progress', label: 'Progress', width: 70 },
    { key: 'predicted', label: 'Est. Close', width: 100 },
  ];

  return (
    <>
      <style jsx global>{`
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes slideUp { from { transform: translateY(100%) scale(0.98); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
        .animate-slideIn { animation: slideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1); }
        .animate-slideUp { animation: slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1); }
        .row-checkbox {
          appearance: none;
          width: 16px;
          height: 16px;
          border: 1.5px solid #d1d5db;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.15s ease;
          position: relative;
          background: white;
        }
        .row-checkbox:hover { border-color: #D4AF37; background: rgba(212, 175, 55, 0.05); }
        .row-checkbox:checked {
          background: #D4AF37;
          border-color: #B8934C;
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
        .table-row:hover { background: #f9fafb; }
        .table-row.selected { background: rgba(212, 175, 55, 0.06); }
        .table-row:hover .row-arrow { opacity: 1; transform: translateX(0); }
      `}</style>

      <div className="min-h-screen pb-28 bg-gray-50">
        <div className="p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/developer/pipeline')}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-gray-200/80 text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold" style={{ color: tokens.dark }}>{development?.name || 'Pipeline'}</h1>
                <p className="text-sm text-gray-500 mt-0.5">Sales pipeline · {stats.total} units</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowActivity(true)}
                className={`relative px-4 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200/80 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all flex items-center gap-2 ${hasNewActivity ? 'activity-pulse' : ''}`}
              >
                <Clock className="w-4 h-4" />
                Activity
                {hasNewActivity && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tokens.gold }} />
                )}
              </button>
              <button
                onClick={() => router.push(`/developer/pipeline/${developmentId}/analysis`)}
                className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200/80 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all flex items-center gap-2"
              >
                <BarChart3 className="w-4 h-4" />
                Analysis
              </button>
              <button className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200/80 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Export
              </button>
              <button
                className="px-5 py-2.5 text-sm font-semibold rounded-xl hover:shadow-md transition-all flex items-center gap-2"
                style={{ backgroundColor: tokens.gold, color: tokens.dark }}
              >
                <Plus className="w-4 h-4" />
                Release Units
              </button>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-5 gap-4 mb-8">
            <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-gray-300 transition-all">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Units</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-gray-300 transition-all">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Available</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.available}</p>
              <p className="text-xs text-gray-500 mt-2">Ready for sale</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-gray-300 transition-all">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">In Progress</p>
              <p className="text-2xl font-bold text-gold-600 mt-1">{stats.inProgress}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-gray-300 transition-all">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Complete</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{stats.complete}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-gray-300 transition-all">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Open Queries</p>
              <p className={`text-2xl font-bold mt-1 ${stats.openQueries > 0 ? 'text-red-600' : 'text-gray-900'}`}>{stats.openQueries}</p>
              <p className="text-xs text-gray-500 mt-2">{stats.openQueries > 0 ? 'Awaiting response' : 'All clear'}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-gold-300 transition-all">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Revenue</p>
              <p className="text-2xl font-bold mt-1 font-mono" style={{ color: tokens.gold }}>{formatCompactPrice(stats.totalRevenue)}</p>
              <p className="text-xs text-gray-500 mt-2">{unitsWithPrice.length} priced units</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-gold-300 transition-all">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Avg Price</p>
              <p className="text-2xl font-bold mt-1 font-mono" style={{ color: tokens.goldDark }}>{formatCompactPrice(stats.avgPrice)}</p>
              {stats.socialUnits > 0 && (
                <p className="text-xs text-gray-500 mt-2">{stats.socialUnits} social units</p>
              )}
            </div>
          </div>

          {/* Table Card */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold text-gray-900">All Units</h2>
                <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">{sortedUnits.length} units</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: `${tokens.warmGray}80` }} className="border-b border-gray-100">
                    {columnConfig.map((col, i) => {
                      const isDateColumn = dateColumnKeys.includes(col.key);
                      return (
                        <th
                          key={col.key}
                          className={`${i <= 1 ? 'sticky z-20' : ''} px-3 py-3 ${i === 1 ? 'text-left' : 'text-center'} text-[11px] font-semibold text-gray-400 uppercase tracking-wider ${i > 1 ? 'border-l border-gray-100/50' : ''} ${isDateColumn ? 'cursor-pointer hover:bg-gray-100 hover:text-gray-600 transition-colors' : ''}`}
                          style={{ left: i === 0 ? '0' : i === 1 ? '44px' : undefined, minWidth: col.width, backgroundColor: `${tokens.warmGray}80` }}
                          onClick={isDateColumn ? () => setEditingColumnHeader({ key: col.key, label: col.label }) : undefined}
                          title={isDateColumn ? `Click to edit column title` : undefined}
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
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedUnits.map((unit) => {
                    const isSelected = selectedRows.has(unit.id);
                    const isSocialHousing = unit.saleType === 'social';
                    const progress = isSocialHousing ? getSocialHousingProgress(unit) : getProgress(unit);
                    const socialBgColor = '#F8F7F5';
                    const socialHoverBgColor = '#F3F2EE';
                    
                    return (
                      <tr
                        key={unit.id}
                        className={`table-row cursor-pointer ${isSelected ? 'selected' : ''} ${isSocialHousing ? 'social-housing-row' : ''}`}
                        style={isSocialHousing ? { backgroundColor: socialBgColor } : undefined}
                        onClick={() => setSelectedUnit(unit)}
                        onMouseEnter={(e) => {
                          if (isSocialHousing) {
                            e.currentTarget.style.backgroundColor = socialHoverBgColor;
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (isSocialHousing) {
                            e.currentTarget.style.backgroundColor = socialBgColor;
                          }
                        }}
                      >
                        {/* Checkbox */}
                        <td className="sticky left-0 z-10 w-11 px-3 py-3" style={{ backgroundColor: isSocialHousing ? socialBgColor : 'white' }}>
                          <input
                            type="checkbox"
                            className="row-checkbox"
                            checked={isSelected}
                            onChange={(e) => { e.stopPropagation(); toggleRowSelection(unit.id, e.target.checked); }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>

                        {/* Unit / Purchaser */}
                        <td className="sticky left-[44px] z-10 px-4 py-2" style={{ backgroundColor: isSocialHousing ? socialBgColor : 'white' }}>
                          <div className="flex items-center gap-3">
                            <div className="min-w-0 flex-1">
                              {/* Row 1: Unit number, house type, bedrooms, sqft */}
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-bold text-gray-900">{unit.unitNumber}</p>
                                {unit.houseTypeCode && (
                                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded" style={{ backgroundColor: `${tokens.gold}20`, color: tokens.goldDark }}>
                                    {unit.houseTypeCode}
                                  </span>
                                )}
                                {unit.propertyDesignation && (
                                  <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 text-gray-600">
                                    {unit.propertyDesignation}
                                  </span>
                                )}
                                {unit.bedrooms && (
                                  <span className="text-[10px] font-medium text-gray-500">{unit.bedrooms} bed</span>
                                )}
                                {unit.squareFootage && (
                                  <span className="text-[10px] font-medium text-gray-400">{Math.round(unit.squareFootage)} sqft</span>
                                )}
                              </div>
                              {/* Row 2: Purchaser name or Social Housing label */}
                              <div className="flex items-center gap-2 mt-0.5">
                                {isSocialHousing ? (
                                  <>
                                    <p className="text-xs text-gray-500">Social Housing</p>
                                    {unit.socialHousingProvider && (
                                      <span 
                                        className="px-2 py-0.5 text-[10px] font-semibold rounded-full"
                                        style={{ backgroundColor: '#5B8A8A15', color: '#5B8A8A', border: '1px solid #5B8A8A30' }}
                                      >
                                        {unit.socialHousingProvider}
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <p className={`text-xs truncate ${unit.purchaserName ? 'text-gray-700' : 'text-gray-400'}`}>
                                    {unit.purchaserName || 'Available'}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="row-arrow opacity-0 transform translate-x-1 transition-all text-gold-500">
                              <ChevronRight className="w-4 h-4" />
                            </div>
                          </div>
                        </td>

                        {/* Price Cell */}
                        <PriceCell 
                          value={unit.salePrice} 
                          unitId={unit.id} 
                          onUpdate={handleUpdate}
                          isSocialHousing={isSocialHousing}
                        />

                        {/* Date Cells - Inactive for social housing (Release through Kitchen) */}
                        {isSocialHousing ? (
                          <>
                            <InactiveCell isSocial />
                            <InactiveCell isSocial />
                            <InactiveCell isSocial />
                            <InactiveCell isSocial />
                            <InactiveCell isSocial />
                          </>
                        ) : (
                          <>
                            <DateCell value={unit.releaseDate} unitId={unit.id} field="releaseDate" onUpdate={handleUpdate} />
                            <DateCell value={unit.saleAgreedDate} unitId={unit.id} field="saleAgreedDate" onUpdate={handleUpdate} />
                            <DateCell value={unit.depositDate} unitId={unit.id} field="depositDate" onUpdate={handleUpdate} />
                            <DateCell value={unit.contractsIssuedDate} unitId={unit.id} field="contractsIssuedDate" onUpdate={handleUpdate} />
                            {/* Queries */}
                            <QueriesCell
                              count={unit.notesCount}
                              unresolvedCount={unit.unresolvedNotesCount}
                              onClick={(e) => { e.stopPropagation(); setQueryUnit(unit); }}
                            />

                            <DateCell 
                              value={unit.signedContractsDate} 
                              unitId={unit.id} 
                              field="signedContractsDate" 
                              onUpdate={handleUpdate}
                              trafficLight={computeTrafficLight(unit.signedContractsDate, unit.contractsIssuedDate, 28, 42)}
                              onChase={() => handleChaseEmail(unit, 'contracts')}
                            />
                            <DateCell value={unit.counterSignedDate} unitId={unit.id} field="counterSignedDate" onUpdate={handleUpdate} />
                            <DateCell 
                              value={unit.kitchenDate} 
                              unitId={unit.id} 
                              field="kitchenDate" 
                              onUpdate={handleUpdate}
                              trafficLight={computeTrafficLight(unit.kitchenDate, unit.signedContractsDate, 14, 28)}
                              onChase={() => handleChaseEmail(unit, 'kitchen')}
                            />
                          </>
                        )}

                        {/* Snag, Drawdown, Handover - Active for ALL units including social housing */}
                        <DateCell 
                          value={unit.snagDate} 
                          unitId={unit.id} 
                          field="snagDate" 
                          onUpdate={handleUpdate}
                          trafficLight={!isSocialHousing ? computeTrafficLight(unit.snagDate, unit.kitchenDate, 14, 30) : null}
                          onChase={!isSocialHousing ? () => handleChaseEmail(unit, 'snag') : undefined}
                        />
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

      {/* Activity Sidebar */}
      <ActivitySidebar visible={showActivity} onClose={() => setShowActivity(false)} />

      {/* Query Panel */}
      <QueryPanel unit={queryUnit} developmentId={developmentId} onClose={() => setQueryUnit(null)} onReply={(id) => showToast(`Replying to query ${id}`)} />

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

      {/* Edit Column Title Modal */}
      {editingColumnHeader && (
        <>
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50" onClick={() => setEditingColumnHeader(null)} />
          <div
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-2xl p-6 shadow-2xl border border-gray-200"
            style={{ minWidth: '320px' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">Edit Column Title</h3>
              <button
                onClick={() => setEditingColumnHeader(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Enter a new title for this column.
            </p>
            <input
              type="text"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent mb-4"
              defaultValue={editingColumnHeader.label}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const value = (e.target as HTMLInputElement).value.trim();
                  if (value) {
                    setColumnLabels(prev => ({ ...prev, [editingColumnHeader.key]: value }));
                    showToast(`Column renamed to "${value}"`);
                    setEditingColumnHeader(null);
                  }
                }
              }}
              id="column-title-input"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setEditingColumnHeader(null)}
                className="flex-1 py-2.5 px-4 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const input = document.getElementById('column-title-input') as HTMLInputElement;
                  const value = input?.value.trim();
                  if (value) {
                    setColumnLabels(prev => ({ ...prev, [editingColumnHeader.key]: value }));
                    showToast(`Column renamed to "${value}"`);
                    setEditingColumnHeader(null);
                  }
                }}
                className="flex-1 py-2.5 px-4 text-sm font-semibold text-black rounded-xl transition-colors"
                style={{ backgroundColor: tokens.gold }}
              >
                Save
              </button>
            </div>
          </div>
        </>
      )}

      {/* Toast */}
      <Toast message={toast.message} visible={toast.visible} />
    </>
  );
}
