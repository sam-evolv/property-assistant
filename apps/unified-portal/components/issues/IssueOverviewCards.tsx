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

import { IssueOverviewCounts } from './types';

interface IssueOverviewCardsProps {
  counts: IssueOverviewCounts;
}

interface CardSpec {
  label: string;
  value: number;
  highlighted: boolean;
}

export function IssueOverviewCards({ counts }: IssueOverviewCardsProps) {
  const cards: CardSpec[] = [
    { label: 'Open', value: counts.open, highlighted: false },
    {
      label: 'High priority',
      value: counts.high_priority,
      highlighted: counts.high_priority > 0,
    },
    { label: 'New this week', value: counts.new_this_week, highlighted: false },
    { label: 'Resolved this month', value: counts.resolved_this_month, highlighted: false },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`relative bg-white border rounded-lg px-4 py-4 overflow-hidden ${
            card.highlighted ? 'border-amber-200' : 'border-neutral-200'
          }`}
        >
          <span
            aria-hidden
            className={`absolute left-0 top-0 bottom-0 w-1 ${
              card.highlighted ? 'bg-amber-500' : 'bg-transparent'
            }`}
          />
          <div className="text-caption uppercase tracking-wide text-neutral-500">
            {card.label}
          </div>
          <div className="mt-2 text-3xl font-semibold text-neutral-900 tabular-nums">
            {card.value.toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}
