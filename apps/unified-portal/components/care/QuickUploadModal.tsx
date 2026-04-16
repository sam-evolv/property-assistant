'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  FileText,
  Loader2,
  Paperclip,
  Search,
  Upload,
  X,
} from 'lucide-react';

type Installation = {
  id: string;
  job_reference: string | null;
  address_line_1: string | null;
  city: string | null;
  county: string | null;
  system_type: string | null;
};

const DOCUMENT_CATEGORIES = [
  'Commissioning Certificate',
  'Manufacturer Warranty',
  'SEAI Grant Documentation',
  'BER Certificate',
  'Installation Photos',
  'Compliance Certificate',
  'Handover Pack',
  'Technical Manual',
  'Other',
] as const;

const MAX_BYTES = 25 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function installationLabel(inst: Installation) {
  const ref = inst.job_reference ?? 'No reference';
  const address = [inst.address_line_1, inst.city].filter(Boolean).join(', ');
  return address ? `${ref} — ${address}` : ref;
}

export function QuickUploadModal({
  open,
  onClose,
  onUploaded,
}: {
  open: boolean;
  onClose: () => void;
  onUploaded?: () => void;
}) {
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [loadingInstallations, setLoadingInstallations] = useState(false);
  const [installationId, setInstallationId] = useState<string>('');
  const [installationQuery, setInstallationQuery] = useState('');
  const [installationListOpen, setInstallationListOpen] = useState(false);
  const [category, setCategory] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const installationBox = useRef<HTMLDivElement>(null);

  const reset = useCallback(() => {
    setInstallationId('');
    setInstallationQuery('');
    setInstallationListOpen(false);
    setCategory('');
    setFile(null);
    setNotes('');
    setDragging(false);
    setError(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoadingInstallations(true);
    fetch('/api/care/installations-all')
      .then((r) => (r.ok ? r.json() : { installations: [] }))
      .then((d) => {
        if (alive) setInstallations(d.installations ?? []);
      })
      .catch(() => {
        if (alive) setInstallations([]);
      })
      .finally(() => {
        if (alive) setLoadingInstallations(false);
      });
    return () => {
      alive = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!installationListOpen) return;
    function onClick(e: MouseEvent) {
      if (!installationBox.current?.contains(e.target as Node)) {
        setInstallationListOpen(false);
      }
    }
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [installationListOpen]);

  const selectedInstallation = useMemo(
    () => installations.find((i) => i.id === installationId) ?? null,
    [installations, installationId],
  );

  const filteredInstallations = useMemo(() => {
    const q = installationQuery.trim().toLowerCase();
    if (!q) return installations;
    return installations.filter((i) => {
      return (
        (i.job_reference ?? '').toLowerCase().includes(q) ||
        (i.address_line_1 ?? '').toLowerCase().includes(q) ||
        (i.city ?? '').toLowerCase().includes(q) ||
        (i.county ?? '').toLowerCase().includes(q)
      );
    });
  }, [installations, installationQuery]);

  const validateFile = useCallback((candidate: File) => {
    if (candidate.size > MAX_BYTES) return 'File exceeds 25 MB limit';
    const lower = candidate.name.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
      return 'Only PDF, JPG, or PNG files are allowed';
    }
    return null;
  }, []);

  const onPickFile = (candidate: File | null) => {
    setError(null);
    if (!candidate) {
      setFile(null);
      return;
    }
    const msg = validateFile(candidate);
    if (msg) {
      setError(msg);
      setFile(null);
      return;
    }
    setFile(candidate);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0] ?? null;
    onPickFile(f);
  };

  const canSubmit = installationId && category && file && !submitting;

  const submit = async () => {
    if (!file || !installationId || !category) return;
    setSubmitting(true);
    setError(null);
    try {
      const body = new FormData();
      body.set('file', file);
      body.set('installation_id', installationId);
      body.set('category', category);
      if (notes.trim()) body.set('notes', notes.trim());

      const res = await fetch('/api/care-dashboard/archive/upload', {
        method: 'POST',
        body,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Upload failed');
      }
      onUploaded?.();
      reset();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setSubmitting(false);
    }
  };

  const close = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
        onClick={close}
        aria-hidden
      />
      <div className="relative z-10 w-full sm:max-w-[560px] bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[95vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Upload to Smart Archive</h2>
          <button
            onClick={close}
            disabled={submitting}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1.5">
              Installation <span className="text-[#D4AF37]">*</span>
            </label>
            <div ref={installationBox} className="relative">
              <button
                type="button"
                onClick={() => setInstallationListOpen((v) => !v)}
                className="w-full flex items-center justify-between rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-left hover:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40 focus:border-[#D4AF37]"
              >
                <span className={selectedInstallation ? 'text-gray-900 truncate' : 'text-gray-400'}>
                  {selectedInstallation
                    ? installationLabel(selectedInstallation)
                    : loadingInstallations
                    ? 'Loading installations…'
                    : 'Select installation'}
                </span>
                <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" className="text-gray-400 ml-2 flex-shrink-0">
                  <path d="M5.25 7.5L10 12.25l4.75-4.75" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {installationListOpen && (
                <div className="absolute z-20 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg max-h-64 overflow-hidden flex flex-col">
                  <div className="p-2 border-b border-gray-100">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <input
                        autoFocus
                        value={installationQuery}
                        onChange={(e) => setInstallationQuery(e.target.value)}
                        placeholder="Search by ref or address…"
                        className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40 focus:border-[#D4AF37]"
                      />
                    </div>
                  </div>
                  <div className="overflow-y-auto">
                    {filteredInstallations.length === 0 ? (
                      <p className="px-4 py-6 text-sm text-gray-500 text-center">
                        No matching installation
                      </p>
                    ) : (
                      filteredInstallations.map((i) => {
                        const active = i.id === installationId;
                        return (
                          <button
                            type="button"
                            key={i.id}
                            onClick={() => {
                              setInstallationId(i.id);
                              setInstallationListOpen(false);
                              setInstallationQuery('');
                            }}
                            className={`w-full flex items-start gap-2 px-4 py-2.5 text-left text-sm hover:bg-gray-50 ${
                              active ? 'bg-[#D4AF37]/10' : ''
                            }`}
                          >
                            <span className="flex-1 min-w-0">
                              <span className="block font-medium text-gray-900 truncate">
                                {i.job_reference ?? 'No reference'}
                              </span>
                              <span className="block text-xs text-gray-500 truncate">
                                {[i.address_line_1, i.city].filter(Boolean).join(', ') || '—'}
                              </span>
                            </span>
                            {active && <CheckCircle2 className="w-4 h-4 text-[#D4AF37] flex-shrink-0" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1.5">
              Category <span className="text-[#D4AF37]">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40 focus:border-[#D4AF37]"
            >
              <option value="">Select category</option>
              {DOCUMENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1.5">
              Document <span className="text-[#D4AF37]">*</span>
            </label>
            {file ? (
              <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
                <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                  <p className="text-xs text-gray-500">{formatSize(file.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onPickFile(null)}
                  className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500"
                  aria-label="Remove file"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileInput.current?.click()}
                className={`rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
                  dragging
                    ? 'border-[#D4AF37] bg-[#D4AF37]/10'
                    : 'border-gray-300 hover:border-[#D4AF37] hover:bg-[#D4AF37]/5'
                }`}
              >
                <Paperclip className="w-7 h-7 mx-auto text-gray-400" />
                <p className="mt-2 text-sm font-medium text-gray-800">
                  Drag a file here or click
                </p>
                <p className="mt-1 text-xs text-gray-500">PDF, JPG, or PNG · up to 25 MB</p>
                <input
                  ref={fileInput}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  className="hidden"
                  onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1.5">
              Notes <span className="text-xs font-normal text-gray-500">(optional)</span>
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything useful about this document…"
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40 focus:border-[#D4AF37] resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={close}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gold-500 rounded-lg hover:bg-gold-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Upload
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default QuickUploadModal;
