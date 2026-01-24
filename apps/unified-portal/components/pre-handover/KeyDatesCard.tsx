'use client';

import { Calendar, ChevronRight } from 'lucide-react';
import type { Milestone } from '@/lib/pre-handover/types';

interface Props {
  milestones: Milestone[];
  onClick: () => void;
}

export function KeyDatesCard({ milestones, onClick }: Props) {
  // Get upcoming milestones
  const upcoming = milestones
    .filter((m) => !m.completed)
    .slice(0, 2)
    .map((m) => m.label);

  return (
    <button
      onClick={onClick}
      className="w-full bg-white/85 backdrop-blur border border-white/90 rounded-xl p-4 active:scale-[0.98] transition-transform shadow-[0_2px_12px_rgba(12,12,12,0.04)]"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-rose-500" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-900">Key Dates</p>
            <p className="text-xs text-gray-500">{upcoming.join(', ')}</p>
          </div>
        </div>
        <span className="text-xs font-semibold text-[#D4AF37] flex items-center gap-1">
          Add to Calendar
          <ChevronRight className="w-4 h-4" />
        </span>
      </div>
    </button>
  );
}
