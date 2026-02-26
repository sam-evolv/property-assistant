'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import MobileShell from '@/components/dev-app/layout/MobileShell';
import Header from '@/components/dev-app/layout/Header';
import SectorSwitch from '@/components/dev-app/shared/SectorSwitch';
import ProgressRing from '@/components/dev-app/shared/ProgressRing';
import AnimCounter from '@/components/dev-app/shared/AnimCounter';
import { SearchIcon, ChevronIcon } from '@/components/dev-app/shared/Icons';
import {
  GOLD, TEXT_1, TEXT_2, TEXT_3, SURFACE_1, SURFACE_2, BORDER, BORDER_LIGHT,
  DEV_DATA, type Sector,
} from '@/lib/dev-app/design-system';

interface DevItem {
  id?: string;
  name: string;
  loc: string;
  units: number;
  pct: number;
  sold: number;
  sector?: string;
}

export default function DevelopmentsPage() {
  const router = useRouter();
  const [sector, setSector] = useState<Sector>('bts');
  const [search, setSearch] = useState('');
  const [apiDevs, setApiDevs] = useState<DevItem[]>([]);

  // Fetch real developments from API
  useEffect(() => {
    async function fetchDevs() {
      try {
        const res = await fetch('/api/dev-app/developments');
        if (res.ok) {
          const data = await res.json();
          if (data.developments?.length > 0) {
            setApiDevs(data.developments.map((d: any) => ({
              id: d.id,
              name: d.name,
              loc: d.location,
              units: d.total_units,
              pct: d.progress,
              sold: d.sold_units,
              sector: d.sector,
            })));
          }
        }
      } catch {
        // Fallback to hardcoded
      }
    }
    fetchDevs();
  }, []);

  // Use API data or fallback
  const allDevs: DevItem[] = apiDevs.length > 0
    ? apiDevs.filter(d => !sector || d.sector === sector || apiDevs.length <= 5)
    : DEV_DATA[sector].map(d => ({ name: d.name, loc: d.loc, units: d.units, pct: d.pct, sold: d.sold }));

  const devs = allDevs.filter((d) =>
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
          className="da-anim-in"
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
        {devs.map((dev, i) => (
          <div
            key={dev.name}
            className={`da-press da-anim-in da-s${Math.min(i + 1, 7)}`}
            onClick={() => {
              if (dev.id) {
                router.push(`/dev-app/developments/${dev.id}`);
              } else {
                router.push(`/dev-app/developments/${encodeURIComponent(dev.name)}`);
              }
            }}
            style={{
              background: '#fff',
              borderRadius: 16,
              border: `1px solid ${BORDER_LIGHT}`,
              padding: 16,
              marginBottom: 10,
              cursor: 'pointer',
            }}
          >
            {/* Top row with ProgressRing */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: TEXT_1, fontSize: 15, fontWeight: 700 }}>
                  {dev.name}
                </div>
                <div style={{ color: TEXT_3, fontSize: 12, marginTop: 2 }}>
                  {dev.loc}
                </div>
              </div>
              <ProgressRing percent={dev.pct} size={44} delay={200 + i * 150} />
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
                <AnimCounter value={dev.sold} delay={300 + i * 100} /> of {dev.units} sold
              </span>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <ChevronIcon />
              </div>
            </div>
          </div>
        ))}

        {devs.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: 40,
              color: TEXT_3,
              fontSize: 14,
            }}
          >
            No developments found
          </div>
        )}
      </div>
    </MobileShell>
  );
}
