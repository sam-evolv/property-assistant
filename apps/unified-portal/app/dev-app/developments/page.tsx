'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import MobileShell from '@/components/dev-app/layout/MobileShell';
import Header from '@/components/dev-app/layout/Header';
import SectorSwitch from '@/components/dev-app/shared/SectorSwitch';
import { SearchIcon, ChevronIcon } from '@/components/dev-app/shared/Icons';
import {
  GOLD, TEXT_1, TEXT_2, TEXT_3, SURFACE_1, SURFACE_2, BORDER, BORDER_LIGHT,
  DEV_DATA, type Sector,
} from '@/lib/dev-app/design-system';

export default function DevelopmentsPage() {
  const router = useRouter();
  const [sector, setSector] = useState<Sector>('bts');
  const [search, setSearch] = useState('');

  const devs = DEV_DATA[sector].filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <MobileShell>
      <Header title="Developments" />

      <div style={{ paddingTop: 14 }}>
        <SectorSwitch sector={sector} onSectorChange={setSector} />
      </div>

      {/* Search bar */}
      <div style={{ padding: '14px 20px 0' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            height: 44,
            background: SURFACE_1,
            borderRadius: 12,
            border: `1px solid ${BORDER}`,
            padding: '0 12px',
          }}
        >
          <SearchIcon />
          <input
            type="text"
            placeholder="Search developments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontSize: 14,
              color: TEXT_1,
              marginLeft: 8,
            }}
          />
        </div>
      </div>

      {/* Development list */}
      <div style={{ padding: 20 }}>
        {devs.map((dev, i) => {
          const stagger =
            i === 0 ? '' : i === 1 ? ' da-delay-1' : i === 2 ? ' da-delay-2' : ' da-delay-3';

          return (
            <div
              key={dev.name}
              className={`da-press da-anim-in${stagger}`}
              onClick={() =>
                router.push(`/dev-app/developments/${encodeURIComponent(dev.name)}`)
              }
              style={{
                background: '#fff',
                borderRadius: 16,
                border: `1px solid ${BORDER_LIGHT}`,
                padding: 16,
                marginBottom: 10,
                cursor: 'pointer',
              }}
            >
              {/* Top row */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}
              >
                <div>
                  <div style={{ color: TEXT_1, fontSize: 15, fontWeight: 700 }}>
                    {dev.name}
                  </div>
                  <div style={{ color: TEXT_3, fontSize: 12, marginTop: 2 }}>
                    {dev.loc}
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div
                style={{
                  marginTop: 12,
                  height: 6,
                  borderRadius: 3,
                  background: SURFACE_2,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${dev.pct}%`,
                    borderRadius: 3,
                    background: GOLD,
                  }}
                />
              </div>

              {/* Bottom row */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: 10,
                }}
              >
                <span style={{ color: TEXT_2, fontSize: 12 }}>
                  {dev.units} units
                </span>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span style={{ color: TEXT_2, fontSize: 12, fontWeight: 600 }}>
                    {dev.pct}%
                  </span>
                  <ChevronIcon />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </MobileShell>
  );
}
