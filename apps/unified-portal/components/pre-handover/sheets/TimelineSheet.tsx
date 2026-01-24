'use client';

import { SheetHeader } from '../BottomSheet';
import { MILESTONE_ORDER, MILESTONE_LABELS, type UnitPreHandoverData } from '../types';

// Icons
const CheckIcon = () => (
  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
  </svg>
);

const HomeIcon = () => (
  <svg className="w-4 h-4 text-stone-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

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
      <div className="px-6 py-5 space-y-1 overflow-auto" style={{ maxHeight: 'calc(75vh - 100px)' }}>
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
              className={`flex items-center gap-4 p-3 rounded-xl transition-all ${
                isCurrent ? 'bg-brand-gold/5' : ''
              } ${isPending ? 'opacity-50' : ''} hover:bg-brand-gold/5`}
            >
              {/* Status Icon */}
              {isComplete && (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-gold to-amber-600 flex items-center justify-center shadow-md">
                  <CheckIcon />
                </div>
              )}
              {isCurrent && (
                <div className="w-10 h-10 rounded-full bg-white border-2 border-brand-gold flex items-center justify-center animate-pulse-gold">
                  <div className="w-3 h-3 bg-brand-gold rounded-full" />
                </div>
              )}
              {isPending && (
                <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center">
                  {isHandover ? (
                    <HomeIcon />
                  ) : (
                    <div className="w-2.5 h-2.5 bg-stone-300 rounded-full" />
                  )}
                </div>
              )}

              {/* Label */}
              <div className="flex-1">
                <span
                  className={`text-sm ${
                    isCurrent
                      ? 'font-semibold text-brand-dark'
                      : isComplete
                      ? 'font-medium text-brand-dark'
                      : 'text-brand-muted'
                  }`}
                >
                  {MILESTONE_LABELS[milestone]}
                </span>
                {isCurrent && (
                  <span className="ml-2 text-xs font-medium text-brand-gold">Current</span>
                )}
              </div>

              {/* Date */}
              <span
                className={`text-xs ${
                  isCurrent
                    ? 'font-semibold text-brand-gold'
                    : isComplete
                    ? 'text-brand-muted'
                    : 'text-stone-300'
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
