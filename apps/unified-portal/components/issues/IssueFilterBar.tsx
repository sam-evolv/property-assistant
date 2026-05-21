'use client';

/**
 * Filter bar for /developer/issues. Spec section 6.3.
 *
 * Single row of filter chips (status, source, severity, development,
 * flagged toggle, search). Each chip opens a small sheet with the
 * options for that filter; the Flagged chip is a single toggle.
 *
 * Search is a free text input that filters by title. The server route
 * (/api/issues/list) accepts the term as a `q` query param and applies
 * an ILIKE on title. Input is debounced 300ms so each keystroke does
 * not hit the API.
 *
 * Filter state lives in the parent (IssuesDashboardClient) and the URL.
 * The bar is purely presentational and emits onChange events.
 */

import { useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  Flag,
  Search,
  X,
  Building2,
  AlertCircle,
  Users,
  CircleDot,
} from 'lucide-react';
import {
  DevelopmentLite,
  IssueFilters,
  IssueSeverity,
  IssueSource,
  IssueStatus,
  severityLabel,
  sourceLabel,
  statusLabel,
} from './types';

interface IssueFilterBarProps {
  filters: IssueFilters;
  developments: DevelopmentLite[];
  onChange: (next: IssueFilters) => void;
}

type OpenSheet = 'status' | 'severity' | 'source' | 'development' | null;

const STATUS_OPTIONS: IssueStatus[] = ['open', 'reopened', 'resolved', 'closed'];
const SEVERITY_OPTIONS: IssueSeverity[] = ['urgent', 'high', 'medium', 'low'];
const SOURCE_OPTIONS: IssueSource[] = [
  'homeowner_assistant',
  'site_team_snag',
  'snagger_external',
];

const SEARCH_DEBOUNCE_MS = 300;

