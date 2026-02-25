'use client';

import { Check, Clock, AlertTriangle, Minus } from 'lucide-react';

interface UnitInfoData {
  unit_id: string;
  unit_name: string;
  development_name: string;
  fields: Array<{
    label: string;
    value: string;
    status: 'complete' | 'pending' | 'overdue' | 'na';
  }>;
}

const STATUS_CONFIG = {
  complete: { icon: Check, color: '#059669' },
  pending: { icon: Clock, color: '#d97706' },
  overdue: { icon: AlertTriangle, color: '#dc2626' },
  na: { icon: Minus, color: '#9ca3af' },
};

export default function UnitInfoCard({ data }: { data: UnitInfoData }) {
  return (
    <div className="rounded-xl border border-[#f3f4f6] overflow-hidden bg-white">
      <div className="px-3.5 py-2.5 bg-[#f9fafb] border-b border-[#f3f4f6]">
        <p className="text-[12px] font-bold text-[#111827]">
          {data.unit_name}
        </p>
        <p className="text-[10px] text-[#9ca3af]">{data.development_name}</p>
      </div>
      <div className="divide-y divide-[#f3f4f6]">
        {data.fields.map((field, i) => {
          const config = STATUS_CONFIG[field.status];
          const Icon = config.icon;
          return (
            <div
              key={i}
              className="flex items-center gap-2.5 px-3.5 py-2"
            >
              <Icon size={14} style={{ color: config.color }} className="flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-[12px] text-[#6b7280]">{field.label}:</span>{' '}
                <span className="text-[12px] font-medium text-[#111827]">
                  {field.value}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
