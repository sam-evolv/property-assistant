'use client';
import { TEXT_1, TEXT_2, SURFACE_1, BORDER, EASE_PREMIUM } from '@/lib/dev-app/design-system';
interface PillsProps { items: string[]; active: string; onSelect: (item: string) => void; }
export default function Pills({ items, active, onSelect }: PillsProps) {
  return (
    <div style={{ display: 'flex', gap: 6, padding: '14px 20px', overflowX: 'auto' }}>
      {items.map(item => (
        <div key={item} onClick={() => onSelect(item)} className="da-press" style={{
          padding: '7px 16px', borderRadius: 24, fontSize: 12.5, fontWeight: 600,
          background: active === item ? TEXT_1 : SURFACE_1,
          color: active === item ? '#fff' : TEXT_2,
          border: `1px solid ${active === item ? TEXT_1 : BORDER}`,
          whiteSpace: 'nowrap', transition: `all 0.25s ${EASE_PREMIUM}`,
        }}>{item}</div>
      ))}
    </div>
  );
}
