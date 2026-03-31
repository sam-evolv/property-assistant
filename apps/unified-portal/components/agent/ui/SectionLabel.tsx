'use client';
import { T } from '@/lib/agent/tokens';

interface Props {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function SectionLabel({ children, style }: Props) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
      color: T.t4, textTransform: 'uppercase',
      marginBottom: 10,
      ...style,
    }}>
      {children}
    </div>
  );
}
