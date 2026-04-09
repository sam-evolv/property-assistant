'use client';

import { useState } from 'react';
import { AlertCircle, Check, X, ChevronDown, ChevronUp } from 'lucide-react';

interface UnitUpdate {
  unit_id: string;
  unit_reference: string;
  current_status: string;
  new_status: string;
}

interface ConfirmationData {
  action_type: string;
  scheme_id: string;
  reason: string;
  units: UnitUpdate[];
  natural_language_instruction: string;
}

type ConfirmationState = 'pending' | 'confirming' | 'confirmed' | 'cancelled' | 'failed';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  available: { bg: 'rgba(5,150,105,0.08)', text: '#059669' },
  reserved: { bg: 'rgba(37,99,235,0.08)', text: '#2563eb' },
  sold: { bg: 'rgba(212,175,55,0.08)', text: '#B8960C' },
  withdrawn: { bg: 'rgba(220,38,38,0.08)', text: '#dc2626' },
};

function StatusPill({ status }: { status: string }) {
  const key = status.toLowerCase();
  const colors = STATUS_COLORS[key] || { bg: 'rgba(107,114,128,0.08)', text: '#6b7280' };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      {status}
    </span>
  );
}

export default function IntelligenceConfirmation({
  data,
  onResult,
}: {
  data: ConfirmationData;
  onResult?: (result: { confirmed: boolean; updated?: number }) => void;
}) {
  const [state, setState] = useState<ConfirmationState>('pending');
  const [updatedCount, setUpdatedCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [expanded, setExpanded] = useState(false);

  const units = data.units || [];
  const showExpandToggle = units.length > 20;
  const displayUnits = showExpandToggle && !expanded ? units.slice(0, 10) : units;
  const isBulk = units.length > 10;

  const handleConfirm = async () => {
    setState('confirming');

    try {
      const res = await fetch('/api/dev-app/intelligence/actions/update-unit-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheme_id: data.scheme_id,
          units: units.map((u) => ({
            unit_id: u.unit_id,
            new_status: u.new_status,
          })),
          natural_language_instruction: data.natural_language_instruction,
          action: 'confirm',
        }),
      });

      if (res.ok) {
        const result = await res.json();
        if (result.success) {
          setState('confirmed');
          setUpdatedCount(result.updated);
          onResult?.({ confirmed: true, updated: result.updated });
        } else {
          setState('failed');
          setErrorMessage(result.errors?.join(', ') || 'Update failed');
          onResult?.({ confirmed: false });
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        setState('failed');
        setErrorMessage(errData.error || 'Request failed');
        onResult?.({ confirmed: false });
      }
    } catch {
      setState('failed');
      setErrorMessage('Network error. Please try again.');
      onResult?.({ confirmed: false });
    }
  };

  const handleCancel = async () => {
    setState('cancelled');

    try {
      await fetch('/api/dev-app/intelligence/actions/update-unit-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheme_id: data.scheme_id,
          units: units.map((u) => ({
            unit_id: u.unit_id,
            new_status: u.new_status,
          })),
          natural_language_instruction: data.natural_language_instruction,
          action: 'cancel',
        }),
      });
    } catch {
      // Cancellation logging is best-effort
    }

    onResult?.({ confirmed: false });
  };

  // Confirmed state
  if (state === 'confirmed') {
    return (
      <div className="rounded-xl border border-[rgba(5,150,105,0.2)] bg-[rgba(5,150,105,0.04)] p-4">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-[#059669] flex items-center justify-center flex-shrink-0">
            <Check size={12} className="text-white" />
          </div>
          <p className="text-sm font-medium text-[#059669]">
            {updatedCount} unit{updatedCount !== 1 ? 's' : ''} updated successfully
          </p>
        </div>
      </div>
    );
  }

  // Cancelled state
  if (state === 'cancelled') {
    return (
      <div className="rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-4">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-[#6b7280] flex items-center justify-center flex-shrink-0">
            <X size={12} className="text-white" />
          </div>
          <p className="text-sm text-[#6b7280]">Action cancelled</p>
        </div>
      </div>
    );
  }

  // Failed state
  if (state === 'failed') {
    return (
      <div className="rounded-xl border border-[rgba(220,38,38,0.2)] bg-[rgba(220,38,38,0.04)] p-4">
        <div className="flex items-center gap-2">
          <AlertCircle size={16} className="text-[#dc2626] flex-shrink-0" />
          <p className="text-sm text-[#dc2626]">
            Update failed{errorMessage ? `: ${errorMessage}` : ''}
          </p>
        </div>
      </div>
    );
  }

  // Pending / confirming state
  return (
    <div className="rounded-xl border border-[rgba(212,175,55,0.2)] bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          {isBulk && (
            <AlertCircle size={16} className="text-[#d97706] flex-shrink-0" />
          )}
          <p className="text-sm font-semibold text-[#111827]">
            Update {units.length} unit{units.length !== 1 ? 's' : ''}
          </p>
        </div>
        {data.reason && (
          <p className="text-[12px] text-[#6b7280] mt-1">{data.reason}</p>
        )}
      </div>

      {/* Table */}
      <div className="px-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] text-[#9ca3af] uppercase tracking-wider">
              <th className="text-left py-1.5 font-medium">Unit</th>
              <th className="text-left py-1.5 font-medium">Current</th>
              <th className="text-left py-1.5 font-medium">New</th>
            </tr>
          </thead>
          <tbody>
            {displayUnits.map((unit, i) => (
              <tr
                key={unit.unit_id}
                className={i % 2 === 0 ? 'bg-[#f9fafb]' : 'bg-white'}
              >
                <td className="py-1.5 px-1 text-[12px] font-medium text-[#111827]">
                  {unit.unit_reference}
                </td>
                <td className="py-1.5 px-1">
                  <StatusPill status={unit.current_status} />
                </td>
                <td className="py-1.5 px-1">
                  <StatusPill status={unit.new_status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Expand toggle */}
      {showExpandToggle && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1 py-2 text-[12px] text-[#6b7280] hover:text-[#111827] transition-colors"
        >
          {expanded ? (
            <>
              Show less <ChevronUp size={14} />
            </>
          ) : (
            <>
              Show all {units.length} units <ChevronDown size={14} />
            </>
          )}
        </button>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-t border-[#f3f4f6]">
        <button
          onClick={handleCancel}
          disabled={state === 'confirming'}
          className="px-4 py-2 rounded-lg text-[13px] font-medium text-[#6b7280] bg-transparent hover:bg-[#f3f4f6] transition-all duration-150 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={state === 'confirming'}
          className="px-4 py-2 rounded-lg text-[13px] font-medium text-white shadow-sm transition-all duration-150 disabled:opacity-50"
          style={{ backgroundColor: state === 'confirming' ? '#C9A961' : '#D4AF37' }}
        >
          {state === 'confirming' ? 'Updating...' : 'Confirm changes'}
        </button>
      </div>
    </div>
  );
}
