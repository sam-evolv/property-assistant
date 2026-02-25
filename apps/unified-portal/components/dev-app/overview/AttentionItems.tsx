'use client';

import { AlertTriangle, Clock, MessageCircle, TrendingDown } from 'lucide-react';
import { CARD_ELEVATED, COLORS } from '@/lib/dev-app/constants';
import { useStaggeredEntrance } from '@/hooks/useDevApp';

interface AttentionItem {
  id: string;
  type: string;
  severity: 'red' | 'amber' | 'blue' | 'gold';
  title: string;
  detail?: string;
  development_name?: string;
  development_id?: string;
  unit_id?: string;
}

interface AttentionItemsProps {
  items: AttentionItem[];
  onItemTap?: (item: AttentionItem) => void;
}

const SEVERITY_CONFIG = {
  red: { bg: COLORS.redBg, border: '#fecaca', color: COLORS.red, icon: AlertTriangle },
  amber: { bg: COLORS.amberBg, border: '#fed7aa', color: COLORS.amber, icon: Clock },
  blue: { bg: COLORS.blueBg, border: '#bfdbfe', color: COLORS.blue, icon: MessageCircle },
  gold: { bg: COLORS.goldLight, border: '#fde68a', color: COLORS.gold, icon: TrendingDown },
};

export default function AttentionItems({ items, onItemTap }: AttentionItemsProps) {
  const visibleCount = useStaggeredEntrance(items.length);

  if (items.length === 0) return null;

  return (
    <div className="px-4 pb-2">
      <h2 className="text-[12px] font-semibold text-[#6b7280] uppercase tracking-wider mb-2">
        Needs Attention
      </h2>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
        {items.map((item, i) => {
          const config = SEVERITY_CONFIG[item.severity] || SEVERITY_CONFIG.amber;
          const Icon = config.icon;
          const visible = i < visibleCount;

          return (
            <button
              key={item.id}
              onClick={() => onItemTap?.(item)}
              className="flex-shrink-0 w-[260px] rounded-2xl p-3.5 text-left transition-all active:scale-[0.97]"
              style={{
                ...CARD_ELEVATED,
                borderColor: config.border,
                backgroundColor: config.bg,
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(12px)',
                transition: 'opacity 0.4s cubic-bezier(0.16,1,0.3,1), transform 0.4s cubic-bezier(0.16,1,0.3,1)',
              }}
            >
              <div className="flex items-start gap-2.5">
                <div
                  className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${config.color}15` }}
                >
                  <Icon size={14} style={{ color: config.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[#111827] leading-tight">
                    {item.title}
                  </p>
                  {item.detail && (
                    <p className="text-[11px] text-[#6b7280] mt-0.5 line-clamp-2">
                      {item.detail}
                    </p>
                  )}
                  {item.development_name && (
                    <p className="text-[10px] text-[#9ca3af] mt-1 font-medium">
                      {item.development_name}
                    </p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
