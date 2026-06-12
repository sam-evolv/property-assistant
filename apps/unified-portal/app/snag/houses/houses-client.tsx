'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Check, ChevronDown, Home, Plus, Search, UploadCloud,
} from 'lucide-react';

interface Development {
  id: string;
  name: string;
}

interface House {
  id: string;
  label: string;
  address: string | null;
  open_snags: number;
  done_snags: number;
  handover_date: string | null;
  days_to_handover: number | null;
}

const STORAGE_KEY = 'snag-houses-dev';

/** Urgency chip earns its place only inside the 6-week window. */
function handoverUrgency(days: number | null, dateIso: string | null) {
  if (days === null || !dateIso || days < 0 || days > 42) return null;
  const date = new Date(dateIso).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });
  return {
    text: `HO ${date}`,
    cls: days <= 14 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600',
  };
}

export function HousesClient({ initialDevelopmentIds }: { initialDevelopmentIds: string[] }) {
  const router = useRouter();
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [developmentId, setDevelopmentId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [houses, setHouses] = useState<House[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetch('/api/snag/developments')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        const devs: Development[] = data.developments || [];
        setDevelopments(devs);
        const stored = localStorage.getItem(STORAGE_KEY);
        const initial =
          (stored && devs.find((d) => d.id === stored)?.id) ||
          (initialDevelopmentIds.length > 0 && devs.find((d) => initialDevelopmentIds.includes(d.id))?.id) ||
          devs[0]?.id ||
          null;
        setDevelopmentId(initial);
        if (!initial) setLoading(false);
      })
      .catch(() => {
        setError('Could not load your developments.');
        setLoading(false);
      });
  }, [initialDevelopmentIds]);

  const loadHouses = useCallback((devId: string) => {
    setLoading(true);
    setError(null);
    fetch(`/api/snag/houses?development_id=${devId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setHouses(data.houses || []))
      .catch(() => setError('Could not load houses.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!developmentId) return;
    localStorage.setItem(STORAGE_KEY, developmentId);
    loadHouses(developmentId);
  }, [developmentId, loadHouses]);

  const developmentName = developments.find((d) => d.id === developmentId)?.name || 'Snagging';
  const totalOpen = houses.reduce((sum, h) => sum + h.open_snags, 0);
  const housesWithOpen = houses.filter((h) => h.open_snags > 0).length;

  const q = query.trim().toLowerCase();
  const visibleHouses = q
    ? houses.filter(
        (h) =>
          (h.label || '').toLowerCase().includes(q) ||
          (h.address || '').toLowerCase().includes(q),
      )
    : houses;

  const summary = loading || error
    ? null
    : houses.length === 0
      ? null
      : totalOpen === 0
        ? 'Every snag is closed. Spotless.'
        : `${totalOpen} open snag${totalOpen === 1 ? '' : 's'} across ${housesWithOpen} house${housesWithOpen === 1 ? '' : 's'}`;

  return (
    <div className="flex min-h-screen flex-col bg-neutral-100">
      {/* Dark hero header — this is an OpenHouse product */}
      <header className="sticky top-0 z-20 border-b border-gold-500/15 text-white" style={{ backgroundColor: '#0b0b0d' }}>
        <div className="mx-auto w-full max-w-5xl px-4 pb-4 pt-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-gold-500">
            OpenHouse · Snagging
          </p>

          {developments.length > 1 ? (
            <button
              onClick={() => setPickerOpen(!pickerOpen)}
              className="mt-1 flex max-w-full items-center gap-2 text-2xl font-semibold tracking-tight"
            >
              <span className="truncate">{developmentName}</span>
              <ChevronDown className={`h-5 w-5 flex-shrink-0 text-gold-500 transition-transform ${pickerOpen ? 'rotate-180' : ''}`} />
            </button>
          ) : (
            <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight">{developmentName}</h1>
          )}

          {summary && <p className="mt-1 text-sm text-white/50">{summary}</p>}

          {pickerOpen && (
            <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-white/5">
              {developments.map((d) => (
                <button
                  key={d.id}
                  onClick={() => {
                    setDevelopmentId(d.id);
                    setPickerOpen(false);
                    setQuery('');
                  }}
                  className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm min-h-[44px] active:bg-white/10 ${
                    d.id === developmentId ? 'font-semibold text-gold-400' : 'text-white/70'
                  }`}
                >
                  {d.name}
                  {d.id === developmentId && <Check className="h-4 w-4" />}
                </button>
              ))}
            </div>
          )}

          {!loading && !error && houses.length > 3 && (
            <div className="relative mt-4">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                type="search"
                inputMode="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a house — number or address"
                className="min-h-[46px] w-full rounded-xl border border-white/10 bg-white/10 py-3 pl-10 pr-4 text-[15px] text-white outline-none transition-colors placeholder:text-white/40 focus:border-gold-500/60 focus:bg-white/[0.14]"
              />
            </div>
          )}
        </div>
      </header>

      {/* The board */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-32 pt-5">
        {loading ? (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-2xl bg-white" />
            ))}
          </div>
        ) : error ? (
          <div className="mx-auto max-w-sm rounded-2xl bg-white p-8 text-center shadow-sm">
            <p className="text-sm text-neutral-600">{error}</p>
            <button
              onClick={() => developmentId && loadHouses(developmentId)}
              className="mt-3 text-sm font-semibold text-gold-600 underline-offset-2 hover:underline min-h-[44px]"
            >
              Try again
            </button>
          </div>
        ) : houses.length === 0 ? (
          <div className="mx-auto max-w-sm rounded-2xl bg-white p-10 text-center shadow-sm">
            <Home className="mx-auto h-8 w-8 text-neutral-300" />
            <p className="mt-3 text-sm text-neutral-600">No houses in this development yet.</p>
          </div>
        ) : visibleHouses.length === 0 ? (
          <div className="mx-auto max-w-sm rounded-2xl bg-white p-10 text-center shadow-sm">
            <p className="text-sm text-neutral-600">No house matches “{query.trim()}”.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {visibleHouses.map((house) => {
              const urgency = handoverUrgency(house.days_to_handover, house.handover_date);
              const bigNumber = /^\d+[A-Za-z]?$/.test(house.label);
              const clear = house.open_snags === 0 && house.done_snags > 0;
              return (
                <button
                  key={house.id}
                  onClick={() => router.push(`/snag/houses/${house.id}`)}
                  title={house.address || house.label}
                  className="relative flex aspect-square flex-col items-center justify-center rounded-2xl border border-transparent bg-white p-2 shadow-sm transition-all hover:-translate-y-0.5 hover:border-gold-300 hover:shadow-lg active:scale-[0.97]"
                >
                  {house.open_snags > 0 && (
                    <span className="absolute right-2 top-2 flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white shadow-sm">
                      {house.open_snags}
                    </span>
                  )}
                  {clear && (
                    <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50">
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    </span>
                  )}

                  {bigNumber ? (
                    <p className="text-3xl font-bold tabular-nums tracking-tight text-neutral-900">
                      {house.label}
                    </p>
                  ) : (
                    <p className="line-clamp-2 px-1 text-center text-sm font-bold leading-tight text-neutral-900">
                      {house.label}
                    </p>
                  )}

                  <p className="mt-0.5 line-clamp-1 max-w-full px-1 text-[10px] text-neutral-400">
                    {bigNumber ? (house.address || ' ') : ' '}
                  </p>

                  <div className="mt-1 flex h-5 items-center">
                    {urgency && (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${urgency.cls}`}>
                        {urgency.text}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>

      {/* Actions */}
      <nav
        className="fixed inset-x-0 bottom-0 border-t border-neutral-200 bg-white/95 backdrop-blur"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto flex w-full max-w-5xl gap-3 px-4 py-3">
          <Link
            href="/snag/new"
            className="flex min-h-[50px] flex-1 items-center justify-center gap-2 rounded-xl text-[15px] font-semibold text-black shadow-lg shadow-gold-500/20 transition-all active:scale-[0.99]"
            style={{ background: 'linear-gradient(135deg, #E5C158 0%, #D4AF37 55%, #B8934C 100%)' }}
          >
            <Plus className="h-5 w-5" /> Log a snag
          </Link>
          <Link
            href="/snag/import"
            className="flex min-h-[50px] items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-5 text-[15px] font-semibold text-neutral-700 active:bg-neutral-50"
          >
            <UploadCloud className="h-5 w-5" /> Upload list
          </Link>
        </div>
      </nav>
    </div>
  );
}
