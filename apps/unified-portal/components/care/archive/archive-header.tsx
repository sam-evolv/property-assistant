'use client';

import { Share2, Upload } from 'lucide-react';

interface ArchiveHeaderProps {
  totalItems: number;
  onShare?: () => void;
  onUpload?: () => void;
}

export function ArchiveHeader({ totalItems, onShare, onUpload }: ArchiveHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <h1 className="text-[28px] font-semibold text-[#111111] tracking-[-0.02em] leading-tight">
          Smart Archive
        </h1>
        <p className="mt-1 text-[13px] text-[#8A8A82]">
          <strong className="text-[#4B4B46] font-semibold">
            {totalItems.toLocaleString()} items
          </strong>{' '}
          across all system types, Auto-organised by AI
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onShare}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-[#EAEAE4] text-[13px] font-medium text-[#111111] hover:bg-[#F7F7F4] hover:border-[#D9D9D1] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
        >
          <Share2 className="w-3.5 h-3.5" strokeWidth={1.75} />
          Share link
        </button>
        <button
          type="button"
          onClick={onUpload}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#D4AF37] text-[#0B0C0F] text-[13px] font-semibold shadow-sm hover:bg-[#E8C964] hover:shadow-[0_4px_14px_rgba(212,175,55,0.25)] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
        >
          <Upload className="w-3.5 h-3.5" strokeWidth={2} />
          Upload
        </button>
      </div>
    </div>
  );
}
