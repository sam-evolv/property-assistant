'use client';

import { Check, Clock, AlertTriangle } from 'lucide-react';

interface Selection {
  id: string;
  unit_id: string;
  unit_number: string;
  kitchen_choice?: string;
  status: 'confirmed' | 'pending' | 'overdue';
  deadline?: string;
}

interface SelectionsViewProps {
  selections: Selection[];
}

const STATUS_CONFIG = {
  confirmed: { icon: Check, color: '#059669', label: 'Confirmed', bg: 'rgba(5,150,105,0.05)' },
  pending: { icon: Clock, color: '#d97706', label: 'Pending', bg: 'rgba(217,119,6,0.05)' },
  overdue: { icon: AlertTriangle, color: '#dc2626', label: 'Overdue', bg: 'rgba(220,38,38,0.05)' },
};

export default function SelectionsView({ selections }: SelectionsViewProps) {
  return (
    <div className="px-4 space-y-2 pb-4">
      {selections.length === 0 ? (
        <p className="text-center text-[13px] text-[#9ca3af] py-8">
          No selections recorded
        </p>
      ) : (
        selections.map((sel) => {
          const config = STATUS_CONFIG[sel.status];
          const Icon = config.icon;
          return (
            <div
              key={sel.id}
              className="flex items-center gap-3 p-3.5 rounded-xl border border-[#f3f4f6]"
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: config.bg }}
              >
                <Icon size={14} style={{ color: config.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-[#111827]">
                    Unit {sel.unit_number}
                  </span>
                  <span
                    className="text-[11px] font-medium"
                    style={{ color: config.color }}
                  >
                    {config.label}
                  </span>
                </div>
                {sel.kitchen_choice && (
                  <p className="text-[12px] text-[#6b7280] mt-0.5 truncate">
                    {sel.kitchen_choice}
                  </p>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
