'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, ChevronDown, Home, Plus, Loader2, ClipboardList } from 'lucide-react';

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

function handoverChip(days: number | null, dateIso: string | null) {
  if (days === null || !dateIso) return null;
  const date = new Date(dateIso).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });
  if (days < 0) {
    return { text: `Handover passed · ${date}`, cls: 'bg-neutral-100 text-neutral-500' };
  }
  if (days <= 14) {
    return { text: `Handover ${date}`, cls: 'bg-red-100 text-red-700' };
  }
  if (days <= 42) {
    return { text: `Handover ${date}`, cls: 'bg-amber-100 text-amber-700' };
  }
  return { text: `Handover ${date}`, cls: 'bg-neutral-100 text-neutral-600' };
}

export function HousesClient({ initialDevelopmentIds }: { initialDevelopmentIds: string[] }) {
  const router = useRouter();
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [developmentId, setDevelopmentId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [houses, setHouses] = useState<House[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load developments, restore last selection
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

  const developmentName = developments.find((d) => d.id === developmentId)?.name || 'Development';
  const totalOpen = houses.reduce((sum, h) => sum + h.open_snags, 0);

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      <header className="px-4 py-3 bg-white border-b border-neutral-200 sticky top-0 z-10">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-heading-md text-neutral-900">Houses</h1>
          {developments.length > 1 ? (
            <button
              onClick={() => setPickerOpen(!pickerOpen)}
              className="flex items-center gap-1 text-body-sm text-neutral-600 max-w-[200px] min-h-[44px] px-2 active:text-neutral-900"
            >
              <span className="truncate">{developmentName}</span>
              <ChevronDown className="h-4 w-4 flex-shrink-0" />
            </button>
          ) : (
            <span className="text-body-sm text-neutral-500 max-w-[200px] truncate">{developmentName}</span>
          )}
        </div>
        {pickerOpen && (
          <div className="mt-2 rounded-lg border border-neutral-200 bg-white overflow-hidden">
            {developments.map((d) => (
              <button
                key={d.id}
                onClick={() => {
                  setDevelopmentId(d.id);
                  setPickerOpen(false);
                }}
                className={`w-full px-4 py-3 text-left text-body-sm min-h-[44px] active:bg-neutral-50 ${
                  d.id === developmentId ? 'font-semibold text-neutral-900' : 'text-neutral-600'
                }`}
              >
                {d.name}
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="flex-1 px-4 py-4 pb-28 space-y-3">
        {!loading && !error && houses.length > 0 && (
          <p className="text-body-sm text-neutral-500">
            {totalOpen === 0
              ? 'Every snag is cleared. Spotless.'
              : `${totalOpen} open snag${totalOpen === 1 ? '' : 's'} — houses closest to handover first.`}
          </p>
        )}

        {loading ? (
          <div className="space-y-3 pt-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-lg bg-white border border-neutral-200 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-lg bg-white border border-neutral-200 p-6 text-center">
            <p className="text-body-sm text-neutral-600">{error}</p>
            <button
              onClick={() => developmentId && loadHouses(developmentId)}
              className="mt-2 text-body-sm font-semibold text-neutral-900 underline min-h-[44px]"
            >
              Try again
            </button>
          </div>
        ) : houses.length === 0 ? (
          <div className="rounded-lg bg-white border border-neutral-200 p-8 text-center">
            <Home className="mx-auto h-8 w-8 text-neutral-300" />
            <p className="mt-3 text-body-sm text-neutral-600">No houses in this development yet.</p>
          </div>
        ) : (
          houses.map((house) => {
            const chip = handoverChip(house.days_to_handover, house.handover_date);
            return (
              <button
                key={house.id}
                onClick={() => router.push(`/snag/houses/${house.id}`)}
                className="w-full rounded-lg bg-white border border-neutral-200 px-4 py-4 text-left flex items-center gap-3 min-h-[72px] active:bg-neutral-50"
              >
                <div
                  className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    house.open_snags > 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                  }`}
                >
                  {house.open_snags}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-body-md font-semibold text-neutral-900 truncate">{house.label}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {chip && (
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${chip.cls}`}>
                        {chip.text}
                      </span>
                    )}
                    <span className="text-[11px] text-neutral-400">
                      {house.open_snags === 0
                        ? house.done_snags > 0
                          ? `${house.done_snags} done`
                          : 'no snags'
                        : `${house.done_snags} done`}
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 flex-shrink-0 text-neutral-300" />
              </button>
            );
          })
        )}
      </main>

      {/* Bottom actions */}
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-neutral-200 px-4 py-3 flex gap-3" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
        <Link
          href="/snag"
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-3.5 text-body-sm font-semibold text-white min-h-[48px] active:bg-neutral-800"
        >
          <Plus className="h-4 w-4" /> Log a snag
        </Link>
        <Link
          href="/snag"
          className="flex items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-3.5 text-body-sm font-semibold text-neutral-700 min-h-[48px] active:bg-neutral-50"
        >
          <ClipboardList className="h-4 w-4" /> Recent
        </Link>
      </nav>

      {loading && houses.length > 0 && (
        <div className="fixed bottom-20 right-4">
          <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
        </div>
      )}
    </div>
  );
}
