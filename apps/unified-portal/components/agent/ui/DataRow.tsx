'use client';
import { T } from '@/lib/agent/tokens';

interface Props {
  label: string;
  value?: string;
  children?: React.ReactNode;
}

export function DataRow({ label, value, children }: Props) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '9px 0',
      borderBottom: `1px solid ${T.line}`,
    }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: T.t3 }}>{label}</span>
      {children ?? <span style={{ fontSize: 13, fontWeight: 500, color: T.t1 }}>{value}</span>}
    </div>
  );
}
