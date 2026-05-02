'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { ArchiveHeader } from '@/components/care/archive/archive-header';
import { SmartSearchBar } from '@/components/care/archive/smart-search-bar';
import {
  FilterBar,
  SystemFilterValue,
  TypeFilterValue,
} from '@/components/care/archive/filter-bar';
import { RecentlyAccessed } from '@/components/care/archive/recently-accessed';
import { ArchiveList } from '@/components/care/archive/archive-list';
import { InboxView } from '@/components/care/archive/inbox-view';
import {
  ARCHIVE_ITEMS,
  ARCHIVE_TOTALS,
  INBOX_COUNTS,
} from '@/components/care/archive/mock-data';
import { QuickUploadModal } from '@/components/care/QuickUploadModal';

type Tab = 'archive' | 'inbox';

export default function CareArchivePage() {
  const [tab, setTab] = useState<Tab>('archive');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilterValue>('all');
  const [systemFilter, setSystemFilter] = useState<SystemFilterValue>('all');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [tenantSlug, setTenantSlug] = useState<string>('se-systems-cork');
  useEffect(() => {
    let cancelled = false;
    fetch('/api/care-dashboard/brand')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { slug?: string | null } | null) => {
        if (cancelled || !d?.slug) return;
        setTenantSlug(d.slug);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ARCHIVE_ITEMS.filter((item) => {
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      if (systemFilter !== 'all' && item.system !== systemFilter) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        (item.client?.toLowerCase().includes(q) ?? false) ||
        (item.jobRef?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [search, typeFilter, systemFilter]);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(
        `portal.openhouseai.ie/upload/${tenantSlug}`
      );
      setToast('Share link copied');
    } catch {
      setToast('Share link copied');
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <div className="px-8 pt-7">
        <ArchiveHeader
          totalItems={ARCHIVE_TOTALS.items}
          onShare={handleShare}
          onUpload={() => setUploadOpen(true)}
        />
      </div>

      <div className="flex gap-6 border-b border-[#EAEAE4] px-8 mt-5">
        <TabButton
          label="Smart Archive"
          count={ARCHIVE_TOTALS.items}
          active={tab === 'archive'}
          onClick={() => setTab('archive')}
        />
        <TabButton
          label="Inbox"
          count={INBOX_COUNTS.all}
          active={tab === 'inbox'}
          urgent
          onClick={() => setTab('inbox')}
        />
      </div>

      {tab === 'archive' ? (
        <div className="px-8 py-5">
          <SmartSearchBar value={search} onChange={setSearch} />

          <FilterBar
            typeFilter={typeFilter}
            systemFilter={systemFilter}
            onTypeChange={setTypeFilter}
            onSystemChange={setSystemFilter}
            onMoreFilters={() => {
              // eslint-disable-next-line no-console
              console.log('More filters drawer not implemented yet');
            }}
          />

          <RecentlyAccessed />

          <ArchiveList items={filteredItems} />
        </div>
      ) : (
        <InboxView onToast={setToast} />
      )}

      <QuickUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => {
          setToast('Uploaded to Smart Archive');
        }}
      />

      {toast ? (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] inline-flex items-center gap-2 bg-[#111111] text-white text-[13px] font-medium rounded-xl px-4 py-2.5 shadow-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" strokeWidth={2} />
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function TabButton({
  label,
  count,
  active,
  urgent,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  urgent?: boolean;
  onClick: () => void;
}) {
  const countClass = active
    ? 'bg-[#111111] text-white'
    : urgent
      ? 'bg-[#D4AF37] text-[#0B0C0F]'
      : 'bg-[#F3F3EF] text-[#4B4B46]';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`py-3 text-[14px] cursor-pointer border-b-2 -mb-px inline-flex items-center gap-2 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] ${
        active
          ? 'text-[#111111] border-[#111111] font-semibold'
          : 'text-[#8A8A82] border-transparent font-medium hover:text-[#111111]'
      }`}
    >
      {label}
      <span className={`text-[11px] px-1.5 py-0.5 rounded-xl font-semibold ${countClass}`}>
        {count.toLocaleString()}
      </span>
    </button>
  );
}
