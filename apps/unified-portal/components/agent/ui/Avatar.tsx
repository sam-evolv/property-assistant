'use client';
import { T } from '@/lib/agent/tokens';

export function Avatar({ initials, size = 44, gold = false }: { initials: string; size?: number; gold?: boolean }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.3,
      background: gold ? T.goldL : T.s1,
      border: `1px solid ${gold ? T.goldM : T.line}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.32, fontWeight: 700, color: gold ? T.goldD : T.t2,
      flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}
