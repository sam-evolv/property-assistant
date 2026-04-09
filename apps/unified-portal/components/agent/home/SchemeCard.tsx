'use client';
import { T } from '@/lib/agent/tokens';
import { AgentScheme } from '@/lib/agent/types';

interface Props {
  scheme: AgentScheme;
  onTap?: () => void;
}

export function SchemeCard({ scheme, onTap }: Props) {
  const stages = scheme.stages;
  const sold = stages ? stages.closed : 0;
  const soldPct = scheme.total_units > 0 ? Math.round((sold / scheme.total_units) * 100) : 0;
  const reserved = stages ? stages.deposit + stages.contracts_issued + stages.contracts_signed : 0;
  const available = scheme.total_units - sold - reserved;

  return (
    <div onClick={onTap} style={{
      background: T.card, borderRadius: 16, border: `1px solid ${T.line}`,
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      marginBottom: 12, cursor: onTap ? 'pointer' : 'default', overflow: 'hidden',
    }}>
      <div style={{ padding: '16px 18px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.t1 }}>{scheme.name}</div>
            <div style={{ fontSize: 11, color: T.t3 }}>
              {scheme.developer_name} · {scheme.location}
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: T.goldD }}>{soldPct}%</div>
        </div>

        {/* Progress bar */}
        <div style={{ height: 3, borderRadius: 2, background: T.s2, marginBottom: 14 }}>
          <div style={{
            height: '100%', borderRadius: 2, width: `${soldPct}%`,
            background: `linear-gradient(90deg, ${T.goldD}, ${T.gold})`,
          }} />
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', borderTop: `1px solid ${T.line}`, padding: '12px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1 }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: T.go }} />
          <span style={{ fontSize: 11, color: T.t3 }}>Sold <strong style={{ color: T.t1 }}>{sold}</strong></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1 }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: T.info }} />
          <span style={{ fontSize: 11, color: T.t3 }}>Reserved <strong style={{ color: T.t1 }}>{reserved}</strong></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1 }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: T.s3 }} />
          <span style={{ fontSize: 11, color: T.t3 }}>Available <strong style={{ color: T.t1 }}>{available > 0 ? available : 0}</strong></span>
        </div>
        <span style={{ fontSize: 10, color: T.t4 }}>{scheme.completion_date}</span>
      </div>
    </div>
  );
}
