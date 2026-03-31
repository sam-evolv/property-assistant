'use client';
import { T, STATUS } from '@/lib/agent/tokens';
import { AgentUnit } from '@/lib/agent/types';
import { Badge } from '../ui/Badge';

interface Props {
  unit: AgentUnit;
  onTap?: () => void;
}

export function UnitRow({ unit, onTap }: Props) {
  const s = STATUS[unit.status] || STATUS.available;
  return (
    <div onClick={onTap} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 0',
      borderBottom: `1px solid ${T.line}`,
      cursor: onTap ? 'pointer' : 'default',
    }}>
      <span style={{
        padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
        background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      }}>
        {unit.unit_ref}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: T.t1 }}>{unit.buyer_name || '—'}</div>
        <div style={{ fontSize: 11, color: T.t3 }}>{unit.unit_type}{unit.sqm ? ` · ${unit.sqm}m²` : ''}</div>
      </div>
      {unit.price && (
        <span style={{ fontSize: 12, fontWeight: 600, color: T.t2 }}>
          €{(unit.price / 1000).toFixed(0)}k
        </span>
      )}
      <Badge status={unit.status} />
    </div>
  );
}
