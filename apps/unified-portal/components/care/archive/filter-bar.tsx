'use client';

import { Book, FileText, HelpCircle, PlayCircle, SlidersHorizontal } from 'lucide-react';
import { ARCHIVE_TOTALS, DocType, SystemType } from './mock-data';

type TypeFilterValue = 'all' | DocType;
type SystemFilterValue = 'all' | SystemType;

interface FilterBarProps {
  typeFilter: TypeFilterValue;
  systemFilter: SystemFilterValue;
  onTypeChange: (v: TypeFilterValue) => void;
  onSystemChange: (v: SystemFilterValue) => void;
  onMoreFilters?: () => void;
}

const TYPE_CHIPS: Array<{ value: TypeFilterValue; label: string; count: number; icon?: typeof FileText }> = [
  { value: 'all', label: 'All', count: ARCHIVE_TOTALS.items },
  { value: 'document', label: 'Documents', count: ARCHIVE_TOTALS.documents, icon: FileText },
  { value: 'video', label: 'Videos', count: ARCHIVE_TOTALS.videos, icon: PlayCircle },
  { value: 'guide', label: 'Guides', count: ARCHIVE_TOTALS.guides, icon: Book },
  { value: 'faq', label: 'FAQs', count: ARCHIVE_TOTALS.faqs, icon: HelpCircle },
];

const SYSTEM_CHIPS: Array<{ value: SystemFilterValue; label: string; count: number; dot?: string }> = [
  { value: 'all', label: 'All', count: ARCHIVE_TOTALS.items },
  { value: 'solar-pv', label: 'Solar PV', count: ARCHIVE_TOTALS.solarPv, dot: '#D4AF37' },
  { value: 'heat-pump', label: 'Heat Pumps', count: ARCHIVE_TOTALS.heatPump, dot: '#3B82F6' },
  { value: 'hvac', label: 'HVAC', count: ARCHIVE_TOTALS.hvac, dot: '#A855F7' },
  { value: 'ev-charger', label: 'EV Chargers', count: ARCHIVE_TOTALS.evCharger, dot: '#10B981' },
];

function Chip({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-[5px] rounded-2xl border text-[12.5px] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] ${
        active
          ? 'bg-[#111111] text-white border-[#111111]'
          : 'bg-transparent text-[#4B4B46] border-[#EAEAE4] hover:bg-[#F7F7F4] hover:border-[#D9D9D1] hover:text-[#111111]'
      }`}
    >
      {children}
      <span
        className={`text-[11px] font-semibold px-1.5 py-px rounded-lg ${
          active ? 'bg-white/15 text-white' : 'bg-[#F3F3EF] text-[#8A8A82]'
        }`}
      >
        {count.toLocaleString()}
      </span>
    </button>
  );
}

export function FilterBar({
  typeFilter,
  systemFilter,
  onTypeChange,
  onSystemChange,
  onMoreFilters,
}: FilterBarProps) {
  return (
    <div className="mt-5 bg-white border border-[#EAEAE4] rounded-xl px-[18px] py-[14px]">
      <div className="flex items-center gap-2.5 flex-wrap">
        <div className="min-w-[58px] text-[11px] font-semibold text-[#8A8A82] uppercase tracking-[0.08em]">
          Type
        </div>
        {TYPE_CHIPS.map((chip) => {
          const Icon = chip.icon;
          return (
            <Chip
              key={chip.value}
              active={typeFilter === chip.value}
              onClick={() => onTypeChange(chip.value)}
              count={chip.count}
            >
              {Icon ? <Icon className="w-3 h-3" strokeWidth={1.75} /> : null}
              {chip.label}
            </Chip>
          );
        })}
      </div>

      <div className="flex items-center gap-2.5 flex-wrap mt-2.5">
        <div className="min-w-[58px] text-[11px] font-semibold text-[#8A8A82] uppercase tracking-[0.08em]">
          System
        </div>
        {SYSTEM_CHIPS.map((chip) => (
          <Chip
            key={chip.value}
            active={systemFilter === chip.value}
            onClick={() => onSystemChange(chip.value)}
            count={chip.count}
          >
            {chip.dot ? (
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: chip.dot }}
              />
            ) : null}
            {chip.label}
          </Chip>
        ))}
        <button
          type="button"
          onClick={onMoreFilters}
          className="ml-auto inline-flex items-center gap-1.5 text-[12px] text-[#8A8A82] cursor-pointer px-2 py-1 rounded-md hover:text-[#111111] hover:bg-[#F3F3EF] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
        >
          <SlidersHorizontal className="w-3 h-3" strokeWidth={1.75} />
          More filters
        </button>
      </div>
    </div>
  );
}

export type { TypeFilterValue, SystemFilterValue };
