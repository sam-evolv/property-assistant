'use client';

import { ChevronRight } from 'lucide-react';
import SectorBadge from '../shared/SectorBadge';
import ShimmerEffect from '../shared/ShimmerEffect';
import { CARD_STYLE, COLORS } from '@/lib/dev-app/constants';
import { useStaggeredEntrance } from '@/hooks/useDevApp';
import type { Sector } from '@/lib/dev-app/constants';

export interface DevelopmentSummary {
  id: string;
  name: string;
  location?: string;
  sector: Sector;
  total_units: number;
  sold_units: number;
  progress: number; // 0-100
  is_most_active?: boolean;
}

interface DevelopmentCardsProps {
  developments: DevelopmentSummary[];
  onTap?: (dev: DevelopmentSummary) => void;
}

function getProgressColor(pct: number) {
  if (pct >= 70) return COLORS.green;
  if (pct >= 40) return COLORS.amber;
  return COLORS.red;
}

export default function DevelopmentCards({ developments, onTap }: DevelopmentCardsProps) {
  const visibleCount = useStaggeredEntrance(developments.length);

  return (
    <div className="px-4 pb-4">
      <h2 className="text-[12px] font-semibold text-[#6b7280] uppercase tracking-wider mb-2">
        Developments
      </h2>
      <div className="space-y-2.5">
        {developments.map((dev, i) => {
          const visible = i < visibleCount;
          const progressColor = getProgressColor(dev.progress);
          const card = (
            <button
              key={dev.id}
              onClick={() => onTap?.(dev)}
              className="w-full rounded-2xl p-4 text-left transition-all active:scale-[0.97]"
              style={{
                ...CARD_STYLE,
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(12px)',
                transition:
                  'opacity 0.4s cubic-bezier(0.16,1,0.3,1), transform 0.4s cubic-bezier(0.16,1,0.3,1)',
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-bold text-[#111827]">{dev.name}</span>
                  <SectorBadge sector={dev.sector} />
                </div>
                <ChevronRight size={16} className="text-[#9ca3af]" />
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] text-[#6b7280]">
                  {dev.total_units} units · {dev.sold_units} sold
                </span>
                <span
                  className="text-[12px] font-semibold"
                  style={{ color: progressColor }}
                >
                  {dev.progress}%
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-[#f3f4f6] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width: `${dev.progress}%`,
                    backgroundColor: progressColor,
                  }}
                />
              </div>
            </button>
          );

          return (
            <div key={dev.id} style={{ position: 'relative' }}>
              {card}
              {dev.is_most_active && <ShimmerEffect />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
