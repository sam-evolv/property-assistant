'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, Loader2, Leaf, ShieldCheck, BadgeCheck, Info } from 'lucide-react';

type ProgrammeKey = 'hpi' | 'bcar' | 'homebond';

interface Criterion {
  key: string;
  label: string;
  scope: 'home' | 'scheme';
  covered: number;
  total: number;
  source: string;
  missing: string[];
  tracked: boolean;
}

interface ProgrammeData {
  homes: number;
  criteria: Criterion[];
  overallPct: number;
  trackedCriteria: number;
}

const DISPLAY: Record<ProgrammeKey, { title: string; icon: typeof Leaf; iconClass: string }> = {
  hpi: { title: 'HPI evidence readiness', icon: Leaf, iconClass: 'text-emerald-600' },
  bcar: { title: 'BCAR / BCMS evidence readiness', icon: ShieldCheck, iconClass: 'text-sky-600' },
  homebond: { title: 'Homebond evidence readiness', icon: BadgeCheck, iconClass: 'text-gold-600' },
};

export function ProgrammePanel({
  developmentId,
  programme,
}: {
  developmentId: string | null;
  programme: ProgrammeKey;
}) {
  const [data, setData] = useState<ProgrammeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!developmentId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setData(null);
    fetch(`/api/developer/compliance/programme?developmentId=${developmentId}&programme=${programme}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError('Could not load programme readiness.'))
      .finally(() => setLoading(false));
  }, [developmentId, programme]);

  if (!developmentId) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
        Select a development to see its readiness.
      </div>
    );
  }
  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white p-16">
        <Loader2 className="h-6 w-6 animate-spin text-gold-500" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
        {error || 'No data.'}
      </div>
    );
  }

  const display = DISPLAY[programme];
  const Icon = display.icon;
  const r = 30;
  const c = 2 * Math.PI * r;
  const ringColour = data.overallPct === 100 ? '#059669' : data.overallPct >= 60 ? '#D4AF37' : '#d97706';

  return (
    <div className="space-y-4">
      {/* Overall */}
      <div className="flex flex-wrap items-center gap-6 rounded-xl border border-gray-200 bg-white p-5">
        <div className="relative h-20 w-20 flex-shrink-0">
          <svg viewBox="0 0 72 72" className="h-20 w-20 -rotate-90">
            <circle cx="36" cy="36" r={r} fill="none" stroke="#f3f4f6" strokeWidth="7" />
            <circle
              cx="36" cy="36" r={r} fill="none" stroke={ringColour} strokeWidth="7"
              strokeLinecap="round" strokeDasharray={c}
              strokeDashoffset={c - (c * data.overallPct) / 100}
              className="transition-all duration-700"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-base font-bold text-gray-900">
            {data.overallPct}%
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${display.iconClass}`} />
            <h2 className="text-base font-semibold text-gray-900">{display.title}</h2>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {data.homes} home{data.homes === 1 ? '' : 's'} · {data.trackedCriteria} criteria tracked from your live record
          </p>
          <p className="mt-1.5 flex items-start gap-1.5 text-xs text-gray-400">
            <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            Evidence coverage gathered automatically — it supports the programme&apos;s assessment, it isn&apos;t the certification itself.
          </p>
        </div>
      </div>

      {/* Criteria */}
      <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
        {data.criteria.map((cr) => {
          const pct = cr.total > 0 ? Math.round((cr.covered / cr.total) * 100) : 0;
          const complete = cr.tracked && cr.covered === cr.total && cr.total > 0;
          return (
            <div key={cr.key} className={`px-5 py-4 ${cr.tracked ? '' : 'opacity-60'}`}>
              <div className="flex items-center gap-3">
                {complete ? (
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600" />
                ) : cr.tracked ? (
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-500" />
                ) : (
                  <Info className="h-4 w-4 flex-shrink-0 text-gray-300" />
                )}
                <p className="min-w-0 flex-1 text-sm font-semibold text-gray-900">{cr.label}</p>
                <span className="hidden flex-shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 sm:inline">
                  {cr.source}
                </span>
                <span
                  className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                    complete ? 'bg-emerald-50 text-emerald-700' : cr.tracked ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {cr.tracked ? (cr.scope === 'scheme' ? (cr.covered === cr.total ? 'In place' : 'Missing') : `${cr.covered}/${cr.total}`) : 'Not tracked'}
                </span>
              </div>
              {cr.tracked && cr.scope === 'home' && cr.total > 0 && (
                <div className="ml-7 mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: complete ? '#059669' : '#D4AF37' }}
                  />
                </div>
              )}
              {cr.tracked && cr.missing.length > 0 && (
                <p className="ml-7 mt-1.5 text-xs text-gray-400">
                  Missing: {cr.missing.join(', ')}
                  {cr.scope === 'home' && cr.total - cr.covered > cr.missing.length &&
                    ` +${cr.total - cr.covered - cr.missing.length} more`}
                </p>
              )}
              {!cr.tracked && (
                <p className="ml-7 mt-1 text-xs text-gray-400">
                  Add a matching document type (Document Types) to track this automatically.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
