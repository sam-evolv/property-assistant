'use client';

import { useCallback, useRef, useState } from 'react';
import Image from 'next/image';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileText,
  Loader2,
  UploadCloud,
  X,
} from 'lucide-react';

const DOCUMENT_CATEGORIES = [
  'Commissioning Certificate',
  'Manufacturer Warranty',
  'SEAI Grant Documentation',
  'BER Certificate',
  'Installation Photos',
  'Compliance Certificate',
  'Handover Pack',
  'Other',
] as const;

const JOB_TYPES = [
  'Solar PV Installation',
  'Heat Pump Installation',
  'EV Charger Installation',
  'Battery Storage Installation',
  'Insulation / Deep Retrofit',
  'Ventilation (MVHR)',
  'Other',
] as const;

type Step = 'lookup' | 'details' | 'upload' | 'done';

type QueuedFile = {
  file: File;
  category: (typeof DOCUMENT_CATEGORIES)[number];
};

type Details = {
  name: string;
  company: string;
  email: string;
  phone: string;
  propertyAddress: string;
  jobType: string;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function Stepper({ step }: { step: Step }) {
  const order: Step[] = ['lookup', 'details', 'upload'];
  const currentIndex = Math.min(order.indexOf(step), order.length - 1);
  return (
    <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
      {order.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <span
            className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
              i <= currentIndex
                ? 'bg-[#D4AF37] text-white'
                : 'bg-gray-200 text-gray-500'
            }`}
          >
            {i + 1}
          </span>
          <span className={i <= currentIndex ? 'text-gray-900' : ''}>
            {s === 'lookup' ? 'Job' : s === 'details' ? 'Details' : 'Upload'}
          </span>
          {i < order.length - 1 && <span className="mx-1 text-gray-300">/</span>}
        </div>
      ))}
    </div>
  );
}

export default function SESystemsUploadPage() {
  const [step, setStep] = useState<Step>('lookup');
  const [jobReference, setJobReference] = useState('');
  const [skipReference, setSkipReference] = useState(false);
  const [details, setDetails] = useState<Details>({
    name: '',
    company: '',
    email: '',
    phone: '',
    propertyAddress: '',
    jobType: '',
  });
  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ reference: string; count: number } | null>(
    null,
  );
  const dropRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  /* ── Step 1: job lookup ── */
  const onLookup = useCallback(async () => {
    setError(null);
    if (!jobReference.trim() && !skipReference) {
      setError('Enter a job reference or tap "I do not have a reference".');
      return;
    }
    if (jobReference.trim()) {
      try {
        await fetch('/api/care/third-party/lookup-job', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobReference: jobReference.trim() }),
        });
      } catch {
        // No job system integration yet, continue.
      }
    }
    setStep('details');
  }, [jobReference, skipReference]);

  /* ── Step 2: details ── */
  const detailsValid =
    details.name.trim() && details.email.trim() && (jobReference.trim() || (details.propertyAddress.trim() && details.jobType));

  /* ── Step 3: file handling ── */
  const addFiles = (list: FileList | File[]) => {
    const additions: QueuedFile[] = [];
    Array.from(list).forEach((f) => {
      if (f.size > 50 * 1024 * 1024) {
        setError(`${f.name} is larger than 50 MB.`);
        return;
      }
      additions.push({ file: f, category: 'Other' });
    });
    setFiles((prev) => [...prev, ...additions]);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const onBrowse = () => fileInput.current?.click();

  const setCategory = (i: number, cat: (typeof DOCUMENT_CATEGORIES)[number]) => {
    setFiles((prev) => prev.map((f, idx) => (idx === i ? { ...f, category: cat } : f)));
  };

  const remove = (i: number) => setFiles((prev) => prev.filter((_, idx) => idx !== i));

  /* ── Submission: init → PUT to signed URL → complete ── */
  const submit = async () => {
    setError(null);
    if (files.length === 0) {
      setError('Add at least one document.');
      return;
    }
    setSubmitting(true);

    let lastReference: string | null = null;
    try {
      for (const queued of files) {
        const initRes = await fetch('/api/care/third-party/upload-init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            submitterName: details.name.trim(),
            submitterCompany: details.company.trim() || null,
            submitterEmail: details.email.trim(),
            submitterPhone: details.phone.trim() || null,
            jobReference: jobReference.trim() || null,
            propertyAddress: details.propertyAddress.trim() || null,
            jobType: details.jobType || null,
            documentName: queued.file.name,
            documentCategory: queued.category,
          }),
        });
        if (!initRes.ok) {
          const err = await initRes.json().catch(() => ({}));
          throw new Error(err.error ?? 'Upload could not be started.');
        }
        const init = (await initRes.json()) as {
          uploadId: string;
          bucket: string;
          storagePath: string;
          signedUrl: string;
        };

        const putRes = await fetch(init.signedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': queued.file.type || 'application/octet-stream' },
          body: queued.file,
        });
        if (!putRes.ok) throw new Error(`Failed to upload ${queued.file.name}.`);

        const completeRes = await fetch('/api/care/third-party/upload-complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uploadId: init.uploadId,
            storagePath: init.storagePath,
            documentSizeBytes: queued.file.size,
          }),
        });
        if (!completeRes.ok) throw new Error('Server could not finalise the upload.');
        const done = (await completeRes.json()) as { reference: string };
        lastReference = done.reference;
      }

      setConfirmation({
        reference: lastReference ?? 'TPU-DEMO',
        count: files.length,
      });
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── UI ── */
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <Image
            src="/branding/se-systems-logo.svg"
            alt="SE Systems"
            width={140}
            height={36}
            className="h-9 w-auto object-contain"
            style={{ filter: 'brightness(0)' }}
            priority
          />
          {step !== 'done' && <Stepper step={step} />}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {step === 'lookup' && (
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
            <h1 className="text-2xl font-bold text-gray-900">
              Upload documentation to SE Systems
            </h1>
            <p className="mt-2 text-gray-600">
              This portal is for installers and fitters submitting completion documents to
              SE Systems Cork. No account is needed. Start by entering a job reference if
              you have one.
            </p>

            <div className="mt-8 space-y-5">
              <label className="block">
                <span className="block text-sm font-semibold text-gray-800 mb-1.5">
                  SE Systems job reference
                </span>
                <input
                  type="text"
                  value={jobReference}
                  onChange={(e) => {
                    setJobReference(e.target.value);
                    setSkipReference(false);
                  }}
                  placeholder="e.g. SE-2026-0412"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm
                    focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40 focus:border-[#D4AF37]"
                />
              </label>

              <div className="text-center text-xs text-gray-500">or</div>

              <button
                type="button"
                onClick={() => {
                  setSkipReference(true);
                  setJobReference('');
                  setStep('details');
                }}
                className="w-full flex items-center justify-between rounded-xl border border-gray-200
                  bg-gray-50 hover:bg-gray-100 px-4 py-3 text-sm font-medium text-gray-800"
              >
                I do not have a job reference
                <ArrowRight className="w-4 h-4 text-gray-500" />
              </button>

              <button
                type="button"
                onClick={onLookup}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl
                  bg-[#D4AF37] hover:bg-[#C9A961] text-white font-semibold px-4 py-3
                  shadow-sm transition-colors"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </section>
        )}

        {step === 'details' && (
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={() => setStep('lookup')}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                aria-label="Back"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Your details</h1>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Full name" required>
                <input
                  type="text"
                  value={details.name}
                  onChange={(e) => setDetails({ ...details, name: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Company">
                <input
                  type="text"
                  value={details.company}
                  onChange={(e) => setDetails({ ...details, company: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Email" required>
                <input
                  type="email"
                  value={details.email}
                  onChange={(e) => setDetails({ ...details, email: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Phone">
                <input
                  type="tel"
                  value={details.phone}
                  onChange={(e) => setDetails({ ...details, phone: e.target.value })}
                  className={inputClass}
                />
              </Field>

              {!jobReference.trim() && (
                <>
                  <Field label="Property address" required className="sm:col-span-2">
                    <input
                      type="text"
                      value={details.propertyAddress}
                      onChange={(e) =>
                        setDetails({ ...details, propertyAddress: e.target.value })
                      }
                      placeholder="Street, town, county"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Job type" required className="sm:col-span-2">
                    <select
                      value={details.jobType}
                      onChange={(e) => setDetails({ ...details, jobType: e.target.value })}
                      className={inputClass}
                    >
                      <option value="">Select a job type</option>
                      {JOB_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </Field>
                </>
              )}
            </div>

            <button
              type="button"
              disabled={!detailsValid}
              onClick={() => setStep('upload')}
              className="mt-8 w-full inline-flex items-center justify-center gap-2 rounded-xl
                bg-[#D4AF37] hover:bg-[#C9A961] disabled:bg-gray-300 disabled:cursor-not-allowed
                text-white font-semibold px-4 py-3 shadow-sm transition-colors"
            >
              Continue to upload
              <ArrowRight className="w-4 h-4" />
            </button>
          </section>
        )}

        {step === 'upload' && (
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={() => setStep('details')}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                aria-label="Back"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Upload documents</h1>
            </div>

            <div
              ref={dropRef}
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              onClick={onBrowse}
              className="border-2 border-dashed border-gray-300 rounded-2xl p-10 text-center
                cursor-pointer hover:border-[#D4AF37] hover:bg-[#D4AF37]/5 transition-colors"
            >
              <UploadCloud className="w-10 h-10 mx-auto text-gray-400" />
              <p className="mt-3 text-sm font-semibold text-gray-800">
                Drag and drop files, or click to browse
              </p>
              <p className="mt-1 text-xs text-gray-500">
                PDF, images, or common office formats. Max 50 MB per file.
              </p>
              <input
                ref={fileInput}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && addFiles(e.target.files)}
              />
            </div>

            {files.length > 0 && (
              <ul className="mt-6 space-y-3">
                {files.map((f, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3"
                  >
                    <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {f.file.name}
                      </p>
                      <p className="text-xs text-gray-500">{formatBytes(f.file.size)}</p>
                    </div>
                    <select
                      value={f.category}
                      onChange={(e) =>
                        setCategory(i, e.target.value as (typeof DOCUMENT_CATEGORIES)[number])
                      }
                      className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs"
                    >
                      {DOCUMENT_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => remove(i)}
                      className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500"
                      aria-label="Remove"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <button
              type="button"
              disabled={submitting || files.length === 0}
              onClick={submit}
              className="mt-8 w-full inline-flex items-center justify-center gap-2 rounded-xl
                bg-[#D4AF37] hover:bg-[#C9A961] disabled:bg-gray-300 disabled:cursor-not-allowed
                text-white font-semibold px-4 py-3 shadow-sm transition-colors"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Uploading...
                </>
              ) : (
                <>
                  Submit to SE Systems
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </section>
        )}

        {step === 'done' && confirmation && (
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" />
            </div>
            <h1 className="mt-4 text-2xl font-bold text-gray-900">Submission received</h1>
            <p className="mt-2 text-gray-600">
              SE Systems will be notified and will review your submission. You will
              receive a confirmation email.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 px-4 py-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#B8934C]">
                Reference
              </span>
              <span className="text-sm font-semibold text-gray-900">
                {confirmation.reference}
              </span>
            </div>
            <p className="mt-4 text-sm text-gray-500">
              {confirmation.count} document{confirmation.count === 1 ? '' : 's'} submitted.
            </p>
          </section>
        )}
      </main>

      <footer className="mt-10 pb-10 text-center text-xs text-gray-400">
        Powered by OpenHouse
      </footer>
    </div>
  );
}

const inputClass =
  'w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40 focus:border-[#D4AF37]';

function Field({
  label,
  required,
  className = '',
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-sm font-semibold text-gray-800 mb-1.5">
        {label}
        {required && <span className="text-[#D4AF37] ml-1">*</span>}
      </span>
      {children}
    </label>
  );
}
