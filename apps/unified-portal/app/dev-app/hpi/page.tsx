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
  SURFACE_2,
  GOLD,
  GREEN,
  GREEN_BG,
  AMBER,
  AMBER_BG,
} from '@/lib/dev-app/design-system';

interface HpiUnit {
  id: string;
  unit_number: string;
  address_line_1: string | null;
  guide_issued: boolean;
  demo_completed: boolean;
  aftercare_activated: boolean;
  systems_documented: number;
  qa8_ready: boolean;
}

interface HpiDevelopment {
  id: string;
  name: string;
  total_units: number;
  qa8_ready: number;
  guide_issued: number;
  demo_completed: number;
  aftercare_activated: number;
  units: HpiUnit[];
}

function Tick({ on }: { on: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 18,
        height: 18,
        borderRadius: '50%',
        background: on ? GREEN_BG : SURFACE_2,
        color: on ? GREEN : TEXT_3,
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      {on ? '✓' : '–'}
    </span>
  );
}

export default function HpiReadinessPage() {
  const router = useRouter();
  const [devs, setDevs] = useState<HpiDevelopment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/dev-app/hpi/summary')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setDevs(d.developments ?? []);
      })
      .catch(() => setError('Failed to load HPI readiness'))
      .finally(() => setLoading(false));
  }, []);

  const totals = devs.reduce(
    (acc, d) => ({ units: acc.units + d.total_units, ready: acc.ready + d.qa8_ready }),
    { units: 0, ready: 0 }
  );

  return (
    <MobileShell>
      <div style={{ padding: 20 }}>
        <h1 style={{ color: TEXT_1, fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
          HPI Readiness
        </h1>
        <p style={{ color: TEXT_2, fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
          QA 8.0 Consumer Information &amp; Aftercare evidence per home — Home User Guide
          issued, handover demo logged, aftercare active. This is the trail an HPI
          assessor reviews at as-built stage.
        </p>

        {loading && <p style={{ color: TEXT_3, fontSize: 14 }}>Loading…</p>}
        {error && <p style={{ color: TEXT_3, fontSize: 14 }}>{error}</p>}

        {!loading && !error && (
          <>
            <div
              style={{
                background: SURFACE_1,
                border: `1px solid ${BORDER_LIGHT}`,
                borderRadius: 14,
                padding: 16,
                marginBottom: 16,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ color: TEXT_2, fontSize: 12.5, fontWeight: 600, letterSpacing: 0.2 }}>
                  PORTFOLIO
                </span>
                <span style={{ color: TEXT_1, fontSize: 13, fontWeight: 700 }}>
                  {totals.ready}/{totals.units} homes ready
                </span>
              </div>
              <div
                style={{
                  marginTop: 10,
                  height: 6,
                  borderRadius: 3,
                  background: SURFACE_2,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: totals.units > 0 ? `${(totals.ready / totals.units) * 100}%` : '0%',
                    height: '100%',
                    borderRadius: 3,
                    background: GOLD,
                    transition: 'width 400ms ease',
                  }}
                />
              </div>
            </div>

            {devs.length === 0 && (
              <p style={{ color: TEXT_3, fontSize: 14 }}>No developments found.</p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {devs.map((d) => {
                const pct = d.total_units > 0 ? Math.round((d.qa8_ready / d.total_units) * 100) : 0;
                const isOpen = expanded === d.id;
                return (
                  <div
                    key={d.id}
                    style={{
                      background: SURFACE_1,
                      border: `1px solid ${BORDER_LIGHT}`,
                      borderRadius: 14,
                      overflow: 'hidden',
                    }}
                  >
                    <button
                      onClick={() => setExpanded(isOpen ? null : d.id)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 16,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: TEXT_1, fontSize: 15, fontWeight: 650 }}>{d.name}</span>
                        <span
                          style={{
                            fontSize: 11.5,
                            fontWeight: 700,
                            color: pct === 100 ? GREEN : AMBER,
                            background: pct === 100 ? GREEN_BG : AMBER_BG,
                            borderRadius: 999,
                            padding: '3px 9px',
                          }}
                        >
                          {d.qa8_ready}/{d.total_units} ready
                        </span>
                      </div>
                      <div
                        style={{
                          marginTop: 10,
                          height: 5,
                          borderRadius: 3,
                          background: SURFACE_2,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${pct}%`,
                            height: '100%',
                            borderRadius: 3,
                            background: pct === 100 ? GREEN : GOLD,
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
                        <span style={{ color: TEXT_2, fontSize: 11.5 }}>
                          Guides {d.guide_issued}/{d.total_units}
                        </span>
                        <span style={{ color: TEXT_2, fontSize: 11.5 }}>
                          Demos {d.demo_completed}/{d.total_units}
                        </span>
                        <span style={{ color: TEXT_2, fontSize: 11.5 }}>
                          Aftercare {d.aftercare_activated}/{d.total_units}
                        </span>
                      </div>
                    </button>

                    {isOpen && (
                      <div style={{ borderTop: `1px solid ${BORDER_LIGHT}` }}>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 44px 44px 44px',
                            gap: 4,
                            padding: '8px 16px',
                            color: TEXT_3,
                            fontSize: 10.5,
                            fontWeight: 600,
                            letterSpacing: 0.3,
                          }}
                        >
                          <span>UNIT</span>
                          <span style={{ textAlign: 'center' }}>GUIDE</span>
                          <span style={{ textAlign: 'center' }}>DEMO</span>
                          <span style={{ textAlign: 'center' }}>CARE</span>
                        </div>
                        {d.units.map((u) => (
                          <div
                            key={u.id}
                            onClick={() => router.push(`/dev-app/units/${u.id}`)}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr 44px 44px 44px',
                              gap: 4,
                              alignItems: 'center',
                              padding: '9px 16px',
                              borderTop: `1px solid ${BORDER_LIGHT}`,
                              cursor: 'pointer',
                            }}
                          >
                            <span style={{ color: TEXT_1, fontSize: 13.5, fontWeight: 550 }}>
                              {u.unit_number ? `Unit ${u.unit_number}` : u.address_line_1 || 'Unit'}
                            </span>
                            <span style={{ textAlign: 'center' }}>
                              <Tick on={u.guide_issued} />
                            </span>
                            <span style={{ textAlign: 'center' }}>
                              <Tick on={u.demo_completed} />
                            </span>
                            <span style={{ textAlign: 'center' }}>
                              <Tick on={u.aftercare_activated} />
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </MobileShell>
  );
}
