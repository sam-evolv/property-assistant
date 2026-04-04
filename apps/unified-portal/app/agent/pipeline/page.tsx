'use client';

import { useMemo } from 'react';
import AgentShell from '../_components/AgentShell';
import SchemeCard from '../_components/SchemeCard';
import type { Scheme as UIScheme } from '../_components/types';
import { SCHEMES, BUYERS, AGENT_STATS } from '@/lib/agent/demo-data';

function adaptSchemes(): UIScheme[] {
  return SCHEMES.map((s) => {
    const schemeBuyers = BUYERS.filter((b) => b.scheme === s.name);
    const pct = s.total > 0 ? Math.round((s.sold / s.total) * 100) : 0;
    const urgentCount = schemeBuyers.filter((b) => b.urgent).length;

    return {
      id: s.id,
      name: s.name,
      developer: 'Longview Estates',
      location: 'Co. Cork',
      totalUnits: s.total,
      sold: s.sold,
      reserved: s.reserved,
      available: s.available,
      percentSold: pct,
      activeBuyers: schemeBuyers.filter((b) => b.status !== 'sold').length,
      urgentCount,
      buyers: [],
    };
  });
}

export default function PipelinePage() {
  const schemes = useMemo(() => adaptSchemes(), []);

  return (
    <AgentShell agentName="Sam" urgentCount={AGENT_STATS.urgent}>
      <div style={{ padding: '8px 24px 100px' }}>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: '-0.05em',
            color: '#0D0D12',
            marginBottom: 20,
          }}
        >
          Sales Pipeline
        </h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {schemes.map((s) => (
            <SchemeCard key={s.id} scheme={s} showViewBuyers />
          ))}
        </div>
      </div>
    </AgentShell>
  );
}
