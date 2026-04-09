'use client';
import { T } from '@/lib/agent/tokens';

interface Props {
  children: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export function GhostButton({ children, onClick, style }: Props) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      padding: '10px 14px', borderRadius: 12,
      background: T.s1, border: `1px solid ${T.line}`,
      fontSize: 12, fontWeight: 600, color: T.t2,
      cursor: 'pointer',
      ...style,
    }}>
      {children}
    </button>
  );
}
