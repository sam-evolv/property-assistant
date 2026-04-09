'use client';
import { T, STATUS } from '@/lib/agent/tokens';

export function Badge({ status }: { status: string }) {
  const s = STATUS[status] || STATUS.enquiry;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px 3px 7px',
      borderRadius: 20,
      background: s.bg,
      border: `1px solid ${s.border}`,
      fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
      color: s.color, textTransform: 'uppercase', whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 3, background: s.color, flexShrink: 0 }} />
      {s.label}
    </span>
  );
}
