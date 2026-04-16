'use client';

import { Book, FileText, HelpCircle, PlayCircle } from 'lucide-react';
import { ArchiveItem, DocType, RECENT_ITEMS } from './mock-data';

const TYPE_META: Record<DocType, { label: string; icon: typeof FileText }> = {
  document: { label: 'Document', icon: FileText },
  video: { label: 'Video', icon: PlayCircle },
  guide: { label: 'Guide', icon: Book },
  faq: { label: 'FAQ', icon: HelpCircle },
};

function RecentCard({ item }: { item: ArchiveItem }) {
  const meta = TYPE_META[item.type];
  const Icon = meta.icon;
  return (
    <div className="bg-white border border-[#EAEAE4] rounded-xl p-4 cursor-pointer transition-all duration-150 hover:border-[#D9D9D1] hover:shadow-md hover:-translate-y-px">
      <div className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-[#8A8A82] uppercase tracking-[0.08em] mb-2.5">
        <Icon className="w-3 h-3" strokeWidth={1.75} />
        {meta.label}
      </div>
      <p className="text-[13px] font-semibold text-[#111111] leading-[1.35] mb-2 line-clamp-2">
        {item.name}
      </p>
      <p className="text-[11px] text-[#8A8A82]">{item.modifiedRelative}</p>
    </div>
  );
}

export function RecentlyAccessed() {
  return (
    <div className="mt-7">
      <div className="text-[11px] font-semibold text-[#8A8A82] uppercase tracking-[0.08em] mb-3.5">
        Recently Accessed
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {RECENT_ITEMS.map((item) => (
          <RecentCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
