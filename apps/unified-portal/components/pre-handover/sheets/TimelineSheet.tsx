'use client';

import { SheetHeader } from '../BottomSheet';
import { MILESTONE_ORDER, MILESTONE_LABELS, type UnitPreHandoverData } from '../types';
import { Check, Home } from 'lucide-react';

interface TimelineSheetProps {
  unit: UnitPreHandoverData;
}

function formatShortDate(dateStr: string | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

export function TimelineSheet({ unit }: TimelineSheetProps) {
  const currentIndex = MILESTONE_ORDER.indexOf(unit.currentMilestone as typeof MILESTONE_ORDER[number]);

  return (
    <>
      <SheetHeader title="Your Timeline" />
      <div className="px-6 py-5 space-y-1.5 overflow-auto" style={{ maxHeight: 'calc(75vh - 100px)' }}>
        {MILESTONE_ORDER.map((milestone, index) => {
          const isComplete = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isPending = index > currentIndex;
          const date = unit.milestoneDates[milestone as keyof typeof unit.milestoneDates];
          const estDate = milestone === 'snagging'
            ? unit.estSnaggingDate
            : milestone === 'handover'
            ? unit.estHandoverDate
            : null;
          const isHandover = milestone === 'handover';

          return (
            <div
              key={milestone}
              className={`flex items-center gap-4 p-3.5 rounded-xl transition-all duration-[250ms] ${
                isCurrent ? 'bg-gradient-to-r from-[#FEFCE8]/80 to-[#FEF9C3]/60 border border-[#D4AF37]/20' : 'border border-transparent'
              } ${isPending ? 'opacity-50' : ''} hover:bg-[#FEFCE8]/60`}
            >
              {/* Status Icon */}
              {isComplete && (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#B8941F] 
                  flex items-center justify-center shadow-[0_4px_12px_rgba(212,175,55,0.25)]">
                  <Check className="w-4 h-4 text-white" strokeWidth={3} />
                </div>
              )}
              {isCurrent && (
                <div className="w-10 h-10 rounded-full bg-white border-2 border-[#D4AF37] flex items-center justify-center
                  shadow-[0_0_12px_rgba(212,175,55,0.3)]">
                  <div className="w-3 h-3 bg-gradient-to-br from-[#D4AF37] to-[#FACC15] rounded-full animate-pulse" />
                </div>
              )}
              {isPending && (
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200">
                  {isHandover ? (
                    <Home className="w-4 h-4 text-gray-300" />
                  ) : (
                    <div className="w-2.5 h-2.5 bg-gray-300 rounded-full" />
                  )}
                </div>
              )}

              {/* Label */}
              <div className="flex-1">
                <span
                  className={`text-sm ${
                    isCurrent
                      ? 'font-semibold text-gray-900'
                      : isComplete
                      ? 'font-medium text-gray-900'
                      : 'text-gray-500'
                  }`}
                >
                  {MILESTONE_LABELS[milestone]}
                </span>
                {isCurrent && (
                  <span className="ml-2 text-xs font-semibold text-[#D4AF37]">Current</span>
                )}
              </div>

              {/* Date */}
              <span
                className={`text-xs font-medium ${
                  isCurrent
                    ? 'text-[#D4AF37]'
                    : isComplete
                    ? 'text-gray-500'
                    : 'text-gray-300'
                }`}
              >
                {date
                  ? formatShortDate(date)
                  : estDate
                  ? `Est. ${formatShortDate(estDate)}`
                  : 'Pending'}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}
