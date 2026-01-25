'use client';

import { Calendar, ChevronRight } from 'lucide-react';
import type { Milestone } from '@/lib/pre-handover/types';

interface Props {
  milestones: Milestone[];
  onClick: () => void;
}

export function KeyDatesCard({ milestones, onClick }: Props) {
  const upcoming = milestones
    .filter((m) => !m.completed)
    .slice(0, 2)
    .map((m) => m.label);

  return (
    <button
      onClick={onClick}
      className="group w-full bg-white/90 backdrop-blur-xl border border-white/90 rounded-xl p-3 
        active:scale-[0.98] transition-all duration-200
        shadow-[0_2px_8px_rgba(12,12,12,0.03)] hover:shadow-[0_4px_12px_rgba(212,175,55,0.08)]
        hover:border-[#D4AF37]/20"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#FEFCE8] to-[#FEF9C3] 
            flex items-center justify-center border border-[#D4AF37]/15
            group-hover:shadow-[0_0_12px_rgba(212,175,55,0.12)] transition-all duration-200">
            <Calendar className="w-4 h-4 text-[#A67C3A] group-hover:scale-110 transition-transform duration-200" />
          </div>
          <div className="text-left">
            <p className="text-xs font-semibold text-gray-900">Key Dates</p>
            <p className="text-[10px] text-gray-500 leading-tight">{upcoming.join(', ')}</p>
          </div>
        </div>
        <span className="text-[10px] font-semibold text-[#D4AF37] flex items-center gap-0.5 
          group-hover:gap-1 transition-all duration-200">
          Add
          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform duration-200" />
        </span>
      </div>
    </button>
  );
}
