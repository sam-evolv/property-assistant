'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  GOLD, TEXT_1, TEXT_2, TEXT_3, SURFACE_1, SURFACE_2, BORDER_LIGHT,
  RED, AMBER, GREEN, BLUE, EASE_PREMIUM,
} from '@/lib/dev-app/design-system';
import AnimCounter from '@/components/dev-app/shared/AnimCounter';
import ProgressRing from '@/components/dev-app/shared/ProgressRing';
import ShimmerOverlay from '@/components/dev-app/shared/ShimmerEffect';
import Badge from '@/components/dev-app/shared/Badge';
import LiveBar from '@/components/dev-app/shared/LiveBar';
import { ChevronIcon } from '@/components/dev-app/shared/Icons';
import MobileShell from '@/components/dev-app/layout/MobileShell';
import Header from '@/components/dev-app/layout/Header';

interface Development {
  id: string;
  name: string;
  location: string;
  sector: string;
  total_units: number;
  sold_units: number;
  progress: number;
}

interface AttentionItem {
  id: string;
  type: string;
  severity: string;
  title: string;
  development_name?: string;
}

interface Stats {
  pipeline_value: number;
  units_sold: number;
  compliance_pct: number;
  handover_ready: number;
}

const SEVERITY_COLORS: Record<string, string> = {
  red: RED,
  amber: AMBER,
  gold: GOLD,
  blue: BLUE,
};

export default function OverviewPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [attention, setAttention] = useState<AttentionItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch user name from Supabase auth
    const supabase = createClientComponentClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      const name =
        user?.user_metadata?.full_name?.split(' ')[0] ||
        user?.user_metadata?.name?.split(' ')[0] ||
        user?.email?.split('@')[0] ||
        'there';
      setFirstName(name);
    });

    // Fetch all data in parallel
    Promise.all([
      fetch('/api/dev-app/developments').then(r => r.json()).catch(() => ({ developments: [] })),
      fetch('/api/dev-app/overview/stats').then(r => r.json()).catch(() => null),
      fetch('/api/dev-app/overview/attention').then(r => r.json()).catch(() => ({ items: [] })),
    ]).then(([devData, statsData, attentionData]) => {
      setDevelopments(devData.developments || []);
      setStats(statsData);
      setAttention(attentionData.items || []);
      setLoading(false);
    });
  }, []);

  const greeting = getGreeting();

  // Stat cards from real data
  const statCards = stats ? [
    {
      label: 'Pipeline Value',
      value: stats.pipeline_value > 0 ? Math.round(stats.pipeline_value / 1_000_000 * 10) / 10 : 0,
      prefix: '\u20AC',
      suffix: 'M',
      sub: developments.length > 0 ? `across ${developments.length} developments` : 'no developments yet',
      color: GOLD,
    },
    {
      label: 'Units Sold',
      value: stats.units_sold,
      prefix: '',
      suffix: '',
      sub: `of ${developments.reduce((sum, d) => sum + d.total_units, 0)} total`,
      color: GREEN,
    },
    {
      label: 'Compliance',
      value: stats.compliance_pct,
      prefix: '',
      suffix: '%',
      sub: attention.filter(a => a.type === 'compliance_overdue').length > 0
        ? `${attention.filter(a => a.type === 'compliance_overdue').length} items overdue`
        : 'all clear',
      color: stats.compliance_pct >= 90 ? GREEN : AMBER,
    },
    {
      label: 'Handover Ready',
      value: stats.handover_ready,
      prefix: '',
      suffix: '',
      sub: 'units fully cleared',
      color: GREEN,
    },
  ] : [];

  return (
    <MobileShell>
      <Header title="Overview" onNotificationTap={() => router.push('/dev-app/activity')} />

      {/* Greeting */}
      <div style={{ padding: '16px 20px' }}>
        <div className="da-anim-in" style={{ fontSize: 15, color: TEXT_2 }}>
          {greeting},
        </div>
        <div
          className="da-anim-in"
          style={{ fontSize: 26, fontWeight: 800, color: TEXT_1, letterSpacing: '-0.03em' }}
        >
          {firstName || '\u00A0'}
        </div>
      </div>

      {/* Live Bar */}
      <div style={{ marginTop: 4 }}>
        <LiveBar />
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
          <span
            style={{ fontSize: 13, fontWeight: 600, color: GOLD, cursor: 'pointer' }}
            onClick={() => router.push('/dev-app/developments')}
          >
            View all
          </span>
        </div>

        {loading ? (
          <div style={{ display: 'flex', gap: 12 }}>
            {[1, 2].map(i => (
              <div
                key={i}
                style={{
                  width: 260,
                  minWidth: 260,
                  height: 140,
                  borderRadius: 16,
                  background: SURFACE_2,
                }}
                className="da-anim-fade"
              />
            ))}
          </div>
        ) : developments.length === 0 ? (
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              border: `1px solid ${BORDER_LIGHT}`,
              padding: 24,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>🏗️</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: TEXT_1 }}>No developments yet</div>
            <div style={{ fontSize: 13, color: TEXT_3, marginTop: 4 }}>
              Your developments will appear here once set up.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
            {developments.map((dev, i) => (
              <div
                key={dev.id}
                className={`da-press da-anim-in da-s${i + 1}`}
                onClick={() => router.push(`/dev-app/developments/${dev.id}`)}
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
                  cursor: 'pointer',
                }}
              >
                <ShimmerOverlay />

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: TEXT_1 }}>{dev.name}</div>
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
                <div style={{ fontSize: 12, color: TEXT_3, marginTop: 2 }}>{dev.location}</div>

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
                      width: `${dev.progress}%`,
                      transition: `width 1s ${EASE_PREMIUM}`,
                    }}
                  />
                </div>

                {/* Stats row */}
                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 11, color: TEXT_3 }}>Sold</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: TEXT_1 }}>{dev.sold_units}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: TEXT_3 }}>Total</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: TEXT_1 }}>{dev.total_units}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: TEXT_3 }}>Progress</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: TEXT_1 }}>{dev.progress}%</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
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
            {attention.length > 0 && <Badge text={String(attention.length)} color={AMBER} />}
          </div>
          <ChevronIcon />
        </div>

        {loading ? (
          <div>
            {[1, 2].map(i => (
              <div
                key={i}
                style={{
                  height: 60,
                  borderRadius: 14,
                  background: SURFACE_2,
                  marginBottom: 8,
                }}
                className="da-anim-fade"
              />
            ))}
          </div>
        ) : attention.length === 0 ? (
          <div
            style={{
              background: '#fff',
              borderRadius: 14,
              border: `1px solid ${BORDER_LIGHT}`,
              padding: 20,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 13, color: TEXT_3 }}>All clear — nothing needs attention right now.</div>
          </div>
        ) : (
          attention.map((item, i) => (
            <div
              key={item.id}
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
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: SEVERITY_COLORS[item.severity] || AMBER,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: TEXT_1 }}>{item.title}</div>
                {item.development_name && (
                  <div style={{ fontSize: 12, color: TEXT_3 }}>{item.development_name}</div>
                )}
              </div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: SEVERITY_COLORS[item.severity] || AMBER,
                  flexShrink: 0,
                  cursor: 'pointer',
                }}
              >
                View
              </div>
            </div>
          ))
        )}
      </div>

      {/* Today's Numbers */}
      {stats && (
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {statCards.map((stat, i) => {
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
      )}

      {/* Footer spacer */}
      <div style={{ height: 24 }} />
    </MobileShell>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
