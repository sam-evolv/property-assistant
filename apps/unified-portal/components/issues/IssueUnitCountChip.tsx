'use client';

/**
 * Small severity-coded count chip used on unit cards.
 *
 * Spec sections 2.2 + 5 + 7 of docs/specs/assistant-v2-sprint-3-1.md.
 *
 * Variants:
 *   - open: neutral-100 bg, neutral-700 text, severity-coloured dot prefix.
 *   - urgent_high: red-50 bg, red-700 text, no dot.
 *
 * Dot colour (open variant) by worst severity:
 *   urgent -> red-600
 *   high   -> red-500
 *   medium -> amber-500
 *   low / null -> neutral-500
 */

import { IssueSeverity } from './types';

type ChipVariant = 'open' | 'urgent_high';

interface IssueUnitCountChipProps {
  variant: ChipVariant;
  count: number;
  label: string;
  worstSeverity?: IssueSeverity | null;
}

function dotClass(severity: IssueSeverity | null | undefined): string {
  switch (severity) {
    case 'urgent':
      return 'bg-red-600';
    case 'high':
      return 'bg-red-500';
    case 'medium':
      return 'bg-amber-500';
    default:
      return 'bg-neutral-500';
  }
}

export function IssueUnitCountChip({
  variant,
  count,
  label,
  worstSeverity,
}: IssueUnitCountChipProps) {
  const containerClass =
    variant === 'urgent_high'
      ? 'bg-red-50 text-red-700'
      : 'bg-neutral-100 text-neutral-700';

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-caption font-medium ${containerClass}`}
    >
      {variant === 'open' ? (
        <span
          aria-hidden
          className={`w-1.5 h-1.5 rounded-full ${dotClass(worstSeverity ?? null)}`}
        />
      ) : null}
      <span className="tabular-nums">{count}</span>
      <span>{label}</span>
    </span>
  );
}
