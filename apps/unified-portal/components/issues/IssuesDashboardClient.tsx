'use client';

/**
 * Top-level client for /developer/issues.
 *
 * Sprint 3 spec: docs/specs/assistant-v2-sprint-3.md section 6.2 to 6.5.
 * Sprint 3.1 adds the view toggle and unit-grouped view:
 *   docs/specs/assistant-v2-sprint-3-1.md sections 2 + 5.
 *
 * Responsibilities:
 *   - Overview card counts and filter state.
 *   - View toggle ("By unit" default, "Activity") synced to ?view= in URL.
 *   - Unit-grouped fetch when view=unit, flat list when view=activity.
 *   - URL <-> filter sync (bookmarkable filtered views, browser
 *     back/forward stays in sync).
 *   - Drawer open/close via the ?issue=<id> query param, so the
 *     browser back button closes the drawer without leaving the page.
 *
 * Hydrated with server-rendered initial data so the first paint shows
 * real counts and rows. Filters are derived from the URL on every
 * render so back/forward updates the visible list.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { IssueOverviewCards } from './IssueOverviewCards';
import { IssueFilterBar } from './IssueFilterBar';
import { IssueListRow } from './IssueListRow';
import { IssueDetailDrawer } from './IssueDetailDrawer';
import { IssueViewToggle } from './IssueViewToggle';
import { IssueUnitGrid } from './IssueUnitGrid';
import {
  DashboardInitialData,
  IssueDashboardView,
  IssueFilters,
  IssueListResponse,
  IssueListRow as IssueListRowType,
  IssueOverviewCounts,
  IssueUnitGroup,
  IssueUnitListResponse,
  PAGE_SIZE,
} from './types';
import { buildFilterQuery, buildListApiQuery, parseFiltersFromSearchParams } from './filter-url';

interface IssuesDashboardClientProps {
  initial: DashboardInitialData;
  initialFilters: IssueFilters;
}

const DEFAULT_VIEW: IssueDashboardView = 'unit';

function parseView(raw: string | null): IssueDashboardView {
  return raw === 'activity' ? 'activity' : 'unit';
}

export function IssuesDashboardClient({ initial, initialFilters }: IssuesDashboardClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [overview, setOverview] = useState<IssueOverviewCounts>(initial.overview);
  const [rows, setRows] = useState<IssueListRowType[]>(initial.list.rows);
  const [total, setTotal] = useState<number>(initial.list.total);
  const [units, setUnits] = useState<IssueUnitGroup[]>([]);
  const [unitsLoaded, setUnitsLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const view = parseView(searchParams?.get('view') ?? null);
  const drawerIssueId = searchParams?.get('issue') ?? null;
  const developments = initial.developments;

  const filters = useMemo(
    () => (searchParams ? parseFiltersFromSearchParams(searchParams) : initialFilters),
    [searchParams, initialFilters],
  );
  const filterKey = useMemo(() => stableKey(filters), [filters]);
  const initialFilterKey = useMemo(() => stableKey(initialFilters), [initialFilters]);
  const seenFilterKey = useRef<string>(initialFilterKey);
  const seenUnitFilterKey = useRef<string | null>(null);

  const fetchList = useCallback(
    async (next: IssueFilters, offset: number, append: boolean) => {
      const setBusy = append ? setLoadingMore : setLoading;
      setBusy(true);
      setError(null);
      try {
        const query = buildListApiQuery(next, PAGE_SIZE, offset);
        const res = await fetch(`/api/issues/list?${query}`, { cache: 'no-store' });
        if (!res.ok) {
          setError("Couldn't load issues.");
          return;
        }
        const json = (await res.json()) as IssueListResponse;
        setRows((curr) => (append ? [...curr, ...json.rows] : json.rows));
        setTotal(json.total);
      } catch {
        setError("Couldn't load issues.");
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const fetchUnits = useCallback(async (next: IssueFilters) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams(buildListApiQuery(next, PAGE_SIZE, 0));
      params.set('group_by_unit', 'true');
      const res = await fetch(`/api/issues/list?${params.toString()}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        setError("Couldn't load issues.");
        return;
      }
      const json = (await res.json()) as IssueUnitListResponse;
      setUnits(json.units);
      setUnitsLoaded(true);
    } catch {
      setError("Couldn't load issues.");
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshOverview = useCallback(async () => {
    try {
      const res = await fetch('/api/issues/overview', { cache: 'no-store' });
      if (!res.ok) return;
      const json = (await res.json()) as IssueOverviewCounts;
      setOverview(json);
    } catch {
      // best-effort
    }
  }, []);

  // Refresh the activity list when filters change.
  useEffect(() => {
    if (view !== 'activity') return;
    if (filterKey === seenFilterKey.current) return;
    seenFilterKey.current = filterKey;
    void fetchList(filters, 0, false);
  }, [view, filterKey, filters, fetchList]);

  // Refresh the unit grid when entering the view or when filters change.
  useEffect(() => {
    if (view !== 'unit') return;
    if (unitsLoaded && filterKey === seenUnitFilterKey.current) return;
    seenUnitFilterKey.current = filterKey;
    void fetchUnits(filters);
  }, [view, unitsLoaded, filterKey, filters, fetchUnits]);

  const handleFiltersChange = useCallback(
    (next: IssueFilters) => {
      const params = buildFilterQuery(next);
      const currentView = searchParams?.get('view');
      if (currentView) params.set('view', currentView);
      const issueId = searchParams?.get('issue');
      if (issueId) params.set('issue', issueId);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const handleViewChange = useCallback(
    (next: IssueDashboardView) => {
      if (next === view) return;
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      if (next === DEFAULT_VIEW) {
        params.delete('view');
      } else {
        params.set('view', next);
      }
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams, view],
  );

  const openIssue = (id: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set('issue', id);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const closeDrawer = useCallback(() => {
    if (!drawerIssueId) return;
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      params.delete('issue');
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  }, [drawerIssueId, pathname, router, searchParams]);

  const handleFlagChanged = (id: string, flagged: boolean) => {
    setRows((curr) =>
      curr.map((r) => (r.id === id ? { ...r, developer_flagged: flagged } : r)),
    );
    setUnits((curr) =>
      curr.map((u) => ({
        ...u,
        issues: u.issues.map((r) =>
          r.id === id ? { ...r, developer_flagged: flagged } : r,
        ),
      })),
    );
  };

  const handleNotesChanged = (id: string) => {
    setRows((curr) =>
      curr.map((r) => (r.id === id ? { ...r, note_count: r.note_count + 1 } : r)),
    );
    setUnits((curr) =>
      curr.map((u) => ({
        ...u,
        issues: u.issues.map((r) =>
          r.id === id ? { ...r, note_count: r.note_count + 1 } : r,
        ),
      })),
    );
  };

  const loadMore = () => {
    if (loadingMore || rows.length >= total) return;
    void fetchList(filters, rows.length, true);
  };

  const refreshAll = useCallback(() => {
    void refreshOverview();
    if (view === 'unit') {
      void fetchUnits(filters);
    } else {
      void fetchList(filters, 0, false);
    }
  }, [fetchList, fetchUnits, filters, refreshOverview, view]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handler = () => {
      if (!document.hidden) refreshAll();
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [refreshAll]);

  const hasActiveSearch = filters.search.trim().length > 0;
  const emptyMessage = hasActiveSearch
    ? 'No issues match this search and filters.'
    : 'No issues match these filters.';

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h1 className="text-heading-md text-neutral-900">Issues</h1>
          <p className="text-body-sm text-neutral-600 mt-1">
            Operational visibility across homeowner and snagger reports.
          </p>
        </div>
      </header>

      <IssueViewToggle value={view} onChange={handleViewChange} />

      <IssueOverviewCards counts={overview} />

      <IssueFilterBar
        filters={filters}
        developments={developments}
        onChange={handleFiltersChange}
      />

      {view === 'unit' ? (
        loading && !unitsLoaded ? (
          <div className="bg-white border border-neutral-200 rounded-lg px-4 py-6 text-body-sm text-neutral-500">
            Loading issues...
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-body-sm text-red-700">
            {error}
          </div>
        ) : (
          <IssueUnitGrid units={units} filters={filters} onOpenIssue={openIssue} />
        )
      ) : loading && rows.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-lg px-4 py-6 text-body-sm text-neutral-500">
          Loading issues...
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-body-sm text-red-700">
          {error}
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-lg px-4 py-10 text-center text-body-sm text-neutral-500">
          {emptyMessage}
        </div>
      ) : (
        <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
          <ul>
            {rows.map((row) => (
              <li key={row.id}>
                <IssueListRow row={row} onOpen={openIssue} />
              </li>
            ))}
          </ul>
          {rows.length < total ? (
            <div className="px-4 py-3 border-t border-neutral-100 flex justify-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="px-4 py-2 text-body-sm font-medium text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-md hover:bg-neutral-100 disabled:opacity-60 min-h-[40px]"
              >
                {loadingMore ? 'Loading...' : 'Load more'}
              </button>
            </div>
          ) : null}
        </div>
      )}

      <IssueDetailDrawer
        issueId={drawerIssueId}
        onClose={closeDrawer}
        onFlagChanged={(id, flagged) => {
          handleFlagChanged(id, flagged);
          void refreshOverview();
        }}
        onNotesChanged={handleNotesChanged}
      />
    </div>
  );
}

function stableKey(filters: IssueFilters): string {
  return JSON.stringify({
    status: [...filters.status].sort(),
    severity: [...filters.severity].sort(),
    source: [...filters.source].sort(),
    development_id: filters.development_id,
    flagged: filters.flagged,
    search: filters.search,
    sort: filters.sort,
  });
}
