'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import MobileShell from '@/components/dev-app/layout/MobileShell';
import Header from '@/components/dev-app/layout/Header';
import { SectionIcon } from '@/components/dev-app/shared/Icons';
import Badge from '@/components/dev-app/shared/Badge';
import Pills from '@/components/dev-app/shared/Pills';
import ContactSheet from '@/components/dev-app/developments/ContactSheet';
import {
  GOLD, TEXT_1, TEXT_2, TEXT_3, SURFACE_2, BORDER_LIGHT,
  RED, RED_BG, AMBER, AMBER_BG, GREEN, GREEN_BG,
  SECTORS, type Sector, type SectorUnit,
} from '@/lib/dev-app/design-system';

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  green: { color: GREEN, bg: GREEN_BG },
  amber: { color: AMBER, bg: AMBER_BG },
  red: { color: RED, bg: RED_BG },
};

interface DevDetail {
  id: string;
  name: string;
  location: string;
  sector: string;
  total_units: number;
  sold_units: number;
  progress: number;
}

export default function DevelopmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const devId = params.devId as string;

  const [dev, setDev] = useState<DevDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('pipeline');
  const [selectedUnit, setSelectedUnit] = useState<SectorUnit | null>(null);
  const [activePill, setActivePill] = useState('All');

  useEffect(() => {
    fetch(`/api/dev-app/developments/${encodeURIComponent(devId)}`)
      .then(r => r.json())
      .then(data => {
        if (data.development) {
          setDev(data.development);
        } else if (data.id) {
          setDev(data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [devId]);

  // Auto-detect sector from development data, default to 'bts'
  const sector: Sector = (dev?.sector as Sector) || 'bts';
  const sectorConfig = SECTORS[sector];

  const filteredUnits =
    activePill === 'All'
      ? sectorConfig.units
      : sectorConfig.units.filter(u =>
          u.stage.toLowerCase().includes(activePill.toLowerCase()),
        );

  if (loading) {
    return (
      <MobileShell>
        <Header
          title="Loading..."
          showBack
          onBack={() => router.back()}
        />
        <div style={{ padding: 20 }}>
          {[1, 2, 3].map(i => (
            <div
              key={i}
              style={{
                height: 80,
                borderRadius: 14,
                background: SURFACE_2,
                marginBottom: 10,
              }}
              className="da-anim-fade"
            />
          ))}
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell>
      <Header
        title={dev?.name || 'Development'}
        showBack
        onBack={() => router.back()}
        rightContent={
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: GOLD,
              background: `${GOLD}12`,
              padding: '3px 8px',
              borderRadius: 6,
              letterSpacing: '0.04em',
            }}
          >
            {sectorConfig.short}
          </span>
        }
      />

      {/* Section cards grid */}
      <div style={{ padding: 20, marginTop: 8 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 10,
          }}
        >
          {sectorConfig.sections.map((section, i) => {
            const isActive = activeSection === section.id;
            return (
              <div
                key={section.id}
                className={`da-press da-anim-in da-s${Math.min(i + 1, 7)}`}
                onClick={() => {
                  setActiveSection(section.id);
                  setActivePill('All');
                }}
                style={{
                  background: '#fff',
                  borderRadius: 14,
                  border: `1px solid ${isActive ? GOLD : BORDER_LIGHT}`,
                  padding: 14,
                  cursor: 'pointer',
                }}
              >
                <SectionIcon id={section.id} />
                <div
                  style={{
                    color: TEXT_1,
                    fontSize: 13.5,
                    fontWeight: 600,
                    marginTop: 8,
                  }}
                >
                  {section.name}
                </div>
                <div
                  style={{
                    color: section.metricColor,
                    fontSize: 12,
                    fontWeight: 500,
                    marginTop: 2,
                  }}
                >
                  {section.metric}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section content */}
      {activeSection === 'pipeline' ? (
        <>
          <Pills
            items={sectorConfig.stages}
            active={activePill}
            onSelect={setActivePill}
          />

          <div style={{ padding: '0 20px 20px' }}>
            {filteredUnits.map((unit, i) => {
              const sc = STATUS_COLORS[unit.status] ?? STATUS_COLORS.green;
              return (
                <div
                  key={unit.unit}
                  className={`da-press da-anim-in da-s${Math.min(i + 1, 7)}`}
                  onClick={() => setSelectedUnit(unit)}
                  style={{
                    background: '#fff',
                    borderRadius: 14,
                    border: `1px solid ${BORDER_LIGHT}`,
                    padding: 14,
                    marginBottom: 10,
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ color: TEXT_1, fontSize: 14, fontWeight: 700 }}>
                      {unit.unit}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: sc.color,
                        background: sc.bg,
                        padding: '2px 8px',
                        borderRadius: 6,
                      }}
                    >
                      {unit.days}d
                    </span>
                  </div>
                  <div style={{ color: TEXT_2, fontSize: 13, marginTop: 4 }}>
                    {unit.name}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <Badge text={unit.stage} color={unit.stageColor} />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div style={{ padding: '0 20px 20px' }}>
          {sectorConfig.sections
            .filter(s => s.id === activeSection)
            .map(s => (
              <div
                key={s.id}
                style={{
                  background: '#fff',
                  borderRadius: 14,
                  border: `1px solid ${BORDER_LIGHT}`,
                  padding: 20,
                }}
              >
                <div style={{ color: TEXT_1, fontSize: 15, fontWeight: 700 }}>
                  {s.name}
                </div>
                <div style={{ color: TEXT_2, fontSize: 13, marginTop: 4 }}>
                  {s.metric}
                </div>
              </div>
            ))}
        </div>
      )}

      <ContactSheet unit={selectedUnit} onClose={() => setSelectedUnit(null)} />
    </MobileShell>
  );
}
