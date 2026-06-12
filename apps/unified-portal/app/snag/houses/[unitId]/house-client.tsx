'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Camera, Check, ChevronRight, FileCheck2, Loader2, Plus, X,
} from 'lucide-react';
import {
  ASSISTANT_MEDIA_ACCEPT,
  compressSelectionsForUpload,
  normalizeFiles,
  revokeSelections,
  type SelectedAttachment,
} from '@/lib/assistant/attachments';

interface HouseUnit {
  id: string;
  developmentId: string;
  label: string;
  address: string | null;
  handoverDate: string | null;
}

interface SnagRow {
  id: string;
  title: string;
  room: string | null;
  status: string;
  severity_label: string | null;
  created_at: string;
}

const OPEN_STATUSES = ['open', 'reopened'];

function severityChip(severity: string | null) {
  switch ((severity || '').toLowerCase()) {
    case 'high':
    case 'safety':
      return 'bg-red-100 text-red-700';
    case 'medium':
      return 'bg-amber-100 text-amber-700';
    default:
      return 'bg-neutral-100 text-neutral-600';
  }
}

export function HouseClient({ unit }: { unit: HouseUnit }) {
  const [rows, setRows] = useState<SnagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'open' | 'done'>('open');

  // Mark-off sheet state
  const [marking, setMarking] = useState<SnagRow | null>(null);
  const [note, setNote] = useState('');
  const [selections, setSelections] = useState<SelectedAttachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/snag/list?development_id=${unit.developmentId}&unit_id=${unit.id}&limit=200`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setRows(data.rows || []))
      .catch(() => setError('Could not load snags.'))
      .finally(() => setLoading(false));
  }, [unit.developmentId, unit.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => () => revokeSelections(selections), [selections]);

  const openRows = useMemo(() => rows.filter((r) => OPEN_STATUSES.includes(r.status)), [rows]);
  const doneRows = useMemo(() => rows.filter((r) => !OPEN_STATUSES.includes(r.status)), [rows]);
  const shown = tab === 'open' ? openRows : doneRows;

  const allClear = !loading && !error && openRows.length === 0 && doneRows.length > 0;

  const onPickFiles = (files: FileList | null) => {
    if (!files) return;
    const { accepted } = normalizeFiles(files, 6 - selections.length);
    if (accepted.length > 0) setSelections((prev) => [...prev, ...accepted]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const closeSheet = () => {
    revokeSelections(selections);
    setSelections([]);
    setNote('');
    setSheetError(null);
    setMarking(null);
  };

  const markDone = async () => {
    if (!marking || submitting) return;
    setSubmitting(true);
    setSheetError(null);
    try {
      let mediaIds: string[] = [];
      if (selections.length > 0) {
        const compressed = await compressSelectionsForUpload(selections);
        const form = new FormData();
        form.set('conversation_id', crypto.randomUUID());
        form.set('unit_id', unit.id);
        for (const sel of compressed) {
          form.append('files', sel.file, sel.file.name);
        }
        const uploadRes = await fetch('/api/assistant/media/upload', { method: 'POST', body: form });
        if (!uploadRes.ok) {
          setSheetError('Photo upload failed — try again.');
          setSubmitting(false);
          return;
        }
        const uploadJson = await uploadRes.json();
        mediaIds = Array.isArray(uploadJson?.media)
          ? uploadJson.media.map((m: { media_id: string }) => m.media_id).filter(Boolean)
          : [];
      }

      const res = await fetch(`/api/snag/${marking.id}/resolve`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ media_ids: mediaIds, note: note.trim() || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSheetError(data.error || 'Could not mark that snag done.');
        setSubmitting(false);
        return;
      }
      closeSheet();
      load();
    } catch {
      setSheetError('Something went wrong — try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const captureHref = `/snag/new?development_id=${unit.developmentId}&unit_id=${unit.id}`;

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      <header className="px-4 py-3 bg-white border-b border-neutral-200 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/snag/houses" className="p-2 -ml-2 min-h-[44px] flex items-center text-neutral-500 active:text-neutral-900">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-heading-md text-neutral-900 truncate">{unit.label}</h1>
            {unit.handoverDate && (
              <p className="text-[11px] text-neutral-500">
                Handover {new Date(unit.handoverDate).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            )}
          </div>
          <Link
            href={`/snag/houses/${unit.id}/statement`}
            title="Statement of completion"
            className="p-2 -mr-1 min-h-[44px] flex items-center text-neutral-400 active:text-neutral-900"
          >
            <FileCheck2 className="h-5 w-5" />
          </Link>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg bg-neutral-100 p-1">
          {(['open', 'done'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md py-2 text-body-sm font-semibold min-h-[40px] transition-colors ${
                tab === t ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'
              }`}
            >
              {t === 'open' ? `Open · ${openRows.length}` : `Done · ${doneRows.length}`}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 px-4 py-4 pb-28 space-y-3">
        {allClear && (
          <Link
            href={`/snag/houses/${unit.id}/statement`}
            className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4 min-h-[64px] active:bg-emerald-100"
          >
            <FileCheck2 className="h-6 w-6 flex-shrink-0 text-emerald-600" />
            <div className="flex-1">
              <p className="text-body-md font-semibold text-emerald-900">This house is clear.</p>
              <p className="text-[12px] text-emerald-700">View the statement of completion</p>
            </div>
            <ChevronRight className="h-5 w-5 text-emerald-400" />
          </Link>
        )}

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 rounded-lg bg-white border border-neutral-200 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-lg bg-white border border-neutral-200 p-6 text-center">
            <p className="text-body-sm text-neutral-600">{error}</p>
            <button onClick={load} className="mt-2 text-body-sm font-semibold text-neutral-900 underline min-h-[44px]">
              Try again
            </button>
          </div>
        ) : shown.length === 0 ? (
          <div className="rounded-lg bg-white border border-neutral-200 p-8 text-center">
            <p className="text-body-sm text-neutral-600">
              {tab === 'open' ? 'No open snags in this house.' : 'Nothing marked done yet.'}
            </p>
          </div>
        ) : (
          shown.map((row) => (
            <div key={row.id} className="rounded-lg bg-white border border-neutral-200 overflow-hidden">
              <Link href={`/snag/${row.id}`} className="block px-4 pt-3.5 active:bg-neutral-50">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-body-md font-semibold text-neutral-900">{row.title}</p>
                  {row.severity_label && (
                    <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${severityChip(row.severity_label)}`}>
                      {row.severity_label}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 pb-3 text-[12px] text-neutral-500">
                  {row.room ? `${row.room} · ` : ''}
                  {new Date(row.created_at).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })}
                </p>
              </Link>
              {tab === 'open' && (
                <button
                  onClick={() => setMarking(row)}
                  className="w-full border-t border-neutral-100 px-4 py-3 flex items-center justify-center gap-2 text-body-sm font-semibold text-emerald-700 min-h-[48px] active:bg-emerald-50"
                >
                  <Check className="h-4 w-4" /> Mark done
                </button>
              )}
            </div>
          ))
        )}
      </main>

      {/* Bottom action */}
      <nav
        className="fixed bottom-0 inset-x-0 bg-white border-t border-neutral-200 px-4 py-3"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        <Link
          href={captureHref}
          className="flex items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-3.5 text-body-sm font-semibold text-white min-h-[48px] active:bg-neutral-800"
        >
          <Plus className="h-4 w-4" /> Snag this house
        </Link>
      </nav>

      {/* Mark-off sheet */}
      {marking && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={closeSheet}>
          <div
            className="w-full rounded-t-2xl bg-white p-5"
            style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-heading-md text-neutral-900">Mark done</p>
                <p className="mt-0.5 text-body-sm text-neutral-500 line-clamp-1">{marking.title}</p>
              </div>
              <button onClick={closeSheet} className="p-2 -mr-2 text-neutral-400 min-h-[44px]">
                <X className="h-5 w-5" />
              </button>
            </div>

            {sheetError && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700">{sheetError}</p>
            )}

            <div className="mt-4 flex gap-2 overflow-x-auto">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex h-20 w-20 flex-shrink-0 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-neutral-300 text-neutral-500 active:bg-neutral-50"
              >
                <Camera className="h-5 w-5" />
                <span className="text-[10px] font-medium">Photo</span>
              </button>
              {selections.map((sel) => (
                <div key={sel.id} className="relative h-20 w-20 flex-shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={sel.previewUrl} alt="" className="h-full w-full rounded-lg object-cover" />
                  <button
                    onClick={() => {
                      revokeSelections([sel]);
                      setSelections((prev) => prev.filter((s) => s.id !== sel.id));
                    }}
                    className="absolute -right-1.5 -top-1.5 rounded-full bg-neutral-900 p-1 text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={ASSISTANT_MEDIA_ACCEPT}
              capture="environment"
              multiple
              className="hidden"
              onChange={(e) => onPickFiles(e.target.files)}
            />

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note (optional) — e.g. resealed and repainted"
              rows={2}
              className="mt-3 w-full rounded-lg border border-neutral-200 px-3 py-3 text-body-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-400"
            />

            <button
              onClick={markDone}
              disabled={submitting}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3.5 text-body-sm font-semibold text-white min-h-[48px] active:bg-emerald-700 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {selections.length > 0 ? 'Mark done with photo proof' : 'Mark done'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
