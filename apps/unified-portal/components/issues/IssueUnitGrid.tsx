'use client';

/**
 * Responsive grid of unit cards on /developer/issues "By unit" view.
 *
 * Spec sections 2.2 + 5 of docs/specs/assistant-v2-sprint-3-1.md.
 *
 * Layout: 1 col on mobile, 2 cols at md, 3 cols at lg. Renders an
 * IssueUnitCard per unit returned by the server. Empty state when the
 * filter combination produces no matching units.
 */

import { IssueUnitCard } from './IssueUnitCard';
import { IssueFilters, IssueUnitGroup } from './types';

interface IssueUnitGridProps {
  units: IssueUnitGroup[];
  filters: IssueFilters;
  onOpenIssue: (id: string) => void;
}

export function IssueUnitGrid({ units, filters, onOpenIssue }: IssueUnitGridProps) {
  if (units.length === 0) {
    return (
      <div className="bg-white border border-neutral-200 rounded-lg px-4 py-10 text-center text-body-sm text-neutral-600">
        No units have issues matching these filters.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {units.map((unit) => (
        <IssueUnitCard
          key={unit.unit_id}
          unit={unit}
          filters={filters}
          onOpenIssue={onOpenIssue}
        />
      ))}
    </div>
  );
}
