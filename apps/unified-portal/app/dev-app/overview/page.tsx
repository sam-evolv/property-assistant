'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/dev-app/layout/Header';
import MobileShell from '@/components/dev-app/layout/MobileShell';
import AttentionItems from '@/components/dev-app/overview/AttentionItems';
import StatCards from '@/components/dev-app/overview/StatCards';
import DevelopmentCards from '@/components/dev-app/overview/DevelopmentCards';
import QuickActions from '@/components/dev-app/overview/QuickActions';
import type { DevelopmentSummary } from '@/components/dev-app/overview/DevelopmentCards';

interface OverviewData {
  stats: {
    pipeline_value: number;
    units_sold: number;
    compliance_pct: number;
    handover_ready: number;
  };
  attention_items: Array<{
    id: string;
    type: string;
    severity: 'red' | 'amber' | 'blue' | 'gold';
    title: string;
    detail?: string;
    development_name?: string;
    development_id?: string;
    unit_id?: string;
  }>;
  developments: DevelopmentSummary[];
}

export default function OverviewPage() {
  const router = useRouter();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOverview() {
      try {
        const [statsRes, attentionRes, devsRes] = await Promise.all([
          fetch('/api/dev-app/overview/stats'),
          fetch('/api/dev-app/overview/attention'),
          fetch('/api/dev-app/developments'),
        ]);

        const stats = statsRes.ok ? await statsRes.json() : { pipeline_value: 0, units_sold: 0, compliance_pct: 0, handover_ready: 0 };
        const attention = attentionRes.ok ? await attentionRes.json() : { items: [] };
        const devs = devsRes.ok ? await devsRes.json() : { developments: [] };

        setData({
          stats,
          attention_items: attention.items || [],
          developments: devs.developments || [],
        });
      } catch {
        setData({
          stats: { pipeline_value: 0, units_sold: 0, compliance_pct: 0, handover_ready: 0 },
          attention_items: [],
          developments: [],
        });
      } finally {
        setLoading(false);
      }
    }
    fetchOverview();
  }, []);

  const handleAttentionTap = (item: any) => {
    if (item.development_id) {
      router.push(`/dev-app/developments/${item.development_id}`);
    }
  };

  const handleDevTap = (dev: DevelopmentSummary) => {
    router.push(`/dev-app/developments/${dev.id}`);
  };

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'ask-intel':
        router.push('/dev-app/intelligence');
        break;
      case 'log-visit':
        router.push('/dev-app/intelligence');
        break;
      case 'view-compliance':
        router.push('/dev-app/developments');
        break;
      case 'homeowners':
        router.push('/dev-app/developments');
        break;
    }
  };

  return (
    <MobileShell>
      <Header title="Overview" onNotificationTap={() => router.push('/dev-app/activity')} />

      {loading ? (
        <div className="px-4 py-6 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-[#f3f4f6] animate-pulse" />
          ))}
        </div>
      ) : data ? (
        <div className="py-3 space-y-2">
          <AttentionItems items={data.attention_items} onItemTap={handleAttentionTap} />

          <StatCards
            stats={[
              {
                label: 'Pipeline',
                value: data.stats.pipeline_value / 1000000,
                prefix: '\u20AC',
                suffix: 'M',
                decimals: 1,
              },
              { label: 'Sold', value: data.stats.units_sold },
              { label: 'Compl.', value: data.stats.compliance_pct, suffix: '%' },
              { label: 'Ready', value: data.stats.handover_ready },
            ]}
          />

          <DevelopmentCards developments={data.developments} onTap={handleDevTap} />

          <QuickActions onAction={handleQuickAction} />
        </div>
      ) : null}
    </MobileShell>
  );
}
