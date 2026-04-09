'use client';
import { T } from '@/lib/agent/tokens';
import { AgentBuyer } from '@/lib/agent/types';

interface Props {
  buyer: AgentBuyer;
  onTap?: () => void;
}

export function UrgentRow({ buyer, onTap }: Props) {
  return (
    <div onClick={onTap} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 0',
      borderBottom: `1px solid ${T.line}`,
      cursor: 'pointer',
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: T.flag, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.flag }}>
          Contracts overdue — {buyer.name}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(191,55,40,0.5)' }}>
          {buyer.unit_ref}
        </div>
      </div>
    </div>
  );
}
