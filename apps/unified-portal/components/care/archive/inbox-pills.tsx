'use client';

import { INBOX_COUNTS } from './mock-data';

export type InboxPillValue = 'all' | 'pending' | 'approved' | 'filed' | 'rejected';

interface InboxPillsProps {
  active: InboxPillValue;
  onChange: (v: InboxPillValue) => void;
  counts?: {
    all: number;
    pending: number;
    approved: number;
    filed: number;
    rejected: number;
  };
}

const PILLS: Array<{ value: InboxPillValue; label: string; urgent?: boolean }> = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending', urgent: true },
  { value: 'approved', label: 'Approved' },
  { value: 'filed', label: 'Filed' },
  { value: 'rejected', label: 'Rejected' },
];

export function InboxPills({ active, onChange, counts }: InboxPillsProps) {
  const countMap = counts ?? INBOX_COUNTS;

  return (
    <div className="flex gap-1">
      {PILLS.map((pill) => {
        const isActive = active === pill.value;
        const count = countMap[pill.value];
        return (
          <button
            key={pill.value}
            type="button"
            onClick={() => onChange(pill.value)}
            className={`px-3 py-2 bg-transparent border-none border-b-2 text-[13px] cursor-pointer inline-flex items-center gap-1.5 transition-all duration-150 -mb-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] ${
              isActive
                ? 'text-[#111111] font-semibold border-b-[#D4AF37]'
                : 'text-[#8A8A82] font-medium border-b-transparent hover:text-[#111111]'
            }`}
          >
            {pill.label}
            <span
              className={`px-1.5 py-px rounded-xl text-[11px] font-semibold ${
                pill.urgent
                  ? 'bg-[#D4AF37] text-[#0B0C0F]'
                  : 'bg-[#F3F3EF] text-[#4B4B46]'
              }`}
            >
              {count.toLocaleString()}
            </span>
          </button>
        );
      })}
    </div>
  );
}
