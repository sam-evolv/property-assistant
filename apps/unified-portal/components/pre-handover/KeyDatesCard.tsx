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
      className="group w-full bg-white/90 backdrop-blur-xl border border-white/90 rounded-2xl p-4 
        active:scale-[0.98] transition-all duration-[250ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]
        shadow-[0_2px_12px_rgba(12,12,12,0.04)] hover:shadow-[0_4px_20px_rgba(212,175,55,0.1)]
        hover:border-[#D4AF37]/20"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#FEFCE8] to-[#FEF9C3] 
            flex items-center justify-center border border-[#D4AF37]/15
            group-hover:shadow-[0_0_16px_rgba(212,175,55,0.15)] transition-all duration-[250ms]">
            <Calendar className="w-5 h-5 text-[#A67C3A] group-hover:scale-110 transition-transform duration-[250ms]" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-900">Key Dates</p>
            <p className="text-xs text-gray-500">{upcoming.join(', ')}</p>
          </div>
        </div>
        <span className="text-xs font-semibold text-[#D4AF37] flex items-center gap-1 
          group-hover:gap-2 transition-all duration-[250ms]">
          Add to Calendar
          <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-[250ms]" />
        </span>
      </div>
    </button>
  );
}
