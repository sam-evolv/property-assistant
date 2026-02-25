'use client';

import { useState } from 'react';
import { useSectorTerms } from '@/hooks/useDevApp';

interface PipelineUnit {
  unit_id: string;
  unit_number: string;
  purchaser_name: string;
  stage: string;
  days_at_stage: number;
  status: 'green' | 'amber' | 'red';
  phone?: string;
  email?: string;
  solicitor?: string;
  agent?: string;
  deposit?: number;
  price?: number;
}

interface PipelineViewProps {
  units: PipelineUnit[];
  sector: string;
  onUnitTap: (unit: PipelineUnit) => void;
}

const STATUS_DOTS = {
  green: '#059669',
  amber: '#d97706',
  red: '#dc2626',
};

export default function PipelineView({ units, sector, onUnitTap }: PipelineViewProps) {
  const terms = useSectorTerms(sector);
  const [filter, setFilter] = useState<string>('all');

  const stages = ['all', ...terms.stages];
  const filteredUnits =
    filter === 'all'
      ? units
      : units.filter(
          (u) => u.stage.toLowerCase().replace(/\s+/g, '_') === filter.toLowerCase().replace(/\s+/g, '_')
        );

  return (
    <div>
      {/* Stage filter pills */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-3 px-4">
        {stages.map((stage) => {
          const isActive =
            stage === 'all'
              ? filter === 'all'
              : stage.toLowerCase().replace(/\s+/g, '_') === filter.toLowerCase().replace(/\s+/g, '_');
          return (
            <button
              key={stage}
              onClick={() => setFilter(stage === 'all' ? 'all' : stage)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all"
              style={{
                backgroundColor: isActive ? '#D4AF37' : '#f3f4f6',
                color: isActive ? '#fff' : '#6b7280',
              }}
            >
              {stage === 'all' ? 'All' : stage}
            </button>
          );
        })}
      </div>

      {/* Unit cards */}
      <div className="px-4 space-y-2">
        {filteredUnits.length === 0 ? (
          <p className="text-center text-[13px] text-[#9ca3af] py-8">
            No units at this stage
          </p>
        ) : (
          filteredUnits.map((unit) => (
            <button
              key={unit.unit_id}
              onClick={() => onUnitTap(unit)}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-[#f3f4f6] bg-white text-left transition-all active:scale-[0.97]"
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: STATUS_DOTS[unit.status] }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-semibold text-[#111827]">
                    Unit {unit.unit_number}
                  </span>
                  <span className="text-[11px] text-[#9ca3af]">
                    {unit.days_at_stage}d
                  </span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[12px] text-[#6b7280] truncate">
                    {unit.purchaser_name}
                  </span>
                  <span className="text-[11px] text-[#9ca3af] flex-shrink-0 ml-2">
                    {unit.stage}
                  </span>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
