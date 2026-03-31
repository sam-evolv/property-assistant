'use client';
import { T } from '@/lib/agent/tokens';

export function Pill({
  children,
  color = T.t3,
  bg = T.s1,
}: {
  children: React.ReactNode;
  color?: string;
  bg?: string;
}) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: 8,
      fontSize: 10, fontWeight: 600,
      color, background: bg,
      whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
}
