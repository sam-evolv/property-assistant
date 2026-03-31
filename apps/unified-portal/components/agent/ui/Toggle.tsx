'use client';
import { T } from '@/lib/agent/tokens';

export function Toggle<V extends string>({ options, value, onChange }: { options: { label: string; value: V }[]; value: V; onChange: (v: V) => void }) {
  return (
    <div style={{
      display: 'flex', background: T.s1, borderRadius: 10, padding: 3, gap: 2,
    }}>
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)} style={{
          flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
          background: value === o.value ? T.card : 'transparent',
          boxShadow: value === o.value ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
          fontSize: 12, fontWeight: value === o.value ? 600 : 400,
          color: value === o.value ? T.t1 : T.t3,
        }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
