'use client';
import { T } from '@/lib/agent/tokens';

export function GoldButton({ children, onClick, disabled, style }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; style?: React.CSSProperties }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      padding: '10px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
      background: T.gold, color: T.t1, fontSize: 13, fontWeight: 600,
      opacity: disabled ? 0.5 : 1, ...style,
    }}>
      {children}
    </button>
  );
}