export function IssueFilterBar({ filters, developments, onChange }: IssueFilterBarProps) {
  const [openSheet, setOpenSheet] = useState<OpenSheet>(null);
  const [searchDraft, setSearchDraft] = useState(filters.search);
  const filtersRef = useRef(filters);
  const onChangeRef = useRef(onChange);
  const lastCommittedRef = useRef(filters.search);

  useEffect(() => {
    filtersRef.current = filters;
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    setSearchDraft(filters.search);
    lastCommittedRef.current = filters.search;
  }, [filters.search]);

  useEffect(() => {
    const normalized = searchDraft.trim();
    if (normalized === lastCommittedRef.current.trim()) return;
    const handle = window.setTimeout(() => {
      lastCommittedRef.current = normalized;
      onChangeRef.current({ ...filtersRef.current, search: normalized });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [searchDraft]);

  const setStatus = (next: IssueStatus[]) => {
    onChange({ ...filters, status: next.length > 0 ? next : ['open', 'reopened'] });
  };
  const setSeverity = (next: IssueSeverity[]) => onChange({ ...filters, severity: next });
  const setSource = (next: IssueSource[]) => onChange({ ...filters, source: next });
  const setDevelopment = (id: string | null) => onChange({ ...filters, development_id: id });
  const toggleFlagged = () => onChange({ ...filters, flagged: !filters.flagged });
  const clearSearch = () => {
    setSearchDraft('');
    lastCommittedRef.current = '';
    onChange({ ...filters, search: '' });
  };

  const statusChipLabel =
    filters.status.length === 2 && filters.status.includes('open') && filters.status.includes('reopened')
      ? 'Status: Open + Reopened'
      : filters.status.length === 1
      ? `Status: ${statusLabel(filters.status[0])}`
      : `Status: ${filters.status.length} selected`;

  const severityChipLabel =
    filters.severity.length === 0
      ? 'Severity: Any'
      : filters.severity.length === 1
      ? `Severity: ${severityLabel(filters.severity[0])}`
      : `Severity: ${filters.severity.length} selected`;

  const sourceChipLabel =
    filters.source.length === 0
      ? 'Source: Any'
      : filters.source.length === 1
      ? `Source: ${sourceLabel(filters.source[0])}`
      : `Source: ${filters.source.length} selected`;

  const developmentChipLabel = filters.development_id
    ? `Scheme: ${developments.find((d) => d.id === filters.development_id)?.name ?? 'Selected'}`
    : 'Scheme: All';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip
          icon={CircleDot}
          label={statusChipLabel}
          active={
            !(
              filters.status.length === 2 &&
              filters.status.includes('open') &&
              filters.status.includes('reopened')
            )
          }
          onClick={() => setOpenSheet('status')}
        />
        <FilterChip
          icon={AlertCircle}
          label={severityChipLabel}
          active={filters.severity.length > 0}
          onClick={() => setOpenSheet('severity')}
        />
        <FilterChip
          icon={Users}
          label={sourceChipLabel}
          active={filters.source.length > 0}
          onClick={() => setOpenSheet('source')}
        />
        <FilterChip
          icon={Building2}
          label={developmentChipLabel}
          active={!!filters.development_id}
          onClick={() => setOpenSheet('development')}
        />
        <button
          type="button"
          onClick={toggleFlagged}
          aria-pressed={filters.flagged}
          className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-full border text-body-sm transition-colors ${
            filters.flagged
              ? 'bg-brand-500 border-brand-500 text-white hover:bg-brand-600'
              : 'bg-white border-neutral-200 text-neutral-700 hover:border-neutral-300'
          }`}
        >
          <Flag className="w-3.5 h-3.5" />
          Flagged
        </button>

        <div className="ml-auto relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
          <input
            type="search"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                clearSearch();
              }
            }}
            maxLength={200}
            placeholder="Search by title"
            aria-label="Search by title"
            className="w-full h-9 pl-9 pr-9 bg-white border border-neutral-200 rounded-full text-body-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          {searchDraft ? (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 inline-flex items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {openSheet === 'status' ? (
        <MultiSelectSheet
          title="Filter by status"
          options={STATUS_OPTIONS.map((s) => ({ value: s, label: statusLabel(s) }))}
          selected={filters.status}
          onCancel={() => setOpenSheet(null)}
          onConfirm={(next) => {
            setStatus(next as IssueStatus[]);
            setOpenSheet(null);
          }}
        />
      ) : null}

      {openSheet === 'severity' ? (
        <MultiSelectSheet
          title="Filter by severity"
          options={SEVERITY_OPTIONS.map((s) => ({ value: s, label: severityLabel(s) }))}
          selected={filters.severity}
          onCancel={() => setOpenSheet(null)}
          onConfirm={(next) => {
            setSeverity(next as IssueSeverity[]);
            setOpenSheet(null);
          }}
        />
      ) : null}

      {openSheet === 'source' ? (
        <MultiSelectSheet
          title="Filter by source"
          options={SOURCE_OPTIONS.map((s) => ({ value: s, label: sourceLabel(s) }))}
          selected={filters.source}
          onCancel={() => setOpenSheet(null)}
          onConfirm={(next) => {
            setSource(next as IssueSource[]);
            setOpenSheet(null);
          }}
        />
      ) : null}

      {openSheet === 'development' ? (
        <SingleSelectSheet
          title="Filter by scheme"
          options={[{ value: '', label: 'All schemes' }, ...developments.map((d) => ({ value: d.id, label: d.name }))]}
          selected={filters.development_id ?? ''}
          onCancel={() => setOpenSheet(null)}
          onConfirm={(value) => {
            setDevelopment(value ? value : null);
            setOpenSheet(null);
          }}
        />
      ) : null}
    </div>
  );
}

interface FilterChipProps {
  icon: typeof Flag;
  label: string;
  active: boolean;
  onClick: () => void;
}

function FilterChip({ icon: Icon, label, active, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-full border text-body-sm transition-colors ${
        active
          ? 'bg-brand-50 border-brand-500 text-neutral-900'
          : 'bg-white border-neutral-200 text-neutral-700 hover:border-neutral-300'
      }`}
    >
      <Icon className="w-3.5 h-3.5 text-neutral-500" />
      <span className="truncate max-w-[12rem]">{label}</span>
      <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
    </button>
  );
}

interface SheetOption {
  value: string;
  label: string;
}

interface MultiSelectSheetProps {
  title: string;
  options: SheetOption[];
  selected: string[];
  onCancel: () => void;
  onConfirm: (next: string[]) => void;
}

function MultiSelectSheet({ title, options, selected, onCancel, onConfirm }: MultiSelectSheetProps) {
  const [working, setWorking] = useState<string[]>(selected);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  const toggle = (value: string) => {
    setWorking((curr) =>
      curr.includes(value) ? curr.filter((v) => v !== value) : [...curr, value],
    );
  };

  return (
    <div
      className="fixed inset-0 z-modal flex items-end sm:items-center justify-center bg-neutral-900/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={containerRef}
        className="bg-white w-full sm:w-96 sm:rounded-2xl rounded-t-2xl max-h-[80vh] overflow-y-auto"
      >
        <header className="px-4 py-3 border-b border-neutral-200 flex items-center gap-2">
          <h2 className="text-heading-sm text-neutral-900 flex-1">{title}</h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="w-10 h-10 -mr-2 flex items-center justify-center rounded-lg text-neutral-700 hover:bg-neutral-100"
          >
            <X className="w-5 h-5" />
          </button>
        </header>
        <ul className="divide-y divide-neutral-100">
          {options.map((opt) => {
            const isOn = working.includes(opt.value);
            return (
              <li key={opt.value}>
                <button
                  type="button"
                  onClick={() => toggle(opt.value)}
                  className={`w-full px-4 py-3 text-left flex items-center gap-3 min-h-[48px] hover:bg-neutral-50 ${
                    isOn ? 'bg-brand-50' : ''
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center ${
                      isOn ? 'bg-brand-500 border-brand-500' : 'border-neutral-300 bg-white'
                    }`}
                  >
                    {isOn ? <Check className="w-3.5 h-3.5 text-white" /> : null}
                  </span>
                  <span className="flex-1 text-body text-neutral-900">{opt.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="sticky bottom-0 bg-white border-t border-neutral-200 px-4 py-3 flex gap-2">
          <button
            type="button"
            onClick={() => setWorking([])}
            className="px-3 py-2 text-body-sm text-neutral-700 hover:bg-neutral-100 rounded-lg min-h-[40px]"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => onConfirm(working)}
            className="ml-auto px-4 py-2 bg-brand-500 text-white rounded-lg text-body-sm font-medium hover:bg-brand-600 min-h-[40px]"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

interface SingleSelectSheetProps {
  title: string;
  options: SheetOption[];
  selected: string;
  onCancel: () => void;
  onConfirm: (next: string) => void;
}

function SingleSelectSheet({ title, options, selected, onCancel, onConfirm }: SingleSelectSheetProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-modal flex items-end sm:items-center justify-center bg-neutral-900/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="bg-white w-full sm:w-96 sm:rounded-2xl rounded-t-2xl max-h-[80vh] overflow-y-auto">
        <header className="px-4 py-3 border-b border-neutral-200 flex items-center gap-2">
          <h2 className="text-heading-sm text-neutral-900 flex-1">{title}</h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="w-10 h-10 -mr-2 flex items-center justify-center rounded-lg text-neutral-700 hover:bg-neutral-100"
          >
            <X className="w-5 h-5" />
          </button>
        </header>
        <ul className="divide-y divide-neutral-100">
          {options.map((opt) => {
            const isOn = selected === opt.value;
            return (
              <li key={opt.value || 'all'}>
                <button
                  type="button"
                  onClick={() => onConfirm(opt.value)}
                  className={`w-full px-4 py-3 text-left flex items-center gap-3 min-h-[48px] hover:bg-neutral-50 ${
                    isOn ? 'bg-brand-50' : ''
                  }`}
                >
                  <span className="flex-1 text-body text-neutral-900">{opt.label}</span>
                  {isOn ? <Check className="w-5 h-5 text-brand-600" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
