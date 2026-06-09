'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import MobileShell from '@/components/dev-app/layout/MobileShell';
import {
  TEXT_1,
  TEXT_2,
  TEXT_3,
  BORDER_LIGHT,
  SURFACE_1,
  GOLD,
  GOLD_LIGHT,
} from '@/lib/dev-app/design-system';

export default function UnitsListPage() {
  const router = useRouter();
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/dev-app/units')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setUnits(d.units ?? []);
      })
      .catch(() => setError('Failed to load units'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <MobileShell>
      <div style={{ padding: 20 }}>
        <h1 style={{ color: TEXT_1, fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
          Units
        </h1>
        <p style={{ color: TEXT_2, fontSize: 13, marginBottom: 14 }}>
          Tap a unit for its snags, HPI readiness and Home User Guide.
        </p>

        <div
          onClick={() => router.push('/dev-app/hpi')}
          style={{
            cursor: 'pointer',
            background: GOLD_LIGHT,
            border: `1px solid ${GOLD}33`,
            borderRadius: 12,
            padding: 14,
            marginBottom: 18,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ color: TEXT_1, fontSize: 14, fontWeight: 650 }}>HPI Readiness board</div>
            <div style={{ color: TEXT_2, fontSize: 12, marginTop: 2 }}>
              QA 8.0 evidence across every scheme — guides, demos, aftercare
            </div>
          </div>
          <span style={{ color: GOLD, fontSize: 18, fontWeight: 700 }}>→</span>
        </div>

        {loading && <p style={{ color: TEXT_3, fontSize: 14 }}>Loading…</p>}
        {error && <p style={{ color: TEXT_3, fontSize: 14 }}>{error}</p>}
        {!loading && !error && units.length === 0 && (
          <p style={{ color: TEXT_3, fontSize: 14 }}>No units found.</p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {units.map((u) => (
            <div
              key={u.id}
              onClick={() => router.push(`/dev-app/units/${u.id}`)}
              style={{
                cursor: 'pointer',
                background: SURFACE_1,
                border: `1px solid ${BORDER_LIGHT}`,
                borderRadius: 12,
                padding: 14,
              }}
            >
              <div style={{ color: TEXT_1, fontSize: 15, fontWeight: 600 }}>
                {u.unit_number ? `Unit ${u.unit_number}` : 'Unit'}
              </div>
              <div style={{ color: TEXT_2, fontSize: 12, marginTop: 2 }}>
                {u.address_line_1 || u.development_name || ''}
              </div>
            </div>
          ))}
        </div>
      </div>
    </MobileShell>
  );
}
