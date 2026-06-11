'use client';

import { useRef, useState, DragEvent } from 'react';
import Link from 'next/link';
import {
  UploadCloud, FileSpreadsheet, ArrowRight, ArrowLeft, CheckCircle2,
  Sparkles, AlertCircle, Loader2,
} from 'lucide-react';
import { useCurrentContext } from '@/contexts/CurrentContext';

interface DevelopmentOption {
  id: string;
  name: string;
}

interface DryRunResult {
  mapping: Array<{ field: string; header: string; via: 'heuristic' | 'llm' }>;
  unmappedHeaders: string[];
  sample: Array<{
    unit_identifier: string;
    house_type: string | null;
    purchaser_name: string | null;
    sale_price: number | null;
    dates: Record<string, string>;
  }>;
  counts: {
    totalRows: number;
    newHomes: number;
    purchasers: number;
    withPipelineDates: number;
    duplicates: number;
    invalid: number;
  };
  duplicates: string[];
  errors: string[];
}

interface CommitResult {
  inserted: number;
  skippedDuplicates: number;
  pipelineCreated: number;
  errors: string[];
}

const FIELD_LABELS: Record<string, string> = {
  unit_identifier: 'Address / Unit',
  house_type: 'House type',
  property_designation: 'Designation',
  phase: 'Phase',
  bedrooms: 'Bedrooms',
  eircode: 'Eircode',
  purchaser_name: 'Purchaser',
  purchaser_email: 'Purchaser email',
  purchaser_phone: 'Purchaser phone',
  sale_price: 'Price',
  status: 'Status',
  sale_type: 'Sale type',
  housing_agency: 'Housing agency',
  solicitor_name: 'Solicitor',
  solicitor_email: 'Solicitor email',
  solicitor_phone: 'Solicitor phone',
  release_date: 'Release',
  sale_agreed_date: 'Sale agreed',
  proof_of_funds_date: 'Proof of funds',
  sadrl_date: 'SADRL',
  deposit_date: 'Deposit',
  deposit_receipt_date: 'Receipt',
  loan_approved_date: 'Loan approved',
  contracts_issued_date: 'Contracts issued',
  queries_raised_date: 'Queries raised',
  queries_replied_date: 'Queries replied',
  signed_contracts_date: 'Signed contracts',
  counter_signed_date: 'Counter-signed',
  one_part_returned_date: 'One part returned',
  projected_handover_date: 'Projected handover',
  snagging_start_date: 'Snagging start',
  snag_date: 'Snagging complete',
  drawdown_date: 'Drawdown',
  handover_date: 'Handover',
  mortgage_expiry_date: 'Mortgage expiry',
  comments: 'Comments',
};

type Stage = 'drop' | 'preview' | 'done';

