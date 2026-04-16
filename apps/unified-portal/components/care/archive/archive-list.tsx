'use client';

import { ArrowUpDown, LayoutGrid, List } from 'lucide-react';
import { ARCHIVE_ITEMS, ARCHIVE_TOTALS, ArchiveItem } from './mock-data';
import { ArchiveListRow } from './archive-list-row';

interface ArchiveListProps {
  items?: ArchiveItem[];
}

export function ArchiveList({ items = ARCHIVE_ITEMS }: ArchiveListProps) {
  return (
    <div className="mt-6">
      <div className="flex justify-between items-center mb-3.5">
        <div className="text-[13px] text-[#8A8A82]">
          <strong className="text-[#111111] font-semibold">All Content</strong>{' '}
          · Showing {items.length} of {ARCHIVE_TOTALS.items.toLocaleString()}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-transparent border border-[#EAEAE4] rounded-md text-[#4B4B46] text-[12px] font-medium cursor-pointer transition-all duration-150 hover:bg-white hover:text-[#111111] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
          >
            <ArrowUpDown className="w-3 h-3" strokeWidth={1.75} />
            Newest first
          </button>
          <div className="flex bg-white border border-[#EAEAE4] rounded-md p-0.5">
            <button
              type="button"
              className="px-2 py-1 bg-[#F3F3EF] text-[#111111] rounded flex items-center gap-1 text-[12px]"
              aria-label="List view"
            >
              <List className="w-3.5 h-3.5" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              className="px-2 py-1 bg-transparent text-[#8A8A82] rounded flex items-center gap-1 text-[12px] hover:text-[#111111]"
              aria-label="Grid view"
            >
              <LayoutGrid className="w-3.5 h-3.5" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#EAEAE4] rounded-xl overflow-hidden">
        <div
          className="grid gap-4 px-5 py-2.5 bg-[#F3F3EF] border-b border-[#EAEAE4] text-[10.5px] font-semibold text-[#8A8A82] uppercase tracking-[0.08em]"
          style={{ gridTemplateColumns: '1fr 110px 180px 110px 110px 60px' }}
        >
          <div>Document</div>
          <div>System</div>
          <div>Client / Job</div>
          <div>Status</div>
          <div>Modified</div>
          <div />
        </div>
        {items.map((item) => (
          <ArchiveListRow key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
