'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Play, FileText, BookOpen, HelpCircle,
  Search, Upload, MoreHorizontal, SlidersHorizontal,
  CheckCircle2, FolderArchive,
} from 'lucide-react';
import { QuickUploadModal } from '@/components/care/QuickUploadModal';

/* ── Types ── */
interface InstallerContentItem {
  id: string;
  title: string;
  content_type: 'video' | 'document' | 'guide' | 'faq' | string;
  system_type: string | null;
  description: string | null;
  url: string | null;
  is_published: boolean | null;
  created_at: string;
  file_size_bytes?: number | null;
}

type TypeFilter = 'all' | 'video' | 'document' | 'guide' | 'faq';
type SystemFilter = 'all' | string;

/* ── SE Systems demo tenant fallback ── */
const SE_SYSTEMS_TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(
    new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)')
  );
  return match ? decodeURIComponent(match[1]) : null;
}

/* ── Content-type config (neutral icons only) ── */
const TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType }> = {
  video:    { label: 'Video',    icon: Play },
  document: { label: 'Document', icon: FileText },
  guide:    { label: 'Guide',    icon: BookOpen },
  faq:      { label: 'FAQ',      icon: HelpCircle },
};

const SYSTEM_LABELS: Record<string, string> = {
  solar_pv: 'Solar PV',
  heat_pump: 'Heat Pump',
  mvhr: 'MVHR',
  ev_charger: 'EV Charger',
  battery: 'Battery',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatSize(bytes: number | null | undefined): string | null {
  if (!bytes || bytes <= 0) return null;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ── Small chip for filters ── */
function FilterChip({
  label, count, active, onClick,
}: { label: string; count?: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[13px] font-medium transition-colors ${
        active
          ? 'bg-[#1A1A1A] text-white border border-[#1A1A1A]'
          : 'bg-white text-[#4A4A4A] border border-[#E5E5E0] hover:border-[#1A1A1A]/30 hover:text-[#1A1A1A]'
      }`}
    >
      <span>{label}</span>
      {typeof count === 'number' && (
        <span className={active ? 'text-white/70' : 'text-[#778199]'}>
          {count}
        </span>
      )}
    </button>
  );
}

/* ── Main archive card (redesigned) ── */
function ContentCard({ item }: { item: InstallerContentItem }) {
  const cfg = TYPE_CONFIG[item.content_type] ?? TYPE_CONFIG.document;
  const Icon = cfg.icon;
  const systemLabel = item.system_type ? (SYSTEM_LABELS[item.system_type] ?? item.system_type) : null;
  const size = formatSize(item.file_size_bytes);
  const date = formatDate(item.created_at);

  const inner = (
    <article
      className="group relative flex flex-col h-full min-h-[200px] bg-white border border-[#E5E5E0] rounded-[12px] p-5 transition-all duration-150 hover:-translate-y-0.5 hover:border-[#D4AF37] hover:shadow-[0_8px_24px_rgba(26,26,26,0.06)]"
    >
      {/* Top row: icon + type + menu */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-[#F5F5F0] flex items-center justify-center flex-shrink-0">
          <Icon className="w-[18px] h-[18px] text-[#4A4A4A]" strokeWidth={1.75} />
        </div>
        <span className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[#778199]">
          {cfg.label}
        </span>
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
          className="ml-auto w-7 h-7 rounded-md flex items-center justify-center text-[#778199] hover:text-[#1A1A1A] hover:bg-[#F5F5F0] transition-colors opacity-0 group-hover:opacity-100"
          aria-label="More actions"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Title */}
      <h3 className="mt-4 text-[16px] font-semibold text-[#1A1A1A] leading-[1.3] line-clamp-2">
        {item.title}
      </h3>

      {/* Description */}
      {item.description && (
        <p className="mt-2 text-[13px] text-[#4A4A4A] leading-[1.5] line-clamp-2">
          {item.description}
        </p>
      )}

      {/* Footer */}
      <div className="mt-auto pt-4">
        <div className="h-px bg-[#E5E5E0]" />
        <div className="mt-3 text-[11px] text-[#778199] flex items-center flex-wrap gap-x-1.5">
          {systemLabel && <span>{systemLabel}</span>}
          {systemLabel && <span aria-hidden>·</span>}
          <span>{date}</span>
          {size && (
            <>
              <span aria-hidden>·</span>
              <span>{size}</span>
            </>
          )}
        </div>
      </div>
    </article>
  );

  if (item.url) {
    return (
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] rounded-[12px]"
      >
        {inner}
      </a>
    );
  }

  return inner;
}

/* ── Small recently-accessed card ── */
function RecentCard({
  title, type, accessed,
}: { title: string; type: keyof typeof TYPE_CONFIG; accessed: string }) {
  const cfg = TYPE_CONFIG[type] ?? TYPE_CONFIG.document;
  const Icon = cfg.icon;
  return (
    <div className="flex-shrink-0 w-[240px] bg-white border border-[#E5E5E0] rounded-[12px] p-4 hover:border-[#D4AF37] transition-colors cursor-pointer">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-md bg-[#F5F5F0] flex items-center justify-center">
          <Icon className="w-3.5 h-3.5 text-[#4A4A4A]" strokeWidth={1.75} />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#778199]">
          {cfg.label}
        </span>
      </div>
      <p className="mt-3 text-[13px] font-semibold text-[#1A1A1A] leading-[1.35] line-clamp-2">
        {title}
      </p>
      <p className="mt-2 text-[11px] text-[#778199]">{accessed}</p>
    </div>
  );
}

/* ── Main page ── */
export default function CareArchivePage() {
  const [tenantId] = useState<string>(() => getCookie('tenant_id') || SE_SYSTEMS_TENANT_ID);
  const [items, setItems] = useState<InstallerContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [systemFilter, setSystemFilter] = useState<SystemFilter>('all');
  const [search, setSearch] = useState('');
  const [pendingUploads, setPendingUploads] = useState(0);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    fetch('/api/care-dashboard/third-party?status=pending')
      .then((r) => (r.ok ? r.json() : { pendingCount: 0 }))
      .then((d) => setPendingUploads(d.pendingCount ?? 0))
      .catch(() => setPendingUploads(0));
  }, []);

  const loadContent = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/care/installer-content?tenantId=${encodeURIComponent(tenantId)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(data.content || []);
    } catch {
      setError('Failed to load content. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { loadContent(); }, [loadContent]);

  /* Type counts (after system filter applied) */
  const systemFilteredItems = useMemo(
    () => items.filter(i => systemFilter === 'all' || i.system_type === systemFilter),
    [items, systemFilter]
  );

  const typeCounts: Record<TypeFilter, number> = {
    all: systemFilteredItems.length,
    video: systemFilteredItems.filter(i => i.content_type === 'video').length,
    document: systemFilteredItems.filter(i => i.content_type === 'document').length,
    guide: systemFilteredItems.filter(i => i.content_type === 'guide').length,
    faq: systemFilteredItems.filter(i => i.content_type === 'faq').length,
  };

  /* System list (only those present in data) + counts */
  const systemOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => { if (i.system_type) set.add(i.system_type); });
    const order = ['solar_pv', 'heat_pump', 'battery', 'ev_charger', 'mvhr'];
    return Array.from(set).sort((a, b) => {
      const ai = order.indexOf(a); const bi = order.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [items]);

  const systemCounts: Record<string, number> = useMemo(() => {
    const typeScoped = items.filter(i => typeFilter === 'all' || i.content_type === typeFilter);
    const counts: Record<string, number> = { all: typeScoped.length };
    systemOptions.forEach(s => {
      counts[s] = typeScoped.filter(i => i.system_type === s).length;
    });
    return counts;
  }, [items, typeFilter, systemOptions]);

  /* Filtered + searched items */
  const filtered = useMemo(() => items.filter(item => {
    const matchesType = typeFilter === 'all' || item.content_type === typeFilter;
    const matchesSystem = systemFilter === 'all' || item.system_type === systemFilter;
    const q = search.trim().toLowerCase();
    const matchesSearch = !q
      || item.title.toLowerCase().includes(q)
      || (item.description?.toLowerCase().includes(q) ?? false);
    return matchesType && matchesSystem && matchesSearch;
  }), [items, typeFilter, systemFilter, search]);

  // TODO: wire to actual view tracking — seeded for layout while telemetry is built
  const recentlyAccessed = useMemo(() => {
    const pool = items.slice(0, 4);
    const stamps = ['2h ago', 'Yesterday', '3d ago', '1w ago'];
    return pool.map((it, i) => ({
      id: it.id,
      title: it.title,
      type: (it.content_type as keyof typeof TYPE_CONFIG) ?? 'document',
      accessed: stamps[i] ?? 'Recently',
      url: it.url,
    }));
  }, [items]);

  const clearFilters = () => {
    setTypeFilter('all');
    setSystemFilter('all');
    setSearch('');
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-8 md:py-10">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[28px] font-semibold text-[#1A1A1A] tracking-[-0.01em] leading-tight">
              Smart Archive
            </h1>
            <p className="mt-1 text-[14px] text-[#778199]">
              {isLoading
                ? 'Loading content…'
                : `${items.length} item${items.length !== 1 ? 's' : ''} across all system types`}
            </p>
          </div>

          <button
            onClick={() => setUploadOpen(true)}
            className="inline-flex items-center gap-2 h-10 px-4 text-[14px] font-medium text-[#1A1A1A] bg-[#D4AF37] rounded-lg hover:bg-[#C9A961] transition-colors"
          >
            <Upload className="w-4 h-4" />
            Upload
          </button>
        </div>

        {/* ── Prominent search ── */}
        <div className="mt-6">
          <div className="relative">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#778199]"
              strokeWidth={1.75}
            />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search documents, guides, videos…"
              className="w-full h-12 pl-12 pr-12 text-[15px] text-[#1A1A1A] placeholder:text-[#778199] bg-white border border-[#E5E5E0] rounded-[12px] focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/15 transition"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#778199]">
              <SlidersHorizontal className="w-4 h-4" strokeWidth={1.75} />
            </div>
          </div>
        </div>

        {/* ── Segmented tabs (Archive / Inbox) ── */}
        <div className="mt-8 border-b border-[#E5E5E0]">
          <nav className="flex items-center gap-6">
            <button
              className="relative h-11 flex items-center gap-2 text-[14px] font-medium text-[#1A1A1A]"
            >
              Smart Archive
              <span className="text-[12px] text-[#778199]">{items.length}</span>
              <span className="absolute left-0 right-0 bottom-0 h-[2px] bg-[#D4AF37]" />
            </button>
            <Link
              href="/care-dashboard/smart-archive/inbox"
              className="relative h-11 flex items-center gap-2 text-[14px] font-medium text-[#778199] hover:text-[#1A1A1A] transition-colors"
            >
              Inbox
              {pendingUploads > 0 && (
                <span className="text-[11px] font-semibold px-1.5 h-[18px] min-w-[18px] rounded-full bg-[#D4AF37] text-[#1A1A1A] inline-flex items-center justify-center">
                  {pendingUploads}
                </span>
              )}
            </Link>
          </nav>
        </div>

        {/* ── Filter chips ── */}
        <div className="mt-5 space-y-2.5">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[12px] font-medium text-[#778199] w-14 shrink-0">Type</span>
            <FilterChip
              label="All"
              count={typeCounts.all}
              active={typeFilter === 'all'}
              onClick={() => setTypeFilter('all')}
            />
            {(['video', 'document', 'guide', 'faq'] as TypeFilter[]).map(t => (
              <FilterChip
                key={t}
                label={`${TYPE_CONFIG[t].label}s`}
                count={typeCounts[t]}
                active={typeFilter === t}
                onClick={() => setTypeFilter(t)}
              />
            ))}
          </div>

          {systemOptions.length > 0 && (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[12px] font-medium text-[#778199] w-14 shrink-0">System</span>
              <FilterChip
                label="All"
                count={systemCounts.all}
                active={systemFilter === 'all'}
                onClick={() => setSystemFilter('all')}
              />
              {systemOptions.map(s => (
                <FilterChip
                  key={s}
                  label={SYSTEM_LABELS[s] ?? s}
                  count={systemCounts[s]}
                  active={systemFilter === s}
                  onClick={() => setSystemFilter(s)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Recently accessed ── */}
        {!isLoading && !error && recentlyAccessed.length > 0 && (
          <section className="mt-10">
            <div className="flex items-center justify-between">
              <h2 className="text-[13px] font-semibold tracking-[0.06em] uppercase text-[#4A4A4A]">
                Recently accessed
              </h2>
            </div>
            <div className="mt-3 -mx-2 px-2 flex gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
              {recentlyAccessed.map(r => {
                const card = <RecentCard title={r.title} type={r.type} accessed={r.accessed} />;
                return r.url ? (
                  <a
                    key={r.id}
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-[12px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
                  >
                    {card}
                  </a>
                ) : (
                  <div key={r.id}>{card}</div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Main grid ── */}
        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-semibold tracking-[0.06em] uppercase text-[#4A4A4A]">
              All content
            </h2>
            <span className="text-[12px] text-[#778199]">
              {isLoading ? '—' : `${filtered.length} of ${items.length}`}
            </span>
          </div>

          <div className="mt-4">
            {isLoading ? (
              <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="min-h-[200px] rounded-[12px] bg-white border border-[#E5E5E0] p-5 animate-pulse">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-[#F5F5F0]" />
                      <div className="h-3 w-16 bg-[#F5F5F0] rounded" />
                    </div>
                    <div className="mt-5 h-4 w-3/4 bg-[#F5F5F0] rounded" />
                    <div className="mt-2 h-3 w-full bg-[#F5F5F0] rounded" />
                    <div className="mt-1.5 h-3 w-2/3 bg-[#F5F5F0] rounded" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-20 text-center bg-white border border-[#E5E5E0] rounded-[12px]">
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-3">
                  <FolderArchive className="w-6 h-6 text-red-400" />
                </div>
                <p className="text-[14px] font-medium text-[#1A1A1A]">{error}</p>
                <button
                  onClick={loadContent}
                  className="mt-3 text-[13px] text-[#D4AF37] hover:underline"
                >
                  Try again
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center bg-white border border-[#E5E5E0] rounded-[12px]">
                <div className="w-12 h-12 rounded-full bg-[#F5F5F0] flex items-center justify-center mb-3">
                  <Search className="w-6 h-6 text-[#778199]" strokeWidth={1.75} />
                </div>
                <p className="text-[14px] font-medium text-[#1A1A1A]">No matching documents</p>
                <p className="mt-1 text-[13px] text-[#778199]">Try adjusting filters or search</p>
                <button
                  onClick={clearFilters}
                  className="mt-4 inline-flex items-center h-9 px-3.5 text-[13px] font-medium text-[#1A1A1A] bg-white border border-[#E5E5E0] rounded-lg hover:border-[#D4AF37] transition-colors"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
                {filtered.map(item => (
                  <ContentCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <QuickUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => {
          setToast('Uploaded to Smart Archive');
          loadContent();
        }}
      />

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] inline-flex items-center gap-2 bg-[#1A1A1A] text-white text-[13px] font-medium rounded-xl px-4 py-2.5 shadow-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          {toast}
        </div>
      )}
    </div>
  );
}
