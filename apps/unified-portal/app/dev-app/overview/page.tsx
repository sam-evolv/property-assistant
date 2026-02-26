'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  GOLD, GOLD_LIGHT, TEXT_1, TEXT_2, TEXT_3, SURFACE_1, SURFACE_2, BORDER, BORDER_LIGHT,
  RED, RED_BG, AMBER, AMBER_BG, GREEN, GREEN_BG, BLUE, BLUE_BG, EASE_PREMIUM,
  SECTORS, DEV_DATA, type Sector, type SectorConfig,
} from '@/lib/dev-app/design-system';
import AnimCounter from '@/components/dev-app/shared/AnimCounter';
import ProgressRing from '@/components/dev-app/shared/ProgressRing';
import ShimmerOverlay from '@/components/dev-app/shared/ShimmerEffect';
import BreathingDot from '@/components/dev-app/shared/BreathingDot';
import Badge from '@/components/dev-app/shared/Badge';
import LiveBar from '@/components/dev-app/shared/LiveBar';
import SectorSwitch from '@/components/dev-app/shared/SectorSwitch';
import { ChevronIcon } from '@/components/dev-app/shared/Icons';
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
  const [displayName, setDisplayName] = useState('');
  const [apiStats, setApiStats] = useState<any>(null);
  const [apiDevs, setApiDevs] = useState<any[]>([]);
  const [apiAttention, setApiAttention] = useState<any[]>([]);

  // Fetch real data from APIs
  useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, devsRes, attentionRes] = await Promise.all([
          fetch('/api/dev-app/overview/stats'),
          fetch('/api/dev-app/developments'),
          fetch('/api/dev-app/overview/attention'),
        ]);

        if (statsRes.ok) {
          const data = await statsRes.json();
          setApiStats(data);
          if (data.display_name) setDisplayName(data.display_name);
        }
        if (devsRes.ok) {
          const data = await devsRes.json();
          if (data.developments?.length > 0) setApiDevs(data.developments);
        }
        if (attentionRes.ok) {
          const data = await attentionRes.json();
          if (data.items?.length > 0) setApiAttention(data.items);
        }
      } catch {
        // Fallback to hardcoded data silently
      }
    }
    fetchData();
  }, []);

  const sectorConfig = SECTORS[sector];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // Use API developments if available, otherwise fallback to hardcoded
  const developments = apiDevs.length > 0
    ? apiDevs
        .filter(d => !sector || d.sector === sector || apiDevs.length <= 3)
        .map(d => ({
          name: d.name,
          loc: d.location,
          units: d.total_units,
          pct: d.progress,
          sold: d.sold_units,
          active: d.total_units - d.sold_units,
          handed: 0,
          id: d.id,
          is_most_active: d.is_most_active,
        }))
    : DEV_DATA[sector];

  // Use API attention items if available, otherwise fallback
  const attentionItems = apiAttention.length > 0
    ? apiAttention.map(item => ({
        color: item.severity === 'red' ? RED : item.severity === 'amber' ? AMBER : BLUE,
        text: item.title,
        dev: item.development_name || '',
        action: 'View',
      }))
    : sectorConfig.attentionItems;

  // Use API stats if available
  const stats = apiStats ? [
    { label: 'Pipeline Value', value: apiStats.pipeline_value > 1000000 ? +(apiStats.pipeline_value / 1000000).toFixed(1) : apiStats.pipeline_value, prefix: apiStats.pipeline_value > 1000000 ? '€' : '€', suffix: apiStats.pipeline_value > 1000000 ? 'M' : '', sub: '↑ active pipeline', color: GOLD },
    { label: 'Units Sold', value: apiStats.units_sold, prefix: '', suffix: '', sub: `of ${apiStats.total_units || 0} total`, color: GREEN },
    { label: 'Compliance', value: apiStats.compliance_pct, prefix: '', suffix: '%', sub: 'documents verified', color: apiStats.compliance_pct >= 80 ? GREEN : AMBER },
    { label: 'Handover Ready', value: apiStats.handover_ready, prefix: '', suffix: '', sub: 'units fully cleared', color: GREEN },
  ] : sectorConfig.stats;

  return (
    <MobileShell>
      <Header title="Overview" onNotificationTap={() => router.push('/dev-app/activity')} />

      {/* Greeting */}
      <div style={{ padding: '16px 20px' }}>
        <div className="da-anim-in" style={{ fontSize: 15, color: TEXT_2 }}>
          {greeting},
        </div>
        <div
          className="da-anim-in da-s1"
          style={{ fontSize: 26, fontWeight: 800, color: TEXT_1, letterSpacing: '-0.03em' }}
        >
          {displayName || 'Sam'}
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
          className="da-anim-in"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <span style={{ fontSize: 17, fontWeight: 700, color: TEXT_1 }}>Your Developments</span>
          <span
            className="da-press"
            style={{ fontSize: 13, fontWeight: 600, color: GOLD, cursor: 'pointer' }}
            onClick={() => router.push('/dev-app/developments')}
          >
            View all
          </span>
        </div>

        <div
          className="hide-scrollbar"
          style={{
            display: 'flex',
            gap: 12,
            overflowX: 'auto',
            paddingBottom: 8,
          }}
        >
          {developments.map((dev: any, i: number) => {
            const isFirst = i === 0;
            return (
              <div
                key={dev.name}
                className={`da-press da-anim-in da-s${Math.min(i + 1, 7)}`}
                onClick={() => {
                  if (dev.id) router.push(`/dev-app/developments/${dev.id}`);
                }}
                style={{
                  width: 260,
                  minWidth: 260,
                  flexShrink: 0,
                  background: '#fff',
                  borderRadius: 16,
                  border: isFirst ? `1.5px solid ${GOLD}40` : `1px solid ${BORDER_LIGHT}`,
                  boxShadow: isFirst ? `0 2px 12px rgba(212,175,55,0.08)` : '0 1px 3px rgba(0,0,0,0.04)',
                  padding: 16,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {isFirst && <ShimmerOverlay />}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: TEXT_1 }}>{dev.name}</div>
                    <div style={{ fontSize: 12, color: TEXT_3, marginTop: 2 }}>{dev.loc}</div>
                  </div>
                  <ProgressRing percent={dev.pct} size={44} delay={300 + i * 200} />
                </div>

                {/* Stats row */}
                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 11, color: TEXT_3 }}>Sold</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: TEXT_1 }}>
                      <AnimCounter value={dev.sold} delay={400 + i * 100} />
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: TEXT_3 }}>Total</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: TEXT_1 }}>
                      {dev.units}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: TEXT_3 }}>Progress</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: GOLD }}>{dev.pct}%</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Needs Attention */}
      <div style={{ padding: '24px 20px 0' }}>
        <div
          className="da-anim-in"
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

        {attentionItems.map((item: any, i: number) => (
          <div
            key={i}
            className={`da-press da-anim-in da-s${Math.min(i + 1, 7)}`}
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
            {/* Breathing dot for red items, normal dot for others */}
            <div style={{ flexShrink: 0 }}>
              {item.color === RED ? (
                <BreathingDot color={RED} size={8} />
              ) : (
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: item.color,
                  }}
                />
              )}
            </div>

            {/* Text column */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: TEXT_1 }}>{item.text}</div>
              <div style={{ fontSize: 12, color: TEXT_3 }}>{item.dev}</div>
            </div>

            {/* Action button */}
            <div
              className="da-press"
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
          className="da-anim-in"
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
          {stats.map((stat: any, i: number) => {
            const isCompliance = stat.suffix === '%';
            return (
              <div
                key={stat.label}
                className={`da-anim-in da-s${Math.min(i + 1, 7)}`}
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
                    <ProgressRing percent={stat.value} size={48} color={stat.color} delay={400 + i * 150} />
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
                      delay={300 + i * 100}
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
          className="da-anim-in"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <span style={{ fontSize: 17, fontWeight: 700, color: TEXT_1 }}>Recent Activity</span>
          <span
            className="da-press"
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
            <div style={{ flexShrink: 0 }}>
              {item.color === RED ? (
                <BreathingDot color={RED} size={8} />
              ) : (
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: item.color,
                  }}
                />
              )}
            </div>

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
