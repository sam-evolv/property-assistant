'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import MobileShell from '@/components/dev-app/layout/MobileShell';
import { SectionIcon, BackIcon, ChevronIcon } from '@/components/dev-app/shared/Icons';
import Badge from '@/components/dev-app/shared/Badge';
import Pills from '@/components/dev-app/shared/Pills';
import ContactSheet from '@/components/dev-app/developments/ContactSheet';
import {
  GOLD, TEXT_1, TEXT_2, TEXT_3, SURFACE_2, BORDER_LIGHT,
  RED, RED_BG, AMBER, AMBER_BG, GREEN, GREEN_BG,
  SECTORS, DEV_DATA, type Sector, type SectorUnit,
} from '@/lib/dev-app/design-system';

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  green: { color: GREEN, bg: GREEN_BG },
  amber: { color: AMBER, bg: AMBER_BG },
  red: { color: RED, bg: RED_BG },
};

export default function DevelopmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const devId = params.devId as string;

  const [sector, setSector] = useState<Sector>('bts');
  const [activeSection, setActiveSection] = useState<string>(
    SECTORS['bts'].sections[0]?.id ?? 'pipeline',
  );
  const [selectedUnit, setSelectedUnit] = useState<SectorUnit | null>(null);
  const [activePill, setActivePill] = useState('All');

  const devName = decodeURIComponent(devId);
  const dev = DEV_DATA[sector].find((d) => d.name === devName) ?? DEV_DATA[sector][0];
  const sectorConfig = SECTORS[sector];

  const filteredUnits =
    activePill === 'All'
      ? sectorConfig.units
      : sectorConfig.units.filter((u) =>
          u.stage.toLowerCase().includes(activePill.toLowerCase()),
        );

  return (
    <MobileShell>
      {/* Custom header -- frosted glass, sticky */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 30,
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))',
          paddingBottom: 12,
          paddingLeft: 16,
          paddingRight: 16,
          borderBottom: `1px solid ${BORDER_LIGHT}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          {/* Back button */}
          <div
            onClick={() => router.back()}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: SURFACE_2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <BackIcon />
          </div>

          {/* Dev name */}
          <div
            style={{
              flex: 1,
              minWidth: 0,
              color: TEXT_1,
              fontSize: 17,
              fontWeight: 700,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {dev?.name ?? 'Development'}
          </div>

          {/* Sector badge */}
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: GOLD,
              background: `${GOLD}12`,
              padding: '3px 8px',
              borderRadius: 6,
              letterSpacing: '0.04em',
              flexShrink: 0,
            }}
          >
            {sectorConfig.short}
          </span>
        </div>
      </header>

      {/* Section cards grid */}
      <div style={{ padding: 20, marginTop: 16 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 10,
          }}
        >
          {sectorConfig.sections.map((section, i) => {
            const stagger =
              i === 0 ? '' : i === 1 ? ' da-delay-1' : i === 2 ? ' da-delay-2' : ' da-delay-3';
            const isActive = activeSection === section.id;

            return (
              <div
                key={section.id}
                className={`da-press da-anim-in${stagger}`}
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
          {/* Stage filter pills */}
          <Pills
            items={sectorConfig.stages}
            active={activePill}
            onSelect={setActivePill}
          />

          {/* Unit cards */}
          <div style={{ padding: '0 20px 20px' }}>
            {filteredUnits.map((unit, i) => {
              const stagger =
                i === 0 ? '' : i === 1 ? ' da-delay-1' : i === 2 ? ' da-delay-2' : ' da-delay-3';
              const sc = STATUS_COLORS[unit.status] ?? STATUS_COLORS.green;

              return (
                <div
                  key={unit.unit}
                  className={`da-press da-anim-in${stagger}`}
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
                  {/* Top row */}
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

                  {/* Person name */}
                  <div
                    style={{
                      color: TEXT_2,
                      fontSize: 13,
                      marginTop: 4,
                    }}
                  >
                    {unit.name}
                  </div>

                  {/* Stage pill */}
                  <div style={{ marginTop: 8 }}>
                    <Badge text={unit.stage} color={unit.stageColor} />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        /* Other sections -- placeholder */
        <div style={{ padding: '0 20px 20px' }}>
          {sectorConfig.sections
            .filter((s) => s.id === activeSection)
            .map((s) => (
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
                  Section: {s.name}
                </div>
                <div style={{ color: TEXT_2, fontSize: 13, marginTop: 4 }}>
                  {s.metric}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Contact sheet */}
      <ContactSheet unit={selectedUnit} onClose={() => setSelectedUnit(null)} />
    </MobileShell>
  );
}
