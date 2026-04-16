'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Archive,
  CheckCircle2,
  Clock,
  FileText,
  FolderArchive,
  Inbox,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  Upload,
  X,
  XCircle,
  ArrowUpRight,
} from 'lucide-react';
import { QuickUploadModal } from '@/components/care/QuickUploadModal';

type Upload = {
  id: string;
  submitter_name: string;
  submitter_company: string | null;
  submitter_email: string;
  submitter_phone: string | null;
  job_reference: string | null;
  property_address: string | null;
  job_type: string | null;
  document_name: string;
  document_category: string;
  document_size_bytes: number | null;
  storage_path: string;
  status: 'pending' | 'approved' | 'rejected' | 'filed';
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  preview_url: string | null;
};

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'filed';

const STATUS_STYLES: Record<Upload['status'], { label: string; classes: string; icon: React.ElementType }> = {
  pending: { label: 'Pending', classes: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
  approved: { label: 'Approved', classes: 'bg-blue-50 text-blue-700 border-blue-200', icon: CheckCircle2 },
  rejected: { label: 'Rejected', classes: 'bg-red-50 text-red-700 border-red-200', icon: XCircle },
  filed: { label: 'Filed', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: Archive },
};

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60 * 60) return `${Math.max(1, Math.round(diff / 60))}m ago`;
  if (diff < 60 * 60 * 24) return `${Math.round(diff / 3600)}h ago`;
  if (diff < 60 * 60 * 24 * 7) return `${Math.round(diff / 86400)}d ago`;
  return d.toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatSize(bytes: number | null) {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SmartArchiveInboxPage() {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Upload | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/care-dashboard/third-party?preview=1');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setUploads(data.uploads ?? []);
    } catch {
      setError('Could not load the inbox. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const base = { all: uploads.length, pending: 0, approved: 0, rejected: 0, filed: 0 } as Record<StatusFilter, number>;
    uploads.forEach((u) => {
      base[u.status] = (base[u.status] ?? 0) + 1;
    });
    return base;
  }, [uploads]);

  const filtered = useMemo(() => {
    return uploads.filter((u) => {
      const matchesStatus = filter === 'all' || u.status === filter;
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        u.submitter_name.toLowerCase().includes(q) ||
        (u.submitter_company?.toLowerCase().includes(q) ?? false) ||
        (u.job_reference?.toLowerCase().includes(q) ?? false) ||
        (u.property_address?.toLowerCase().includes(q) ?? false) ||
        u.document_name.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [uploads, filter, search]);

  async function act(u: Upload, status: Upload['status']) {
    setActing(u.id);
    try {
      const res = await fetch(`/api/care-dashboard/third-party/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Action failed');
      }
      await load();
      if (selected?.id === u.id) {
        setSelected((prev) => (prev ? { ...prev, status } : prev));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center">
                <Inbox className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Smart Archive · Inbox</h1>
                <p className="text-gray-500 mt-0.5">
                  Third-party installer submissions awaiting review
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search submissions..."
                  className="pl-9 pr-4 py-2 text-sm rounded-xl border border-gray-200 bg-gray-50
                    focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40 focus:border-[#D4AF37] w-64"
                />
              </div>
              <button
                onClick={load}
                disabled={loading}
                className="p-2.5 rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-900 transition-colors disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setUploadOpen(true)}
                className="inline-flex items-center gap-2 h-10 px-4 text-sm font-medium text-gray-900 bg-gold-500 rounded-lg hover:bg-gold-600 transition-colors"
              >
                <Upload className="w-4 h-4" />
                Upload
              </button>
            </div>
          </div>

          {/* Tabs linking back to the main archive + status filters */}
          <div className="flex items-center gap-1 mt-5 flex-wrap">
            <Link
              href="/care-dashboard/archive"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium
                text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            >
              <FolderArchive className="w-4 h-4" />
              Smart Archive
            </Link>
            <span className="px-3.5 py-1.5 rounded-lg text-sm font-semibold bg-gray-900 text-white inline-flex items-center gap-1.5">
              <Inbox className="w-4 h-4" />
              Inbox
              {counts.pending > 0 && (
                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-[#D4AF37] text-white ml-1">
                  {counts.pending}
                </span>
              )}
            </span>

            <div className="mx-3 h-5 w-px bg-gray-200" />

            {(['all', 'pending', 'approved', 'filed', 'rejected'] as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filter === s
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                <span
                  className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${
                    filter === s ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {counts[s]}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-white border border-gray-200 p-4 animate-pulse">
                <div className="h-4 w-1/3 bg-gray-100 rounded mb-2" />
                <div className="h-3 w-1/2 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
              <Inbox className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-900">Nothing here yet</p>
            <p className="text-xs text-gray-500 mt-1">
              Submissions from the installer upload portal will appear in this inbox.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Submitted</th>
                  <th className="text-left px-4 py-3 font-semibold">Submitter</th>
                  <th className="text-left px-4 py-3 font-semibold">Job / Address</th>
                  <th className="text-left px-4 py-3 font-semibold">Document</th>
                  <th className="text-left px-4 py-3 font-semibold">Category</th>
                  <th className="text-left px-4 py-3 font-semibold">Status</th>
                  <th className="text-right px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filtered.map((u) => {
                  const style = STATUS_STYLES[u.status];
                  const StatusIcon = style.icon;
                  const greyed = u.status === 'filed' || u.status === 'rejected';
                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-gray-50 transition-colors ${greyed ? 'opacity-60' : ''}`}
                    >
                      <td className="px-4 py-3 text-gray-600">{formatDate(u.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{u.submitter_name}</div>
                        {u.submitter_company && (
                          <div className="text-xs text-gray-500">{u.submitter_company}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {u.job_reference ? (
                          <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">
                            {u.job_reference}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-600">
                            {u.property_address ?? '—'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 truncate max-w-[260px]">
                          {u.document_name}
                        </div>
                        <div className="text-xs text-gray-500">{formatSize(u.document_size_bytes)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                          {u.document_category}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${style.classes}`}
                        >
                          <StatusIcon className="w-3 h-3" />
                          {style.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelected(u)}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100"
                          >
                            View
                          </button>
                          {u.status === 'pending' && (
                            <>
                              <button
                                disabled={acting === u.id}
                                onClick={() => act(u, 'approved')}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold text-white bg-[#D4AF37] hover:bg-[#C9A961] disabled:opacity-50"
                              >
                                Approve
                              </button>
                              <button
                                disabled={acting === u.id}
                                onClick={() => act(u, 'rejected')}
                                className="px-2.5 py-1 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {u.status === 'approved' && (
                            <button
                              disabled={acting === u.id}
                              onClick={() => act(u, 'filed')}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                            >
                              File to archive
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail side panel */}
      {selected && (
        <div className="fixed inset-0 z-40" role="dialog">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSelected(null)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500">Submission</p>
                <h2 className="text-lg font-bold text-gray-900 truncate max-w-md">
                  {selected.document_name}
                </h2>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-6">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                  Submitter
                </h3>
                <div className="space-y-1 text-sm">
                  <p className="font-medium text-gray-900">{selected.submitter_name}</p>
                  {selected.submitter_company && (
                    <p className="text-gray-600">{selected.submitter_company}</p>
                  )}
                  <p className="flex items-center gap-1.5 text-gray-600">
                    <Mail className="w-3.5 h-3.5 text-gray-400" /> {selected.submitter_email}
                  </p>
                  {selected.submitter_phone && (
                    <p className="text-gray-600">{selected.submitter_phone}</p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                  Job
                </h3>
                <dl className="grid grid-cols-3 gap-2 text-sm">
                  <dt className="text-gray-500">Reference</dt>
                  <dd className="col-span-2 text-gray-900">
                    {selected.job_reference ?? '—'}
                  </dd>
                  <dt className="text-gray-500">Address</dt>
                  <dd className="col-span-2 text-gray-900">
                    {selected.property_address ?? '—'}
                  </dd>
                  <dt className="text-gray-500">Job type</dt>
                  <dd className="col-span-2 text-gray-900">{selected.job_type ?? '—'}</dd>
                  <dt className="text-gray-500">Category</dt>
                  <dd className="col-span-2 text-gray-900">{selected.document_category}</dd>
                  <dt className="text-gray-500">Size</dt>
                  <dd className="col-span-2 text-gray-900">
                    {formatSize(selected.document_size_bytes)}
                  </dd>
                </dl>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                  Document preview
                </h3>
                {selected.preview_url ? (
                  selected.document_name.toLowerCase().endsWith('.pdf') ? (
                    <iframe
                      src={selected.preview_url}
                      className="w-full h-96 rounded-xl border border-gray-200"
                    />
                  ) : /\.(png|jpg|jpeg|gif|webp)$/i.test(selected.document_name) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selected.preview_url}
                      alt={selected.document_name}
                      className="w-full rounded-xl border border-gray-200"
                    />
                  ) : (
                    <a
                      href={selected.preview_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-medium text-[#B8934C] hover:underline"
                    >
                      <FileText className="w-4 h-4" />
                      Open file
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </a>
                  )
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                    Preview not available for seed/demo files.
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                {selected.status === 'pending' && (
                  <>
                    <button
                      disabled={acting === selected.id}
                      onClick={() => act(selected, 'approved')}
                      className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#D4AF37] hover:bg-[#C9A961] disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      disabled={acting === selected.id}
                      onClick={() => act(selected, 'rejected')}
                      className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </>
                )}
                {selected.status === 'approved' && (
                  <button
                    disabled={acting === selected.id}
                    onClick={() => act(selected, 'filed')}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {acting === selected.id ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Filing...
                      </span>
                    ) : (
                      'File to Smart Archive'
                    )}
                  </button>
                )}
                {(selected.status === 'filed' || selected.status === 'rejected') && (
                  <p className="text-sm text-gray-500">
                    {selected.status === 'filed'
                      ? 'Filed into the Smart Archive.'
                      : 'Rejected. Submitter will be notified.'}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <QuickUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => {
          setToast('Uploaded to Smart Archive');
          load();
        }}
      />

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] inline-flex items-center gap-2 bg-gray-900 text-white text-sm font-medium rounded-xl px-4 py-2.5 shadow-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          {toast}
        </div>
      )}
    </div>
  );
}
