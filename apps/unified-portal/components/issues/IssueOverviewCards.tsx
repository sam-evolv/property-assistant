'use client';

/**
 * Four overview cards at the top of /developer/issues.
 *
 * Spec: docs/specs/assistant-v2-sprint-3.md section 6.2.
 *
 * The High priority card gets a subtle amber treatment when count > 0;
 * zero is neutral. Accents are thin coloured bars on the left edge,
 * not gradients or emoji.
 */

import { ClipboardList, AlertTriangle, CalendarPlus, CheckCircle2 } from 'lucide-react';
import { IssueOverviewCounts } from './types';

interface IssueOverviewCardsProps {
  counts: IssueOverviewCounts;
}

export function IssueOverviewCards({ counts }: IssueOverviewCardsProps) {
  const cards = [
    {
      label: 'Open',
      value: counts.open,
      icon: ClipboardList,
      iconClass: 'text-neutral-400 bg-neutral-50',
      highlighted: false,
    },
    {
      label: 'High priority',
      value: counts.high_priority,
      icon: AlertTriangle,
      iconClass: counts.high_priority > 0 ? 'text-amber-600 bg-amber-50' : 'text-neutral-300 bg-neutral-50',
      highlighted: counts.high_priority > 0,
    },
    {
      label: 'New this week',
      value: counts.new_this_week,
      icon: CalendarPlus,
      iconClass: 'text-neutral-400 bg-neutral-50',
      highlighted: false,
    },
    {
      label: 'Resolved this month',
      value: counts.resolved_this_month,
      icon: CheckCircle2,
      iconClass: counts.resolved_this_month > 0 ? 'text-emerald-600 bg-emerald-50' : 'text-neutral-300 bg-neutral-50',
      highlighted: false,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className={`rounded-2xl border bg-white px-5 py-4 transition-shadow hover:shadow-sm ${
              card.highlighted ? 'border-amber-200' : 'border-neutral-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                {card.label}
              </span>
              <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${card.iconClass}`}>
                <Icon className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="mt-2 text-3xl font-semibold tracking-tight text-neutral-900 tabular-nums">
              {card.value.toLocaleString()}
            </div>
          </div>
        );
      })}
    </div>
  );
}
