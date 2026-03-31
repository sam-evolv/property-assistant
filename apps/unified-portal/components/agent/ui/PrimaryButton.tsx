'use client';
import { T } from '@/lib/agent/tokens';

interface Props {
  children: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export function PrimaryButton({ children, onClick, style }: Props) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      padding: '10px 14px', borderRadius: 12,
      background: T.t1, border: 'none',
      fontSize: 12, fontWeight: 600, color: T.card,
      cursor: 'pointer',
      ...style,
    }}>
      {children}
    </button>
  );
}
