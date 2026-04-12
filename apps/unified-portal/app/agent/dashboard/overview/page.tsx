'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarPlus,
  Mail,
  FileDown,
  BarChart3,
  AlertTriangle,
  ArrowRight,
  Clock,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { useAgentDashboard } from '../layout-provider';

export const dynamic = 'force-dynamic';

interface PipelineItem {
  id: string;
  unitId: string;
  unitNumber: string;
  developmentId: string;
  developmentName: string;
  status: string;
  purchaserName: string;
  dates: {
    saleAgreed?: string;
    deposit?: string;
    contractsIssued?: string;
    contractsSigned?: string;
    counterSigned?: string;
    drawdown?: string;
    handover?: string;
    estimatedClose?: string;
  };
  prices: { sale?: number };
}

interface ViewingItem {
  id: string;
  buyer_name: string;
  scheduled_at: string;
  status: string;
  development_name?: string;
  unit_number?: string;
}

interface ActivityItem {
  id: string;
  type: string;
  subject: string;
  recipient_name: string;
  created_at: string;
  development_name?: string;
}

export default function AgentDashboardOverview() {
  const router = useRouter();
  const { profile, developments, selectedSchemeId } = useAgentDashboard();
  const [pipeline, setPipeline] = useState<PipelineItem[]>([]);
  const [viewings, setViewings] = useState<ViewingItem[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/agent/pipeline-data');
        if (!res.ok) return;
        const data = await res.json();
        setPipeline(data.pipeline ?? []);
      } catch { /* silent */ }

      // Fetch today's viewings
      try {
        const today = new Date();
        const from = today.toISOString().split('T')[0];
        const to = from;
        const res = await fetch(`/api/agent/viewings?from=${from}&to=${to}`);
        if (res.ok) {
          const data = await res.json();
          setViewings(data.viewings ?? []);
        }
      } catch { /* silent */ }

      setLoading(false);
    }
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    if (!selectedSchemeId) return pipeline;
    return pipeline.filter(p => p.developmentId === selectedSchemeId);
  }, [pipeline, selectedSchemeId]);

  const stats = useMemo(() => {
    const sold = filtered.filter(p => ['sold', 'complete'].includes(p.status));
    const active = filtered.filter(p => ['agreed', 'sale_agreed', 'in_progress', 'signed', 'contracts_issued', 'contracts_signed'].includes(p.status));
    const overdue = filtered.filter(p =>
      p.dates?.contractsIssued && !p.dates?.contractsSigned &&
      new Date(p.dates.contractsIssued) < new Date(Date.now() - 21 * 86400000)
    );
    const revenueSold = sold.reduce((sum, p) => sum + (p.prices?.sale || 0), 0);
    const pipelineValue = active.reduce((sum, p) => sum + (p.prices?.sale || 0), 0);
    return { sold: sold.length, active: active.length, overdue, overdueCount: overdue.length, revenueSold, pipelineValue };
  }, [filtered]);

  const schemeStats = useMemo(() => {
    const map: Record<string, { id: string; name: string; total: number; sold: number; active: number; overdue: number }> = {};
    for (const p of pipeline) {
      if (!map[p.developmentId]) {
        map[p.developmentId] = { id: p.developmentId, name: p.developmentName, total: 0, sold: 0, active: 0, overdue: 0 };
      }
      const s = map[p.developmentId];
      s.total++;
      if (['sold', 'complete'].includes(p.status)) s.sold++;
      if (['agreed', 'sale_agreed', 'in_progress', 'signed', 'contracts_issued', 'contracts_signed'].includes(p.status)) s.active++;
      if (p.dates?.contractsIssued && !p.dates?.contractsSigned && new Date(p.dates.contractsIssued) < new Date(Date.now() - 21 * 86400000)) s.overdue++;
    }
    return Object.values(map);
  }, [pipeline]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = profile.display_name?.split(' ')[0] || 'there';

  const formatCurrency = (v: number) => {
    if (v >= 1000000) return `\u20AC${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `\u20AC${(v / 1000).toFixed(0)}K`;
    return `\u20AC${v}`;
  };

  if (loading) {
    return (
      <div style={{ padding: '32px 32px' }}>
        <div style={{ height: 28, width: 200, background: 'rgba(0,0,0,0.06)', borderRadius: 6, marginBottom: 8 }} />
        <div style={{ height: 20, width: 300, background: 'rgba(0,0,0,0.04)', borderRadius: 6, marginBottom: 32 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
          {[1,2,3,4,5].map(i => (
            <div key={i} style={{ height: 100, background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.07)' }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Quick Actions Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 32px',
        background: '#fff',
        borderBottom: '1px solid rgba(0,0,0,0.07)',
      }}>
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.08em',
          color: 'rgba(0,0,0,0.35)',
          textTransform: 'uppercase' as const,
          marginRight: 8,
        }}>
          QUICK ACTIONS
        </span>
        <button
          onClick={() => router.push('/agent/dashboard/viewings')}
          style={{
            height: 30, padding: '0 14px', background: '#c8960a', border: 'none',
            borderRadius: 7, color: '#fff', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5,
          }}
        >
          <CalendarPlus size={13} /> + New Viewing
        </button>
        <button
          onClick={() => router.push('/agent/dashboard/communications')}
          style={{
            height: 30, padding: '0 12px', background: '#fff',
            border: '1px solid rgba(0,0,0,0.12)', borderRadius: 7,
            color: '#374151', fontSize: 12, fontWeight: 500,
            cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5,
          }}
        >
          <Mail size={13} /> Draft Email
        </button>
        <button
          onClick={() => router.push('/agent/dashboard/analytics')}
          style={{
            height: 30, padding: '0 12px', background: '#fff',
            border: '1px solid rgba(0,0,0,0.12)', borderRadius: 7,
            color: '#374151', fontSize: 12, fontWeight: 500,
            cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5,
          }}
        >
          <BarChart3 size={13} /> View Analytics
        </button>
      </div>

      <div style={{ padding: '28px 32px' }}>
        {/* Greeting + LIVE status */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{
            color: '#111', fontSize: 20, fontWeight: 700,
            letterSpacing: '-0.04em', margin: '0 0 4px',
          }}>
            {greeting}, {firstName}.
          </h1>
          <p style={{ color: 'rgba(0,0,0,0.45)', fontSize: 13.5, margin: '0 0 12px' }}>
            Here&apos;s what&apos;s happening across your schemes today.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 11.5, fontWeight: 600, color: '#15803d',
              background: '#f0fdf4', padding: '4px 10px', borderRadius: 20,
              border: '1px solid rgba(21,128,61,0.2)',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: 3, background: '#15803d' }} />
              LIVE
            </span>
            <span style={{ fontSize: 12.5, color: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Users size={13} color="rgba(0,0,0,0.35)" /> {stats.active} active buyers
            </span>
            <span style={{ fontSize: 12.5, color: stats.overdueCount > 0 ? '#b91c1c' : 'rgba(0,0,0,0.5)', fontWeight: stats.overdueCount > 0 ? 600 : 400, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={13} color={stats.overdueCount > 0 ? '#b91c1c' : 'rgba(0,0,0,0.35)'} /> {stats.overdueCount} overdue contracts
            </span>
            <span style={{ fontSize: 12.5, color: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <CalendarPlus size={13} color="rgba(0,0,0,0.35)" /> {viewings.length} viewings today
            </span>
          </div>
        </div>

        {/* Needs Attention */}
        {stats.overdueCount > 0 && (
          <div style={{
            background: '#fffbeb',
            border: '1px solid rgba(146,64,14,0.2)',
            borderRadius: 12,
            padding: '14px 18px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertTriangle size={18} color="#92400e" />
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#92400e', margin: 0 }}>
                  Needs Attention
                </p>
                <p style={{ fontSize: 12, color: '#92400e', margin: '2px 0 0', opacity: 0.8 }}>
                  {stats.overdueCount} contracts past 21 days without signed copies returned
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push(`/agent/dashboard/intelligence?prompt=${encodeURIComponent('Draft chasing emails for all overdue contracts. Contracts are past 21 days outstanding. Tone: firm but professional. Include all purchaser names and unit numbers.')}`)}
              style={{
                height: 30, padding: '0 14px',
                background: 'linear-gradient(135deg, #B8960C, #E8C84A)',
                border: 'none', borderRadius: 7, color: '#fff',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit', whiteSpace: 'nowrap',
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              <Zap size={13} /> Chase all with Intelligence
            </button>
          </div>
        )}

        {/* KPI Row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 14,
          marginBottom: 24,
        }}>
          {[
            { label: 'TOTAL UNITS', value: filtered.length.toString(), color: '#111' },
            { label: 'ACTIVE', value: stats.active.toString(), color: '#1d4ed8' },
            { label: 'OVERDUE', value: stats.overdueCount.toString(), color: stats.overdueCount > 0 ? '#b91c1c' : '#15803d' },
            { label: 'REVENUE SOLD', value: formatCurrency(stats.revenueSold), color: '#15803d' },
            { label: 'PIPELINE VALUE', value: formatCurrency(stats.pipelineValue), color: '#111' },
          ].map(kpi => (
            <div key={kpi.label} style={{
              background: '#fff',
              borderRadius: 12,
              border: '0.5px solid rgba(0,0,0,0.07)',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)',
              padding: '16px 18px',
            }}>
              <p style={{
                color: 'rgba(0,0,0,0.35)', fontSize: 9.5, fontWeight: 700,
                letterSpacing: '0.07em', textTransform: 'uppercase' as const,
                margin: '0 0 8px',
              }}>
                {kpi.label}
              </p>
              <p style={{
                color: kpi.color, fontSize: 26, fontWeight: 700,
                letterSpacing: '-0.04em', margin: 0, lineHeight: 1,
              }}>
                {kpi.value}
              </p>
            </div>
          ))}
        </div>

        {/* Main content: Schemes + Right panel */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20 }}>
          {/* Left: Schemes table */}
          <div style={{
            background: '#fff',
            borderRadius: 12,
            border: '0.5px solid rgba(0,0,0,0.07)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '14px 18px',
              borderBottom: '1px solid rgba(0,0,0,0.07)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <h2 style={{ color: '#111', fontSize: 13.5, fontWeight: 600, margin: 0, letterSpacing: '-0.02em' }}>
                Active Schemes
              </h2>
              <button
                onClick={() => router.push('/agent/dashboard/pipeline')}
                style={{
                  color: '#c8960a', fontSize: 12, fontWeight: 600,
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: 'inherit', letterSpacing: '-0.01em',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                View pipeline <ArrowRight size={12} />
              </button>
            </div>

            {/* Table header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '2fr 0.8fr 0.8fr 0.8fr 0.8fr 1.2fr',
              padding: '10px 18px',
              background: '#f9f8f5',
              borderBottom: '1px solid rgba(0,0,0,0.07)',
            }}>
              {['Scheme', 'Units', 'Sold', 'Active', 'Overdue', 'Progress'].map(h => (
                <span key={h} style={{
                  color: 'rgba(0,0,0,0.35)', fontSize: 9.5, fontWeight: 700,
                  letterSpacing: '0.07em', textTransform: 'uppercase' as const,
                }}>
                  {h}
                </span>
              ))}
            </div>

            {schemeStats.map((scheme, i) => {
              const pct = scheme.total > 0 ? Math.round(((scheme.sold) / scheme.total) * 100) : 0;
              return (
                <div
                  key={scheme.id}
                  onClick={() => router.push(`/agent/dashboard/pipeline?scheme=${scheme.id}`)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 0.8fr 0.8fr 0.8fr 0.8fr 1.2fr',
                    padding: '12px 18px',
                    borderBottom: i < schemeStats.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                    cursor: 'pointer',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#faf9f7'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <div>
                    <p style={{ color: '#111', fontSize: 13, fontWeight: 500, margin: 0, letterSpacing: '-0.01em' }}>
                      {scheme.name}
                    </p>
                  </div>
                  <span style={{ color: '#374151', fontSize: 13, fontWeight: 500, alignSelf: 'center' }}>
                    {scheme.total}
                  </span>
                  <span style={{ color: '#15803d', fontSize: 13, fontWeight: 600, alignSelf: 'center' }}>
                    {scheme.sold}
                  </span>
                  <span style={{ color: '#1d4ed8', fontSize: 13, fontWeight: 600, alignSelf: 'center' }}>
                    {scheme.active}
                  </span>
                  <span style={{
                    color: scheme.overdue > 0 ? '#b91c1c' : 'rgba(0,0,0,0.25)',
                    fontSize: 13, fontWeight: scheme.overdue > 0 ? 600 : 400, alignSelf: 'center',
                  }}>
                    {scheme.overdue > 0 ? scheme.overdue : '\u2014'}
                  </span>
                  <div style={{ alignSelf: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        flex: 1, height: 4, background: '#e5e7eb',
                        borderRadius: 2, overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%', width: `${pct}%`,
                          background: 'linear-gradient(135deg, #B8960C, #E8C84A)',
                          borderRadius: 2,
                        }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(0,0,0,0.4)', minWidth: 30, textAlign: 'right' }}>
                        {pct}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {schemeStats.length === 0 && (
              <div style={{ padding: '24px 18px', textAlign: 'center' }}>
                <p style={{ color: 'rgba(0,0,0,0.35)', fontSize: 13 }}>No schemes assigned</p>
              </div>
            )}
          </div>

          {/* Right panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Recent Activity */}
            <div style={{
              background: '#fff',
              borderRadius: 12,
              border: '0.5px solid rgba(0,0,0,0.07)',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)',
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '14px 18px',
                borderBottom: '1px solid rgba(0,0,0,0.07)',
              }}>
                <h2 style={{ color: '#111', fontSize: 13.5, fontWeight: 600, margin: 0, letterSpacing: '-0.02em' }}>
                  Recent Activity
                </h2>
              </div>
              <div style={{ padding: '8px 0', maxHeight: 280, overflowY: 'auto' }}>
                {stats.overdue.slice(0, 5).map((item, i) => (
                  <div key={item.id} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '8px 18px',
                    borderBottom: i < 4 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 7,
                      background: '#fef2f2',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, marginTop: 1,
                    }}>
                      <AlertTriangle size={13} color="#b91c1c" />
                    </div>
                    <div>
                      <p style={{ fontSize: 12.5, fontWeight: 500, color: '#111', margin: 0 }}>
                        Contract overdue \u2014 {item.purchaserName || item.unitNumber}
                      </p>
                      <p style={{ fontSize: 11, color: 'rgba(0,0,0,0.38)', margin: '2px 0 0' }}>
                        {item.developmentName} \u00B7 {item.unitNumber}
                      </p>
                    </div>
                  </div>
                ))}
                {pipeline.filter(p => ['agreed', 'sale_agreed'].includes(p.status)).slice(0, 5).map((item, i) => (
                  <div key={`active-${item.id}`} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '8px 18px',
                    borderBottom: '1px solid rgba(0,0,0,0.04)',
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 7,
                      background: '#eff6ff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, marginTop: 1,
                    }}>
                      <TrendingUp size={13} color="#1d4ed8" />
                    </div>
                    <div>
                      <p style={{ fontSize: 12.5, fontWeight: 500, color: '#111', margin: 0 }}>
                        Sale agreed \u2014 {item.purchaserName || item.unitNumber}
                      </p>
                      <p style={{ fontSize: 11, color: 'rgba(0,0,0,0.38)', margin: '2px 0 0' }}>
                        {item.developmentName} \u00B7 {item.unitNumber}
                      </p>
                    </div>
                  </div>
                ))}
                {pipeline.length === 0 && (
                  <div style={{ padding: '16px 18px', textAlign: 'center' }}>
                    <p style={{ color: 'rgba(0,0,0,0.35)', fontSize: 12 }}>No recent activity</p>
                  </div>
                )}
              </div>
            </div>

            {/* Today's Viewings */}
            <div style={{
              background: '#fff',
              borderRadius: 12,
              border: '0.5px solid rgba(0,0,0,0.07)',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)',
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '14px 18px',
                borderBottom: '1px solid rgba(0,0,0,0.07)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <h2 style={{ color: '#111', fontSize: 13.5, fontWeight: 600, margin: 0, letterSpacing: '-0.02em' }}>
                  Today&apos;s Viewings
                </h2>
                <span style={{
                  fontSize: 11, fontWeight: 600, color: '#1d4ed8',
                  background: '#eff6ff', padding: '3px 8px', borderRadius: 10,
                }}>
                  {viewings.length}
                </span>
              </div>
              <div style={{ padding: '4px 0' }}>
                {viewings.length === 0 ? (
                  <div style={{ padding: '20px 18px', textAlign: 'center' }}>
                    <p style={{ color: 'rgba(0,0,0,0.35)', fontSize: 12, margin: 0 }}>No viewings scheduled today</p>
                  </div>
                ) : (
                  viewings.map((v, i) => {
                    const time = new Date(v.scheduled_at).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' });
                    return (
                      <div key={v.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 18px',
                        borderBottom: i < viewings.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                      }}>
                        <span style={{
                          fontSize: 12, fontWeight: 600, color: '#c8960a',
                          background: 'rgba(200,150,10,0.1)',
                          padding: '4px 8px', borderRadius: 6,
                          fontVariantNumeric: 'tabular-nums',
                        }}>
                          {time}
                        </span>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 500, color: '#111', margin: 0 }}>
                            {v.buyer_name}
                          </p>
                          <p style={{ fontSize: 11, color: 'rgba(0,0,0,0.38)', margin: '1px 0 0' }}>
                            {v.development_name}{v.unit_number ? ` \u00B7 ${v.unit_number}` : ''}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
