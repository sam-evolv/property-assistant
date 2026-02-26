'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  GOLD, GOLD_LIGHT, TEXT_1, TEXT_2, TEXT_3, SURFACE_1, SURFACE_2, BORDER, BORDER_LIGHT,
  RED, RED_BG, AMBER, AMBER_BG, GREEN, GREEN_BG, BLUE, BLUE_BG, EASE_PREMIUM,
  SECTORS, DEV_DATA, type Sector, type SectorConfig,
} from '@/lib/dev-app/design-system';
import AnimCounter from '@/components/dev-app/shared/AnimCounter';
import ProgressRing from '@/components/dev-app/shared/ProgressRing';
import ShimmerOverlay from '@/components/dev-app/shared/ShimmerEffect';
import Badge from '@/components/dev-app/shared/Badge';
import LiveBar from '@/components/dev-app/shared/LiveBar';
import SectorSwitch from '@/components/dev-app/shared/SectorSwitch';
import { SectionIcon, ChevronIcon } from '@/components/dev-app/shared/Icons';
import MobileShell from '@/components/dev-app/layout/MobileShell';
import Header from '@/components/dev-app/layout/Header';

const RECENT_ACTIVITY = [
  { time: '2h ago', text: 'Unit 14 — loan docs uploaded', color: GREEN },
  { time: '4h ago', text: 'Mortgage warning — Unit 22 expiring', color: RED },
  { time: '6h ago', text: 'New enquiry from M. Kelly', color: BLUE },
];

export default function OverviewPage() {
  const router = useRouter();
  const [sector, setSector] = useState<Sector>('bts');

  const sectorConfig = SECTORS[sector];
  const developments = DEV_DATA[sector];
  const attentionItems = sectorConfig.attentionItems;
  const stats = sectorConfig.stats;

  return (
    <MobileShell>
      <Header title="Overview" onNotificationTap={() => router.push('/dev-app/activity')} />

      {/* Greeting */}
      <div style={{ padding: '16px 20px' }}>
        <div className="da-anim-in" style={{ fontSize: 15, color: TEXT_2 }}>
          Good morning,
        </div>
        <div
          className="da-anim-in"
          style={{ fontSize: 26, fontWeight: 800, color: TEXT_1, letterSpacing: '-0.03em' }}
        >
          Diarmuid
        </div>
      </div>

      {/* Sector Switch */}
      <SectorSwitch sector={sector} onSectorChange={setSector} />

      {/* Live Bar */}
      <div style={{ marginTop: 12 }}>
        <LiveBar sector={sector} />
      </div>

      {/* Your Developments */}
      <div style={{ padding: '24px 20px 0' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <span style={{ fontSize: 17, fontWeight: 700, color: TEXT_1 }}>Your Developments</span>
          <ChevronIcon />
        </div>

        <div
          style={{
            display: 'flex',
            gap: 12,
            overflowX: 'auto',
            paddingBottom: 8,
          }}
        >
          {developments.map((dev, i) => (
            <div
              key={dev.name}
              className={`da-press da-anim-in da-s${i + 1}`}
              style={{
                width: 260,
                minWidth: 260,
                flexShrink: 0,
                background: '#fff',
                borderRadius: 16,
                border: `1px solid ${BORDER_LIGHT}`,
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                padding: 16,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <ShimmerOverlay />

              <div style={{ fontSize: 15, fontWeight: 700, color: TEXT_1 }}>{dev.name}</div>
              <div style={{ fontSize: 12, color: TEXT_3, marginTop: 2 }}>{dev.loc}</div>

              {/* Progress bar */}
              <div
                style={{
                  marginTop: 12,
                  height: 6,
                  borderRadius: 3,
                  background: SURFACE_2,
                }}
              >
                <div
                  style={{
                    height: 6,
                    borderRadius: 3,
                    background: GOLD,
                    width: `${dev.pct}%`,
                    transition: `width 1s ${EASE_PREMIUM}`,
                  }}
                />
              </div>

              {/* Stats row */}
              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 11, color: TEXT_3 }}>Sold</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: TEXT_1 }}>{dev.sold}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: TEXT_3 }}>Active</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: TEXT_1 }}>{dev.active}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: TEXT_3 }}>Handed</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: TEXT_1 }}>{dev.handed}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Needs Attention */}
      <div style={{ padding: '24px 20px 0' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 17, fontWeight: 700, color: TEXT_1 }}>Needs Attention</span>
            <Badge text={String(attentionItems.length)} color={AMBER} />
          </div>
          <ChevronIcon />
        </div>

        {attentionItems.map((item, i) => (
          <div
            key={i}
            className={`da-press da-anim-in da-s${i + 1}`}
            style={{
              background: '#fff',
              borderRadius: 14,
              border: `1px solid ${BORDER_LIGHT}`,
              padding: 14,
              marginBottom: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            {/* Colored dot */}
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: item.color,
                flexShrink: 0,
              }}
            />

            {/* Text column */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: TEXT_1 }}>{item.text}</div>
              <div style={{ fontSize: 12, color: TEXT_3 }}>{item.dev}</div>
            </div>

            {/* Action button */}
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: item.color,
                flexShrink: 0,
                cursor: 'pointer',
              }}
            >
              {item.action}
            </div>
          </div>
        ))}
      </div>

      {/* Today's Numbers */}
      <div style={{ padding: '24px 20px 0' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <span style={{ fontSize: 17, fontWeight: 700, color: TEXT_1 }}>Today&apos;s Numbers</span>
          <ChevronIcon />
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 12,
          }}
        >
          {stats.map((stat, i) => {
            const isCompliance = stat.suffix === '%';
            return (
              <div
                key={stat.label}
                className={`da-anim-in da-s${i + 1}`}
                style={{
                  background: '#fff',
                  borderRadius: 14,
                  border: `1px solid ${BORDER_LIGHT}`,
                  padding: 16,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 500, color: TEXT_3 }}>{stat.label}</div>

                {isCompliance ? (
                  <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center' }}>
                    <ProgressRing percent={stat.value} size={44} color={stat.color} />
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 800,
                      color: stat.color,
                      marginTop: 4,
                    }}
                  >
                    <AnimCounter
                      value={stat.value}
                      prefix={stat.prefix}
                      suffix={stat.suffix}
                      decimals={stat.suffix === 'M' ? 1 : 0}
                    />
                  </div>
                )}

                <div style={{ fontSize: 11, color: TEXT_3, marginTop: 4 }}>{stat.sub}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <div style={{ padding: '24px 20px', marginBottom: 24 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <span style={{ fontSize: 17, fontWeight: 700, color: TEXT_1 }}>Recent Activity</span>
          <span
            style={{ fontSize: 13, fontWeight: 600, color: GOLD, cursor: 'pointer' }}
            onClick={() => router.push('/dev-app/activity')}
          >
            View all
          </span>
        </div>

        {RECENT_ACTIVITY.map((item, i) => (
          <div
            key={i}
            className={`da-anim-in da-s${i + 1}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 0',
            }}
          >
            {/* Colored dot */}
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: item.color,
                flexShrink: 0,
              }}
            />

            {/* Text column */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: TEXT_1 }}>{item.text}</div>
              <div style={{ fontSize: 11, color: TEXT_3 }}>{item.time}</div>
            </div>
          </div>
        ))}
      </div>
    </MobileShell>
  );
}
