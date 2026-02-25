'use client';

import { SECTOR_TERMINOLOGY, type Sector } from '@/lib/dev-app/constants';

interface SectorBadgeProps {
  sector: Sector;
  className?: string;
}

export default function SectorBadge({ sector, className = '' }: SectorBadgeProps) {
  const term = SECTOR_TERMINOLOGY[sector] || SECTOR_TERMINOLOGY.bts;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide ${className}`}
      style={{
        color: term.color,
        backgroundColor: `${term.color}10`,
        border: `1px solid ${term.color}20`,
      }}
    >
      {term.short}
    </span>
  );
}
