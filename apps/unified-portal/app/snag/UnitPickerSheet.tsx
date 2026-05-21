'use client';

/**
 * Full-screen sheet for picking a unit. Phone-first: full viewport on
 * mobile, large search input at the top, vertical scrolling list.
 * Spec section 7.2.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Search, X } from 'lucide-react';

export interface SnagUnit {
  id: string;
  display_name: string;
  unit_code: string | null;
  unit_number: string | null;
  address: string | null;
  address_line_1: string | null;
  city: string | null;
  purchaser_name: string | null;
}

interface UnitPickerSheetProps {
  open: boolean;
  units: SnagUnit[];
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  onClose: () => void;
  onSelect: (unit: SnagUnit) => void;
}

function matchesQuery(unit: SnagUnit, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  const haystack = [
    unit.display_name,
    unit.unit_code,
    unit.unit_number,
    unit.address,
    unit.address_line_1,
    unit.city,
    unit.purchaser_name,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

export function UnitPickerSheet({
  open,
  units,
  loading,
  error,
  selectedId,
  onClose,
  onSelect,
}: UnitPickerSheetProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open]);

  const filtered = useMemo(() => units.filter((u) => matchesQuery(u, query)), [units, query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-modal bg-white flex flex-col">
      <header className="px-4 py-3 border-b border-neutral-200 flex items-center gap-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close unit picker"
          className="w-11 h-11 -ml-2 flex items-center justify-center rounded-lg text-neutral-700 hover:bg-neutral-100"
        >
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-heading-sm text-neutral-900">Select unit</h2>
      </header>
      <div className="px-4 py-3 border-b border-neutral-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by unit, address, purchaser"
            className="w-full pl-10 pr-4 py-3 bg-white border border-neutral-200 rounded-lg text-body focus:outline-none focus:ring-2 focus:ring-brand-500"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="px-4 py-8 text-center text-body-sm text-neutral-500">Loading units...</div>
        ) : error ? (
          <div className="px-4 py-8 text-center text-body-sm text-red-600">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-body-sm text-neutral-500">
            {units.length === 0 ? 'No units in this development.' : 'No units match.'}
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {filtered.map((unit) => {
              const isSelected = unit.id === selectedId;
              const subtitle = [unit.address_line_1, unit.address, unit.purchaser_name].filter(Boolean)[0] ?? '';
              return (
                <li key={unit.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(unit)}
                    className={`w-full px-4 py-4 text-left flex items-center gap-3 min-h-[64px] active:bg-neutral-50 ${
                      isSelected ? 'bg-brand-50' : ''
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-body text-neutral-900 truncate">{unit.display_name}</div>
                      {subtitle ? (
                        <div className="text-caption text-neutral-500 truncate">{subtitle}</div>
                      ) : null}
                    </div>
                    <ChevronRight className="w-5 h-5 text-neutral-400" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
