'use client';

import AnimCounter from '../shared/AnimCounter';
import { CARD_STYLE } from '@/lib/dev-app/constants';

interface StatData {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}

interface StatCardsProps {
  stats: StatData[];
}

export default function StatCards({ stats }: StatCardsProps) {
  return (
    <div className="px-4 pb-3">
      <div className="grid grid-cols-4 gap-2">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className="rounded-2xl p-3 text-center"
            style={{
              ...CARD_STYLE,
              padding: 10,
              opacity: 0,
              animation: `devapp-fadeInUp 0.55s cubic-bezier(0.16,1,0.3,1) ${i * 60}ms forwards`,
            }}
          >
            <AnimCounter
              value={stat.value}
              prefix={stat.prefix}
              suffix={stat.suffix}
              decimals={stat.decimals}
              className="block text-[18px] font-extrabold text-[#111827] tracking-tight"
            />
            <span className="text-[10px] font-medium text-[#9ca3af] uppercase tracking-wider">
              {stat.label}
            </span>
          </div>
        ))}
      </div>
      <style jsx>{`
        @keyframes devapp-fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
