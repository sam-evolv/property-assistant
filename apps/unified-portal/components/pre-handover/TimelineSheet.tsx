'use client';

import type { Milestone } from '@/lib/pre-handover/types';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  milestones: Milestone[];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function TimelineSheet({ milestones }: Props) {
  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-5">Your Journey</h2>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-[19px] top-[40px] bottom-5 w-0.5 bg-gradient-to-b from-emerald-400 via-[#D4AF37] to-gray-200" />

        {/* Items */}
        <div className="space-y-0">
          {milestones.map((m) => {
            const isComplete = m.completed;
            const isCurrent = m.current;
            const isPending = !isComplete && !isCurrent;

            return (
              <div
                key={m.id}
                className={cn('relative flex items-start gap-4 pb-6', isPending && 'opacity-50')}
              >
                {/* Dot */}
                <div
                  className={cn(
                    'relative z-10 w-10 h-10 rounded-full flex items-center justify-center shrink-0',
                    isComplete && 'bg-gradient-to-br from-emerald-400 to-emerald-500 shadow-lg',
                    isCurrent &&
                      'bg-gradient-to-br from-[#FACC15] to-[#D4AF37] shadow-[0_4px_20px_rgba(212,175,55,0.08)]',
                    isPending && 'bg-gray-200'
                  )}
                >
                  {isComplete ? (
                    <Check className="w-5 h-5 text-white" strokeWidth={2.5} />
                  ) : isCurrent ? (
                    <div className="w-3 h-3 bg-white rounded-full" />
                  ) : (
                    <div className="w-2.5 h-2.5 bg-gray-400 rounded-full" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 pt-2">
                  <div className="flex items-center gap-2">
                    <p
                      className={cn(
                        'text-sm font-semibold',
                        isComplete || isCurrent ? 'text-gray-900' : 'text-gray-500'
                      )}
                    >
                      {m.label}
                    </p>
                    {isCurrent && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#FEF9C3] text-[#A67C3A]">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {m.date ? formatDate(m.date) : m.estimatedDate ? `Est. ${m.estimatedDate}` : ''}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