export function ImportClient({ developments }: { developments: DevelopmentOption[] }) {
  const { developmentId: contextDevId } = useCurrentContext();
  const [developmentId, setDevelopmentId] = useState<string>(
    contextDevId && developments.some((d) => d.id === contextDevId)
      ? contextDevId
      : developments[0]?.id || '',
  );
  const [stage, setStage] = useState<Stage>('drop');
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<DryRunResult | null>(null);
  const [result, setResult] = useState<CommitResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const developmentName = developments.find((d) => d.id === developmentId)?.name || 'your scheme';

  const send = async (chosen: File, mode: 'dryRun' | 'commit') => {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', chosen);
      form.append('developmentId', developmentId);
      form.append('mode', mode);
      const res = await fetch('/api/developer/homes/import', { method: 'POST', body: form });
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
      setError('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  };

  const onFile = (chosen: File | null) => {
    if (!chosen) return;
    if (!developmentId) {
      setError('Choose a scheme first.');
      return;
    }
    setFile(chosen);
    send(chosen, 'dryRun');
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    onFile(e.dataTransfer.files?.[0] || null);
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
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-10 sm:px-6 md:pt-16">
      <Link
        href="/developer/homeowners"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-grey-500 hover:text-gold-600"
      >
        <ArrowLeft className="h-4 w-4" /> Homes
      </Link>

      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-grey-900 md:text-4xl">
        Drop in your sales sheet.
      </h1>
      <p className="mt-2 text-base text-grey-500">
        Any tracker, any column names. We read it, you check it, your homes go live —
        purchasers, pipeline dates and all.
      </p>

      {error && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {stage === 'drop' && (
        <div className="mt-8 space-y-5">
          {developments.length > 1 && (
            <div>
              <label className="text-sm font-medium text-grey-700">Scheme</label>
              <select
                value={developmentId}
                onChange={(e) => setDevelopmentId(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-grey-200 bg-white px-4 py-3 text-base text-grey-900 outline-none focus:border-gold-400"
              >
                {developments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            disabled={busy}
            className={`flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-all ${
              dragOver
                ? 'border-gold-500 bg-gold-50'
                : 'border-grey-300 bg-white hover:border-gold-400 hover:bg-gold-50/40'
            } ${busy ? 'opacity-60' : ''}`}
          >
            {busy ? (
              <>
                <Loader2 className="h-9 w-9 animate-spin text-gold-500" />
                <p className="mt-4 text-base font-semibold text-grey-900">Reading {file?.name}…</p>
                <p className="mt-1 text-sm text-grey-500">Matching your columns</p>
              </>
            ) : (
              <>
                <UploadCloud className="h-9 w-9 text-gold-500" />
                <p className="mt-4 text-base font-semibold text-grey-900">
                  Drop your spreadsheet here
                </p>
                <p className="mt-1 text-sm text-grey-500">
                  or tap to choose — Excel or CSV
                </p>
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
          <p className="text-center text-xs text-grey-400">
            Nothing is saved until you confirm on the next step.
          </p>
        </div>
      )}

      {stage === 'preview' && preview && (
        <div className="mt-8 space-y-5">
          <div className="rounded-2xl border border-grey-200 bg-white p-6">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-5 w-5 flex-shrink-0 text-gold-500" />
              <p className="truncate text-sm font-medium text-grey-500">{file?.name}</p>
            </div>
            <p className="mt-4 text-2xl font-semibold tracking-tight text-grey-900">
              {preview.counts.newHomes} home{preview.counts.newHomes === 1 ? '' : 's'}
              {preview.counts.purchasers > 0 && <> · {preview.counts.purchasers} purchaser{preview.counts.purchasers === 1 ? '' : 's'}</>}
              {preview.counts.withPipelineDates > 0 && <> · pipeline detected</>}
            </p>
            <p className="mt-1 text-sm text-grey-500">
              Going into <span className="font-semibold text-grey-700">{developmentName}</span>
              {preview.counts.duplicates > 0 && (
                <> · {preview.counts.duplicates} already on the platform (skipped)</>
              )}
            </p>

            <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-grey-400">
              Here&apos;s what we understood
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {preview.mapping.map((m) => (
                <span
                  key={m.field}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${
                    m.via === 'llm'
                      ? 'border-amber-200 bg-amber-50 text-amber-800'
                      : 'border-grey-200 bg-grey-50 text-grey-700'
                  }`}
                >
                  <span className="font-semibold">{FIELD_LABELS[m.field] || m.field}</span>
                  <span className="text-grey-400">←</span>
                  <span className="max-w-[10rem] truncate">{m.header}</span>
                  {m.via === 'llm' && <Sparkles className="h-3 w-3 text-amber-500" />}
                </span>
              ))}
            </div>
            {preview.unmappedHeaders.length > 0 && (
              <p className="mt-3 text-xs text-grey-400">
                Ignored columns: {preview.unmappedHeaders.join(', ')}
              </p>
            )}
          </div>

          {preview.sample.length > 0 && (
            <div className="overflow-x-auto rounded-2xl border border-grey-200 bg-white">
              <table className="w-full min-w-[28rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-grey-100 text-xs uppercase tracking-wider text-grey-400">
                    <th className="px-4 py-3 font-semibold">Home</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Purchaser</th>
                    <th className="px-4 py-3 font-semibold">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.sample.map((row) => (
                    <tr key={row.unit_identifier} className="border-b border-grey-50 last:border-0">
                      <td className="px-4 py-3 font-medium text-grey-900">{row.unit_identifier}</td>
                      <td className="px-4 py-3 text-grey-600">{row.house_type || '—'}</td>
                      <td className="px-4 py-3 text-grey-600">{row.purchaser_name || 'For sale'}</td>
                      <td className="px-4 py-3 text-grey-600">
                        {row.sale_price ? `€${row.sale_price.toLocaleString('en-IE')}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {preview.errors.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                {preview.errors.length} row{preview.errors.length === 1 ? '' : 's'} skipped
              </p>
              <ul className="mt-1.5 space-y-0.5 text-xs text-amber-800">
                {preview.errors.slice(0, 5).map((e) => <li key={e}>{e}</li>)}
                {preview.errors.length > 5 && <li>…and {preview.errors.length - 5} more</li>}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => file && send(file, 'commit')}
              disabled={busy || preview.counts.newHomes === 0}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gold-500 px-6 py-3.5 text-base font-semibold text-white transition-all hover:bg-gold-600 disabled:opacity-40"
            >
              {busy ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Importing…</>
              ) : (
                <>Confirm import <ArrowRight className="h-4 w-4" /></>
              )}
            </button>
            <button
              onClick={reset}
              disabled={busy}
              className="rounded-xl border border-grey-200 bg-white px-6 py-3.5 text-base font-semibold text-grey-600 transition-all hover:border-gold-400 hover:text-gold-700"
            >
              Choose a different file
            </button>
          </div>
        </div>
      )}

      {stage === 'done' && result && (
        <div className="mt-10 rounded-2xl border border-grey-200 bg-white p-8 text-center md:p-12">
          <CheckCircle2 className="mx-auto h-10 w-10 text-gold-500" />
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-grey-900">
            {result.inserted} home{result.inserted === 1 ? ' is' : 's are'} live.
          </h2>
          <p className="mt-2 text-sm text-grey-500">
            {result.pipelineCreated > 0 && <>{result.pipelineCreated} with pipeline records · </>}
            {result.skippedDuplicates > 0 && <>{result.skippedDuplicates} duplicates skipped · </>}
            purchaser profiles and access codes are ready.
          </p>
          {result.errors.length > 0 && (
            <details className="mx-auto mt-4 max-w-md text-left">
              <summary className="cursor-pointer text-center text-xs font-medium text-amber-600">
                {result.errors.length} note{result.errors.length === 1 ? '' : 's'} from the import
              </summary>
              <ul className="mt-2 space-y-1 text-xs text-grey-500">
                {result.errors.slice(0, 10).map((e) => <li key={e}>{e}</li>)}
              </ul>
            </details>
          )}
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/developer/homeowners"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold-500 px-6 py-3.5 text-base font-semibold text-white transition-all hover:bg-gold-600"
            >
              View your homes <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/developer/archive"
              className="rounded-xl border border-grey-200 bg-white px-6 py-3.5 text-base font-semibold text-grey-600 transition-all hover:border-gold-400 hover:text-gold-700"
            >
              Drop in documents
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
