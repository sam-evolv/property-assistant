'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import MobileShell from '@/components/dev-app/layout/MobileShell';
import Header from '@/components/dev-app/layout/Header';
import { SearchIcon, ChevronIcon } from '@/components/dev-app/shared/Icons';
import {
  GOLD, TEXT_1, TEXT_2, TEXT_3, SURFACE_1, SURFACE_2, BORDER, BORDER_LIGHT,
} from '@/lib/dev-app/design-system';

interface Development {
  id: string;
  name: string;
  location: string;
  sector: string;
  total_units: number;
  sold_units: number;
  progress: number;
}

export default function DevelopmentsPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dev-app/developments')
      .then(r => r.json())
      .then(data => setDevelopments(data.developments || []))
      .catch(() => setDevelopments([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = developments.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <MobileShell>
      <Header title="Developments" />

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
        {loading ? (
          [1, 2, 3].map(i => (
            <div
              key={i}
              style={{
                height: 120,
                borderRadius: 16,
                background: SURFACE_2,
                marginBottom: 10,
              }}
              className="da-anim-fade"
            />
          ))
        ) : filtered.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '40px 20px',
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>🏗️</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: TEXT_1 }}>
              {search ? 'No matching developments' : 'No developments yet'}
            </div>
            <div style={{ fontSize: 13, color: TEXT_3, marginTop: 4 }}>
              {search
                ? 'Try a different search term.'
                : 'Your developments will appear here once set up.'}
            </div>
          </div>
        ) : (
          filtered.map((dev, i) => (
            <div
              key={dev.id}
              className={`da-press da-anim-in da-s${Math.min(i + 1, 7)}`}
              onClick={() => router.push(`/dev-app/developments/${dev.id}`)}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ color: TEXT_1, fontSize: 15, fontWeight: 700 }}>
                    {dev.name}
                  </div>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: GOLD,
                      background: `${GOLD}12`,
                      padding: '2px 6px',
                      borderRadius: 4,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {(dev.sector || 'bts').toUpperCase()}
                  </span>
                </div>
              </div>
              <div style={{ color: TEXT_3, fontSize: 12, marginTop: 2 }}>
                {dev.location}
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
                    width: `${dev.progress}%`,
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
                  {dev.total_units} units &middot; {dev.sold_units} sold
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ color: TEXT_2, fontSize: 12, fontWeight: 600 }}>
                    {dev.progress}%
                  </span>
                  <ChevronIcon />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </MobileShell>
  );
}
