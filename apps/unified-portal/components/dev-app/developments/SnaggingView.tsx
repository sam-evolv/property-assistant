'use client';

import { AlertCircle, Clock, CheckCircle } from 'lucide-react';

interface SnagItem {
  id: string;
  unit_id: string;
  unit_number: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved';
  photo_url?: string;
  created_at: string;
}

interface SnaggingViewProps {
  snags: SnagItem[];
}

const STATUS_CONFIG = {
  open: { icon: AlertCircle, color: '#dc2626', label: 'Open' },
  in_progress: { icon: Clock, color: '#d97706', label: 'In Progress' },
  resolved: { icon: CheckCircle, color: '#059669', label: 'Resolved' },
};

export default function SnaggingView({ snags }: SnaggingViewProps) {
  // Group by unit
  const byUnit = snags.reduce<Record<string, SnagItem[]>>((acc, s) => {
    const key = s.unit_number || s.unit_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  const openCount = snags.filter((s) => s.status === 'open').length;
  const inProgressCount = snags.filter((s) => s.status === 'in_progress').length;
  const resolvedCount = snags.filter((s) => s.status === 'resolved').length;

  return (
    <div className="px-4">
      {/* Summary */}
      <div className="flex gap-3 py-3">
        <div className="flex-1 p-2.5 rounded-xl bg-[rgba(220,38,38,0.05)] text-center">
          <span className="text-[16px] font-bold text-[#dc2626]">{openCount}</span>
          <p className="text-[10px] text-[#6b7280] font-medium">Open</p>
        </div>
        <div className="flex-1 p-2.5 rounded-xl bg-[rgba(217,119,6,0.05)] text-center">
          <span className="text-[16px] font-bold text-[#d97706]">{inProgressCount}</span>
          <p className="text-[10px] text-[#6b7280] font-medium">In Progress</p>
        </div>
        <div className="flex-1 p-2.5 rounded-xl bg-[rgba(5,150,105,0.05)] text-center">
          <span className="text-[16px] font-bold text-[#059669]">{resolvedCount}</span>
          <p className="text-[10px] text-[#6b7280] font-medium">Resolved</p>
        </div>
      </div>

      {/* Snag list by unit */}
      <div className="space-y-4 pb-4">
        {Object.entries(byUnit).map(([unitNum, items]) => (
          <div key={unitNum}>
            <h3 className="text-[12px] font-semibold text-[#6b7280] uppercase tracking-wider mb-2">
              Unit {unitNum}
            </h3>
            <div className="space-y-1.5">
              {items.map((snag) => {
                const config = STATUS_CONFIG[snag.status];
                const Icon = config.icon;
                return (
                  <div
                    key={snag.id}
                    className="flex items-start gap-2.5 p-3 rounded-xl border border-[#f3f4f6]"
                  >
                    <Icon
                      size={16}
                      className="flex-shrink-0 mt-0.5"
                      style={{ color: config.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-[#111827] leading-snug">
                        {snag.description}
                      </p>
                      <p className="text-[11px] mt-0.5" style={{ color: config.color }}>
                        {config.label}
                      </p>
                    </div>
                    {snag.photo_url && (
                      <img
                        src={snag.photo_url}
                        alt="Snag photo"
                        className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
