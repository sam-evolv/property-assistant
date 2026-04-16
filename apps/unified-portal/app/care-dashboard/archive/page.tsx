'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  FolderArchive, Play, FileText, BookOpen, HelpCircle,
  RefreshCw, Search, Loader2, Sun, Zap, Inbox,
} from 'lucide-react';

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
}

type FilterType = 'all' | 'video' | 'document' | 'guide' | 'faq';

/* ── SE Systems demo tenant fallback ── */
const SE_SYSTEMS_TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(
    new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)')
  );
  return match ? decodeURIComponent(match[1]) : null;
}

/* ── Content-type config ── */
const TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; iconColor: string; bg: string; badge: string }> = {
  video:    { label: 'Video',    icon: Play,       iconColor: 'text-purple-500', bg: 'bg-purple-50',  badge: 'bg-purple-100 text-purple-700' },
  document: { label: 'Document', icon: FileText,   iconColor: 'text-blue-500',   bg: 'bg-blue-50',    badge: 'bg-blue-100 text-blue-700' },
  guide:    { label: 'Guide',    icon: BookOpen,   iconColor: 'text-emerald-500',bg: 'bg-emerald-50', badge: 'bg-emerald-100 text-emerald-700' },
  faq:      { label: 'FAQ',      icon: HelpCircle, iconColor: 'text-amber-500',  bg: 'bg-amber-50',   badge: 'bg-amber-100 text-amber-700' },
};

const SYSTEM_LABELS: Record<string, string> = {
  solar_pv: 'Solar PV',
  heat_pump: 'Heat Pump',
  mvhr: 'MVHR',
  ev_charger: 'EV Charger',
};

/* ── Filter tab pill ── */
function FilterTab({
  label, count, active, onClick,
}: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-gray-900 text-white'
          : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
      }`}
    >
      {label}
      {count > 0 && (
        <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${
          active ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}

/* ── Content card ── */
function ContentCard({ item }: { item: InstallerContentItem }) {
  const cfg = TYPE_CONFIG[item.content_type] ?? TYPE_CONFIG.document;
  const Icon = cfg.icon;
  const systemLabel = item.system_type ? (SYSTEM_LABELS[item.system_type] ?? item.system_type) : null;
  const date = new Date(item.created_at).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });

  const card = (
    <div className={`group rounded-2xl bg-white border border-gray-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4 sm:p-5 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${item.url ? 'cursor-pointer' : ''}`}>
      <div className="flex items-start gap-3.5">
        <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-200`}>
          <Icon className={`w-5 h-5 ${cfg.iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-gold-600 transition-colors">{item.title}</p>
          {item.description && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">{item.description}</p>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>
              {cfg.label}
            </span>
            {systemLabel && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 flex items-center gap-1">
                <Sun className="w-2.5 h-2.5" />
                {systemLabel}
              </span>
            )}
            <span className="text-[10px] text-gray-400 ml-auto">{date}</span>
          </div>
        </div>
      </div>
    </div>
  );

  if (item.url) {
    return (
      <a href={item.url} target="_blank" rel="noopener noreferrer">
        {card}
      </a>
    );
  }

  return card;
}

/* ── Main page ── */
export default function CareArchivePage() {
  const [tenantId] = useState<string>(() => getCookie('tenant_id') || SE_SYSTEMS_TENANT_ID);
  const [items, setItems] = useState<InstallerContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [pendingUploads, setPendingUploads] = useState(0);

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
    } catch (err) {
      setError('Failed to load content. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { loadContent(); }, [loadContent]);

  /* Counts per type */
  const counts: Record<FilterType, number> = {
    all: items.length,
    video: items.filter(i => i.content_type === 'video').length,
    document: items.filter(i => i.content_type === 'document').length,
    guide: items.filter(i => i.content_type === 'guide').length,
    faq: items.filter(i => i.content_type === 'faq').length,
  };

  /* Filtered + searched items */
  const filtered = items.filter(item => {
    const matchesType = activeFilter === 'all' || item.content_type === activeFilter;
    const matchesSearch = !search || item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.description?.toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-white">
      {/* ── Header ── */}
      <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center">
                <FolderArchive className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Smart Archive</h1>
                <p className="text-gray-500 mt-0.5">
                  {isLoading
                    ? 'Loading content…'
                    : `${items.length} item${items.length !== 1 ? 's' : ''} across all system types`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search…"
                  className="pl-9 pr-4 py-2 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 w-48"
                />
              </div>
              <button
                onClick={loadContent}
                disabled={isLoading}
                className="p-2.5 rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-900 transition-colors disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* ── Archive / Inbox section tabs ── */}
          <div className="flex items-center gap-1 mt-5 flex-wrap">
            <span className="px-3.5 py-1.5 rounded-lg text-sm font-semibold bg-gray-900 text-white inline-flex items-center gap-1.5">
              <FolderArchive className="w-4 h-4" />
              Smart Archive
            </span>
            <Link
              href="/care-dashboard/smart-archive/inbox"
              className="px-3.5 py-1.5 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors inline-flex items-center gap-1.5"
            >
              <Inbox className="w-4 h-4" />
              Inbox
              {pendingUploads > 0 && (
                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-[#D4AF37] text-white">
                  {pendingUploads}
                </span>
              )}
            </Link>
          </div>

          {/* ── Filter tabs ── */}
          <div className="flex gap-1 mt-3 flex-wrap">
            {(['all', 'video', 'document', 'guide', 'faq'] as FilterType[]).map(f => (
              <FilterTab
                key={f}
                label={f === 'all' ? 'All' : (TYPE_CONFIG[f]?.label ?? f)}
                count={counts[f]}
                active={activeFilter === f}
                onClick={() => setActiveFilter(f)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-white border border-gray-200 p-5 animate-pulse">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-gray-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-100 rounded w-3/4" />
                    <div className="h-3 bg-gray-100 rounded w-full" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mb-3">
              <FolderArchive className="w-6 h-6 text-red-400" />
            </div>
            <p className="text-sm font-medium text-gray-900">{error}</p>
            <button onClick={loadContent} className="mt-3 text-sm text-amber-600 hover:underline">Try again</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
              <FolderArchive className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-900">
              {search ? `No results for "${search}"` : 'No content yet'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {search ? 'Try a different search term' : 'Content added via the Content Manager will appear here'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(item => (
              <ContentCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
