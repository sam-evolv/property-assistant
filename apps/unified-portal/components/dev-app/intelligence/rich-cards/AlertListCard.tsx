'use client';

import { AlertTriangle, Clock, TrendingDown } from 'lucide-react';

interface AlertItem {
  severity: 'red' | 'amber' | 'gold';
  title: string;
  detail: string;
  development_name?: string;
  action_label?: string;
  action_url?: string;
}

interface AlertListData {
  items: AlertItem[];
}

const SEVERITY_CONFIG = {
  red: { icon: AlertTriangle, color: '#dc2626', bg: 'rgba(220,38,38,0.05)' },
  amber: { icon: Clock, color: '#d97706', bg: 'rgba(217,119,6,0.05)' },
  gold: { icon: TrendingDown, color: '#D4AF37', bg: 'rgba(212,175,55,0.07)' },
};

export default function AlertListCard({ data }: { data: AlertListData }) {
  return (
    <div className="rounded-xl border border-[#f3f4f6] overflow-hidden bg-white">
      <div className="divide-y divide-[#f3f4f6]">
        {data.items.map((item, i) => {
          const config = SEVERITY_CONFIG[item.severity];
          const Icon = config.icon;
          return (
            <div
              key={i}
              className="flex items-start gap-2.5 px-3.5 py-2.5"
              style={{ backgroundColor: config.bg }}
            >
              <Icon
                size={14}
                className="mt-0.5 flex-shrink-0"
                style={{ color: config.color }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-[#111827]">
                  {item.title}
                </p>
                <p className="text-[11px] text-[#6b7280] mt-0.5">
                  {item.detail}
                </p>
                {item.development_name && (
                  <p className="text-[10px] text-[#9ca3af] mt-0.5">
                    {item.development_name}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
