'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, ArrowRight, CheckCircle2, FileSpreadsheet, Loader2, UploadCloud, AlertCircle, Sparkles,
} from 'lucide-react';

interface Development {
  id: string;
  name: string;
}

interface UnitOption {
  id: string;
  label: string;
}

interface DryRun {
  mapping: Array<{ field: string; header: string }>;
  unmappedHeaders: string[];
  counts: {
    totalRows: number;
    snags: number;
    houses: number;
    alreadyDone: number;
    unmatched: number;
    invalid: number;
  };
  sample: Array<{ title: string; room: string | null; unit_identifier: string | null; resolved: boolean }>;
  unmatched: string[];
  errors: string[];
}

interface CommitResult {
  inserted: number;
  resolvedImported: number;
  classified: number;
  skippedUnmatched: number;
  houses: number;
  errors: string[];
}

const FIELD_LABELS: Record<string, string> = {
  unit_identifier: 'House',
  room: 'Room',
  title: 'Snag',
  description: 'Description',
  trade: 'Trade',
  severity: 'Severity',
  status: 'Status',
  date: 'Date',
};

type Stage = 'drop' | 'preview' | 'done';

export function SnagImportClient() {
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [developmentId, setDevelopmentId] = useState<string>('');
  const [unitOptions, setUnitOptions] = useState<UnitOption[]>([]);
  const [unitId, setUnitId] = useState<string>('');
  const [stage, setStage] = useState<Stage>('drop');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<DryRun | null>(null);
  const [result, setResult] = useState<CommitResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/snag/developments')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        const devs: Development[] = data.developments || [];
        setDevelopments(devs);
        if (devs[0]) setDevelopmentId(devs[0].id);
      })
      .catch(() => setError('Could not load your developments.'));
  }, []);

  useEffect(() => {
    setUnitId('');
    if (!developmentId) return;
    fetch(`/api/snag/units?development_id=${developmentId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        const list = Array.isArray(data?.units) ? data.units : [];
        setUnitOptions(
          list.map((u: any) => ({
            id: u.id,
            label: u.label || u.unit_number || u.address || 'Unit',
          })),
        );
      })
      .catch(() => setUnitOptions([]));
  }, [developmentId]);

  const send = async (chosen: File, mode: 'dryRun' | 'commit') => {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', chosen);
      form.append('development_id', developmentId);
      if (unitId) form.append('unit_id', unitId);
      form.append('mode', mode);
      const res = await fetch('/api/snag/import', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong reading that file.');
        return;
      }
      if (mode === 'dryRun') {
        setPreview(data);
        setStage('preview');
      } else {
        setResult(data);
        setStage('done');
      }
    } catch {
      setError('Network error — try again.');
    } finally {
      setBusy(false);
    }
  };

  const onFile = (chosen: File | null) => {
    if (!chosen) return;
    if (!developmentId) {
      setError('Choose a development first.');
      return;
    }
    setFile(chosen);
    send(chosen, 'dryRun');
  };

  const reset = () => {
    setStage('drop');
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="px-4 py-3 bg-white border-b border-neutral-200 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/snag/houses" className="p-2 -ml-2 min-h-[44px] flex items-center text-neutral-500 active:text-neutral-900">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-heading-md text-neutral-900">Upload a snag list</h1>
      </header>

      <main className="px-4 py-5 pb-16 space-y-4 max-w-lg mx-auto">
        {error && (
          <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
            <p className="text-body-sm text-red-700">{error}</p>
          </div>
        )}

        {stage === 'drop' && (
          <>
            <p className="text-body-sm text-neutral-500">
              Any spreadsheet — yours or an external engineer&apos;s. We map the columns,
              match the houses and organise every snag.
            </p>

            {developments.length > 1 && (
              <div>
                <label className="text-body-sm font-medium text-neutral-700">Development</label>
                <select
                  value={developmentId}
                  onChange={(e) => setDevelopmentId(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-4 py-3.5 text-body-sm text-neutral-900 outline-none min-h-[48px]"
                >
                  {developments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-body-sm font-medium text-neutral-700">Which house?</label>
              <select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-4 py-3.5 text-body-sm text-neutral-900 outline-none min-h-[48px]"
              >
                <option value="">Several — match houses from the sheet</option>
                {unitOptions.map((u) => (
                  <option key={u.id} value={u.id}>Just {u.label}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className={`flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-12 text-center transition-all ${
                busy ? 'opacity-60 border-neutral-300 bg-white' : 'border-neutral-300 bg-white active:bg-neutral-50'
              }`}
            >
              {busy ? (
                <>
                  <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
                  <p className="mt-3 text-body-md font-semibold text-neutral-900">Reading {file?.name}…</p>
                </>
              ) : (
                <>
                  <UploadCloud className="h-8 w-8 text-neutral-400" />
                  <p className="mt-3 text-body-md font-semibold text-neutral-900">Tap to choose the file</p>
                  <p className="mt-1 text-body-sm text-neutral-500">Excel or CSV</p>
                </>
              )}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0] || null)}
            />
            <p className="text-center text-[11px] text-neutral-400">
              Nothing is saved until you confirm.
            </p>
          </>
        )}

        {stage === 'preview' && preview && (
          <>
            <div className="rounded-lg bg-white border border-neutral-200 p-4">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="h-4 w-4 flex-shrink-0 text-neutral-400" />
                <p className="truncate text-body-sm text-neutral-500">{file?.name}</p>
              </div>
              <p className="mt-3 text-heading-md text-neutral-900">
                {preview.counts.snags} snag{preview.counts.snags === 1 ? '' : 's'} ·{' '}
                {preview.counts.houses} house{preview.counts.houses === 1 ? '' : 's'}
              </p>
              <p className="mt-1 text-body-sm text-neutral-500">
                {preview.counts.alreadyDone > 0 && <>{preview.counts.alreadyDone} marked done in the sheet · </>}
                {preview.counts.unmatched > 0 && <>{preview.counts.unmatched} skipped (no house match) · </>}
                AI will assign trade &amp; severity on import
              </p>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {preview.mapping.map((m) => (
                  <span key={m.field} className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[11px] font-medium text-neutral-600">
                    <span className="font-semibold">{FIELD_LABELS[m.field] || m.field}</span>
                    <span className="text-neutral-300">←</span>
                    <span className="max-w-[8rem] truncate">{m.header}</span>
                  </span>
                ))}
              </div>
              {preview.unmappedHeaders.length > 0 && (
                <p className="mt-2 text-[11px] text-neutral-400">
                  Ignored: {preview.unmappedHeaders.join(', ')}
                </p>
              )}
            </div>

            {preview.sample.length > 0 && (
              <div className="rounded-lg bg-white border border-neutral-200 divide-y divide-neutral-100">
                {preview.sample.map((row, i) => (
                  <div key={i} className="px-4 py-3">
                    <p className="text-body-sm font-semibold text-neutral-900">{row.title}</p>
                    <p className="mt-0.5 text-[11px] text-neutral-500">
                      {[row.unit_identifier, row.room, row.resolved ? 'done' : null].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {preview.unmatched.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                  No house match — will be skipped
                </p>
                <ul className="mt-1 space-y-0.5 text-[11px] text-amber-800">
                  {preview.unmatched.slice(0, 5).map((u) => <li key={u}>{u}</li>)}
                  {preview.unmatched.length > 5 && <li>…and more</li>}
                </ul>
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => file && send(file, 'commit')}
                disabled={busy || preview.counts.snags === 0}
                className="flex items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-3.5 text-body-sm font-semibold text-white min-h-[48px] active:bg-neutral-800 disabled:opacity-50"
              >
                {busy ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Importing &amp; organising…</>
                ) : (
                  <><Sparkles className="h-4 w-4" /> Import {preview.counts.snags} snag{preview.counts.snags === 1 ? '' : 's'}</>
                )}
              </button>
              <button
                onClick={reset}
                disabled={busy}
                className="rounded-lg border border-neutral-200 bg-white px-4 py-3.5 text-body-sm font-semibold text-neutral-700 min-h-[48px] active:bg-neutral-50"
              >
                Choose a different file
              </button>
            </div>
          </>
        )}

        {stage === 'done' && result && (
          <div className="rounded-lg bg-white border border-neutral-200 p-8 text-center">
            <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-600" />
            <p className="mt-3 text-heading-md text-neutral-900">
              {result.inserted} snag{result.inserted === 1 ? '' : 's'} organised.
            </p>
            <p className="mt-1.5 text-body-sm text-neutral-500">
              {result.houses} house{result.houses === 1 ? '' : 's'}
              {result.classified > 0 && <> · {result.classified} trade/severity assigned by AI</>}
              {result.resolvedImported > 0 && <> · {result.resolvedImported} already done</>}
              {result.skippedUnmatched > 0 && <> · {result.skippedUnmatched} skipped</>}
            </p>
            {result.errors.length > 0 && (
              <details className="mt-3 text-left">
                <summary className="cursor-pointer text-center text-[11px] font-medium text-amber-600">
                  {result.errors.length} note{result.errors.length === 1 ? '' : 's'}
                </summary>
                <ul className="mt-1.5 space-y-0.5 text-[11px] text-neutral-500">
                  {result.errors.slice(0, 8).map((e) => <li key={e}>{e}</li>)}
                </ul>
              </details>
            )}
            <Link
              href="/snag/houses"
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-neutral-900 px-5 py-3.5 text-body-sm font-semibold text-white min-h-[48px] active:bg-neutral-800"
            >
              View the houses <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
