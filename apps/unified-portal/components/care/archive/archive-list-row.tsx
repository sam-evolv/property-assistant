'use client';

import {
  AlertTriangle,
  Award,
  BookOpen,
  Eye,
  FileText,
  Flag,
  MoreHorizontal,
  Play,
  ShieldCheck,
} from 'lucide-react';
import { ArchiveItem, DocType, SystemType } from './mock-data';

const ICON_MAP: Record<string, typeof FileText> = {
  'file-text': FileText,
  play: Play,
  award: Award,
  'shield-check': ShieldCheck,
  'book-open': BookOpen,
  'alert-triangle': AlertTriangle,
};

const TYPE_ICON_STYLE: Record<DocType, string> = {
  document: 'bg-[#FDF9EB] text-[#D4AF37]',
  video: 'bg-[#EFF6FF] text-[#3B82F6]',
  guide: 'bg-[#ECFDF5] text-[#10B981]',
  faq: 'bg-[#F5EDFA] text-[#A855F7]',
};

const SYSTEM_BADGE: Record<SystemType, string> = {
  'solar-pv': 'bg-[#FDF9EB] text-[#D4AF37]',
  'heat-pump': 'bg-[#EFF6FF] text-[#3B82F6]',
  hvac: 'bg-[#F5EDFA] text-[#A855F7]',
  'ev-charger': 'bg-[#ECFDF5] text-[#10B981]',
};

const SYSTEM_LABEL: Record<SystemType, string> = {
  'solar-pv': 'Solar PV',
  'heat-pump': 'Heat Pump',
  hvac: 'HVAC',
  'ev-charger': 'EV Charger',
};

const STATUS_META: Record<
  ArchiveItem['status'],
  { label: string; dotClass: string }
> = {
  active: {
    label: 'Active',
    dotClass: 'bg-[#10B981] shadow-[0_0_0_2px_#ECFDF5]',
  },
  pending: {
    label: 'Pending',
    dotClass: 'bg-[#F59E0B] shadow-[0_0_0_2px_#FFFBEB]',
  },
  expiring: {
    label: 'Expiring',
    dotClass: 'bg-[#EF4444] shadow-[0_0_0_2px_#FEF2F2]',
  },
  archived: {
    label: 'Archived',
    dotClass: 'bg-[#8A8A82] shadow-[0_0_0_2px_#F3F3EF]',
  },
};

export function ArchiveListRow({ item }: { item: ArchiveItem }) {
  const Icon = ICON_MAP[item.iconKey ?? 'file-text'] ?? FileText;
  const statusMeta = STATUS_META[item.status];

  return (
    <div
      className="grid items-center gap-4 px-5 py-3.5 border-b border-[#EAEAE4] last:border-b-0 cursor-pointer transition-colors duration-150 hover:bg-[#F7F7F4] group"
      style={{ gridTemplateColumns: '1fr 110px 180px 110px 110px 60px' }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${TYPE_ICON_STYLE[item.type]}`}
        >
          <Icon className="w-4 h-4" strokeWidth={1.75} />
        </div>
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold text-[#111111] truncate flex items-center gap-1.5">
            <span className="truncate">{item.name}</span>
            {item.flagged ? (
              <Flag
                className="w-3 h-3 text-[#F59E0B] flex-shrink-0"
                strokeWidth={2}
              />
            ) : null}
          </div>
          <div className="text-[12px] text-[#8A8A82] truncate">
            {item.description}
          </div>
        </div>
      </div>

      <div>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-[11.5px] font-medium ${SYSTEM_BADGE[item.system]}`}
        >
          {SYSTEM_LABEL[item.system]}
        </span>
      </div>

      <div className="text-[12.5px] text-[#111111]">
        {item.client ?? 'General reference'}
        <div className="font-mono text-[10.5px] text-[#8A8A82] mt-0.5">
          {item.jobRef ?? 'Library asset'}
        </div>
      </div>

      <div>
        <span className="inline-flex items-center gap-1.5 text-[12px] text-[#4B4B46]">
          <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotClass}`} />
          {statusMeta.label}
        </span>
      </div>

      <div className="text-[12px] text-[#4B4B46]">
        {item.modifiedLabel}
        <div className="text-[11px] text-[#8A8A82] mt-px">
          {item.modifiedRelative}
        </div>
      </div>

      <div className="flex gap-0.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <button
          type="button"
          aria-label="Preview"
          className="w-7 h-7 flex items-center justify-center rounded-md text-[#8A8A82] hover:bg-[#F3F3EF] hover:text-[#111111] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
        >
          <Eye className="w-3.5 h-3.5" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          aria-label="More"
          className="w-7 h-7 flex items-center justify-center rounded-md text-[#8A8A82] hover:bg-[#F3F3EF] hover:text-[#111111] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
        >
          <MoreHorizontal className="w-3.5 h-3.5" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
