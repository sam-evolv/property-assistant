'use client';

/**
 * Single unit card on the "By unit" view of /developer/issues.
 *
 * Spec sections 2.2 + 5 of docs/specs/assistant-v2-sprint-3-1.md.
 *
 * Renders the unit header, up to 3 most recent issues, and a footer
 * "Show all N" link if the unit has more than 3 issues in its open
 * count. Tapping the footer expands the card inline, fetching the
 * full list via /api/issues/list?unit_id=<id> with current filters.
 */

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { IssueListRow } from './IssueListRow';
import { IssueUnitCardHeader } from './IssueUnitCardHeader';
import {
  IssueFilters,
  IssueListResponse,
  IssueListRow as IssueListRowType,
  IssueUnitGroup,
} from './types';
import { buildListApiQuery } from './filter-url';

interface IssueUnitCardProps {
  unit: IssueUnitGroup;
  filters: IssueFilters;
  onOpenIssue: (id: string) => void;
}

const EXPANDED_PAGE_SIZE = 200;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

function extractUnitNumber(displayName: string): string | null {
  const match = displayName.match(/\d+[A-Za-z]?$/);
  return match ? match[0] : null;
}

function withinLast24h(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t < TWENTY_FOUR_HOURS_MS;
}

export function IssueUnitCard({ unit, filters, onOpenIssue }: IssueUnitCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [allRows, setAllRows] = useState<IssueListRowType[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unitNumber = extractUnitNumber(unit.unit_display_name);
  const subtitleParts = [unit.development_name, unitNumber].filter(
    (v): v is string => Boolean(v),
  );
  const subtitle = subtitleParts.join(' \u00B7 ');

  const totalCount = unit.open_count;
  const topIssues = unit.issues;
  const hasMore = totalCount > topIssues.length;

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams(
        buildListApiQuery(filters, EXPANDED_PAGE_SIZE, 0),
      );
      params.set('unit_id', unit.unit_id);
      params.set('limit', String(EXPANDED_PAGE_SIZE));
      params.set('offset', '0');
      const res = await fetch(`/api/issues/list?${params.toString()}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        setError("Couldn't load issues for this unit.");
        return;
      }
      const json = (await res.json()) as IssueListResponse;
      setAllRows(json.rows);
    } catch {
      setError("Couldn't load issues for this unit.");
    } finally {
      setLoading(false);
    }
  }, [filters, unit.unit_id]);

  useEffect(() => {
    if (expanded && allRows === null && !loading) {
      void loadAll();
    }
  }, [expanded, allRows, loading, loadAll]);

  // Invalidate fetched expanded rows when filters change so the next
  // expansion pulls fresh data matching the current filter combination.
  useEffect(() => {
    setAllRows(null);
  }, [filters]);

  const rowsToRender = expanded && allRows ? allRows : topIssues;

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden hover:shadow-md hover:border-neutral-300 transition-all">
      <div className="px-5 py-4 border-b border-neutral-100">
        <IssueUnitCardHeader
          title={unit.unit_display_name}
          subtitle={subtitle}
          openCount={unit.open_count}
          urgentHighCount={unit.urgent_high_count}
          worstSeverity={unit.worst_severity}
          newlyEscalated={withinLast24h(unit.latest_escalation_at)}
        />
      </div>

      {expanded && loading && !allRows ? (
        <div className="px-4 py-6 text-body-sm text-neutral-500">
          Loading issues...
        </div>
      ) : expanded && error ? (
        <div className="px-4 py-4 text-body-sm text-red-700 bg-red-50 border-b border-red-100">
          {error}
        </div>
      ) : null}

      {rowsToRender.length > 0 ? (
        <ul>
          {rowsToRender.map((row) => (
            <li key={row.id}>
              <IssueListRow row={row} onOpen={onOpenIssue} />
            </li>
          ))}
        </ul>
      ) : !loading ? (
        <div className="px-4 py-6 text-body-sm text-neutral-500">
          No issues for this unit.
        </div>
      ) : null}

      {hasMore || expanded ? (
        <div className="px-4 py-2 border-t border-neutral-100 flex justify-end">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 text-body-sm text-neutral-600 hover:text-neutral-900 px-2 py-1 rounded-md min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            {expanded ? (
              <>
                Show less
                <ChevronUp className="w-4 h-4" />
              </>
            ) : (
              <>
                Show all {totalCount}
                <ChevronDown className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      ) : null}
    </div>
  );
}
