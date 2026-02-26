'use client';
import { SECTORS, SURFACE_1, BG, TEXT_1, TEXT_3, EASE_PREMIUM } from '@/lib/dev-app/design-system';
import type { Sector } from '@/lib/dev-app/design-system';
interface SectorSwitchProps { sector: Sector; onSectorChange: (s: Sector) => void; }
export default function SectorSwitch({ sector, onSectorChange }: SectorSwitchProps) {
  return (
    <div style={{ display: 'flex', margin: '0 20px', background: SURFACE_1, borderRadius: 12, padding: 3 }}>
      {(Object.entries(SECTORS) as [Sector, typeof SECTORS.bts][]).map(([k, v]) => (
        <div key={k} onClick={() => onSectorChange(k)} style={{
          flex: 1, padding: '8px 4px', borderRadius: 10, textAlign: 'center',
          fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
          background: sector === k ? BG : 'transparent',
          color: sector === k ? TEXT_1 : TEXT_3,
          boxShadow: sector === k ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
          transition: `all 0.25s ${EASE_PREMIUM}`,
        }}>{v.short}</div>
      ))}
    </div>
  );
}
