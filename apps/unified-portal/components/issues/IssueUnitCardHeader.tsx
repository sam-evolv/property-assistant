'use client';

/**
 * Header for a unit card on /developer/issues "By unit" view.
 *
 * Spec sections 2.2 + 5 of docs/specs/assistant-v2-sprint-3-1.md.
 *
 * Layout:
 *   - Left: title (unit display name) and subtitle
 *     ("Development name . unit number" when present).
 *   - Right: open chip (always shown) and an urgent/high chip when
 *     urgent_high_count > 0.
 */

import { IssueSeverity } from './types';
import { IssueUnitCountChip } from './IssueUnitCountChip';

interface IssueUnitCardHeaderProps {
  title: string;
  subtitle: string;
  openCount: number;
  urgentHighCount: number;
  worstSeverity: IssueSeverity | null;
}

function urgentChipLabel(severity: IssueSeverity | null): string {
  if (severity === 'urgent') return 'urgent';
  if (severity === 'high') return 'high';
  return 'urgent';
}

export function IssueUnitCardHeader({
  title,
  subtitle,
  openCount,
  urgentHighCount,
  worstSeverity,
}: IssueUnitCardHeaderProps) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-body font-semibold text-neutral-900 truncate">
          {title}
        </div>
        {subtitle ? (
          <div className="text-body-sm text-neutral-500 truncate mt-0.5">
            {subtitle}
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <IssueUnitCountChip
          variant="open"
          count={openCount}
          label="open"
          worstSeverity={worstSeverity}
        />
        {urgentHighCount > 0 ? (
          <IssueUnitCountChip
            variant="urgent_high"
            count={urgentHighCount}
            label={urgentChipLabel(worstSeverity)}
          />
        ) : null}
      </div>
    </div>
  );
}
