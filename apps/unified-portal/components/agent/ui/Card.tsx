'use client';
import { T } from '@/lib/agent/tokens';

export function Card({ children, style, onClick }: { children: React.ReactNode; style?: React.CSSProperties; onClick?: () => void }) {
  return (
    <div onClick={onClick} style={{
      background: T.card, borderRadius: 16, border: `1px solid ${T.line}`,
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)', ...style,
    }}>
      {children}
    </div>
  );
}
