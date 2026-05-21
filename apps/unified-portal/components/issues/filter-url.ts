/**
 * URL <-> filter state codec for /developer/issues. The dashboard URL
 * is the source of truth so a filtered view is bookmarkable. Initial
 * page load parses query params; subsequent edits push a fresh URL.
 */

import {
  DEFAULT_FILTERS,
  IssueFilters,
  IssueSeverity,
  IssueSource,
  IssueStatus,
} from './types';

const VALID_STATUS: IssueStatus[] = ['open', 'reopened', 'resolved', 'closed'];
const VALID_SEVERITY: IssueSeverity[] = ['low', 'medium', 'high', 'urgent'];
const VALID_SOURCE: IssueSource[] = [
  'homeowner_assistant',
  'site_team_snag',
  'snagger_external',
];
const VALID_SORTS: IssueFilters['sort'][] = [
  'created_at_desc',
  'severity_desc',
  'created_at_asc',
];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseCsv<T extends string>(value: string | null, allowed: T[]): T[] {
  if (!value) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is T => (allowed as string[]).includes(s));
}

export function parseFiltersFromSearchParams(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
): IssueFilters {
  const get = (key: string): string | null => {
    if (params instanceof URLSearchParams) return params.get(key);
    const v = params[key];
    if (Array.isArray(v)) return v[0] ?? null;
    return v ?? null;
  };

  const statusRaw = get('status');
  const status = statusRaw === null ? DEFAULT_FILTERS.status : parseCsv(statusRaw, VALID_STATUS);
  const severity = parseCsv(get('severity'), VALID_SEVERITY);
  const source = parseCsv(get('source'), VALID_SOURCE);
  const developmentRaw = get('development_id');
  const development_id = developmentRaw && UUID_RE.test(developmentRaw) ? developmentRaw : null;
  const flagged = get('flagged') === 'true';
  const search = (get('search') ?? '').slice(0, 200);
  const sortRaw = get('sort');
  const sort = sortRaw && (VALID_SORTS as string[]).includes(sortRaw)
    ? (sortRaw as IssueFilters['sort'])
    : DEFAULT_FILTERS.sort;

  return {
    status: status.length > 0 ? status : DEFAULT_FILTERS.status,
    severity,
    source,
    development_id,
    flagged,
    search,
    sort,
  };
}

function statusArraysEqual(a: IssueStatus[], b: IssueStatus[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

export function buildFilterQuery(filters: IssueFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (!statusArraysEqual(filters.status, DEFAULT_FILTERS.status)) {
    params.set('status', filters.status.join(','));
  }
  if (filters.severity.length > 0) {
    params.set('severity', filters.severity.join(','));
  }
  if (filters.source.length > 0) {
    params.set('source', filters.source.join(','));
  }
  if (filters.development_id) {
    params.set('development_id', filters.development_id);
  }
  if (filters.flagged) {
    params.set('flagged', 'true');
  }
  if (filters.search) {
    params.set('search', filters.search);
  }
  if (filters.sort !== DEFAULT_FILTERS.sort) {
    params.set('sort', filters.sort);
  }
  return params;
}

export function buildListApiQuery(filters: IssueFilters, limit: number, offset: number): string {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  if (filters.status.length > 0) {
    params.set('status', filters.status.join(','));
  }
  if (filters.severity.length > 0) {
    params.set('severity', filters.severity.join(','));
  }
  if (filters.source.length > 0) {
    params.set('source', filters.source.join(','));
  }
  if (filters.development_id) {
    params.set('development_id', filters.development_id);
  }
  if (filters.flagged) {
    params.set('flagged', 'true');
  }
  if (filters.search) {
    params.set('search', filters.search);
  }
  if (filters.sort) {
    params.set('sort', filters.sort);
  }
  return params.toString();
}
