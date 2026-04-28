'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AgentShell from '../../_components/AgentShell';

type ComingUpEvent = {
  id: string;
  type: 'lease_renewal' | 'ber_expiry';
  propertyId: string;
  propertyAddress: string;
  eventDate: string;
  daysUntil: number;
  label: string;
  contextLine: string;
  urgency: 'urgent' | 'soon' | 'upcoming';
};

type Dashboard = {
  agent: { firstName: string; displayName: string };
  stats: {
    totalProperties: number;
    tenantedCount: number;
    vacantCount: number;
    monthlyRentRoll: number;
    avgCompleteness: number;
  };
  upcomingCounts: {
    leaseRenewalsNext30Days: number;
    leaseRenewalsNext90Days: number;
    berExpiriesNext90Days: number;
  };
  comingUp: ComingUpEvent[];
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });
};

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

export default function LettingsHomePage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/lettings/home-dashboard')
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || `Fetch failed (${res.status})`);
        return json as Dashboard;
      })
      .then((json) => { if (!cancelled) { setData(json); setLoading(false); } })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Network error');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Empty state survives — same content as the Hotfix v2 version.
  if (!loading && !error && data && data.stats.totalProperties === 0) {
    return <EmptyState />;
  }

  const s = data?.stats;
  const completenessHint =
    !s ? '' : s.avgCompleteness >= 90 ? 'Records are complete'
    : s.avgCompleteness >= 70 ? 'A few records need attention'
    : 'Several records are incomplete';

  return (
    <AgentShell>
      <div style={{ minHeight: '100%', background: '#FAFAF8', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", paddingBottom: 80 }}>
        {error && (
          <div role="alert" className="mx-4 mt-4 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{error}</div>
        )}

        <div style={{ padding: '32px 24px 16px' }}>
          {loading ? (
            <>
              <div className="h-8 w-2/3 bg-gray-100 rounded animate-pulse mb-2" />
              <div className="h-4 w-1/2 bg-gray-100 rounded animate-pulse" />
            </>
          ) : (
            <>
              <h1 style={{ color: '#0D0D12', fontSize: 24, fontWeight: 600, letterSpacing: '-0.01em', margin: '0 0 6px' }}>
                {greeting()}, {data?.agent.firstName}.
              </h1>
              {s && (
                <p style={{ color: '#6B7280', fontSize: 14, margin: 0 }}>
                  {s.totalProperties} {s.totalProperties === 1 ? 'property' : 'properties'} · €{s.monthlyRentRoll.toLocaleString()}/month rent roll
                </p>
              )}
            </>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 16px' }}>
          {loading || !s ? (
            <>
              {[0, 1, 2].map((i) => (
                <div key={i} className="bg-white border border-[#E5E7EB] rounded-xl p-4 h-[88px] animate-pulse" />
              ))}
            </>
          ) : (
            <>
              <Tile
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C49B2A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>}
                label="MONTHLY RENT ROLL"
                value={`€${s.monthlyRentRoll.toLocaleString()}`}
                subtext={`${s.tenantedCount} of ${s.totalProperties} tenanted`}
              />
              <Tile
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C49B2A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" /><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" /><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" /><path d="M10 6h4" /><path d="M10 10h4" /><path d="M10 14h4" /></svg>}
                label="PORTFOLIO"
                value={`${s.totalProperties} ${s.totalProperties === 1 ? 'property' : 'properties'}`}
                subtext={s.vacantCount === 0 ? 'All let' : `${s.vacantCount} ${s.vacantCount === 1 ? 'vacancy' : 'vacancies'}`}
              />
              <Tile
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C49B2A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></svg>}
                label="COMPLETENESS"
                value={`${s.avgCompleteness}%`}
                subtext={completenessHint}
              />
            </>
          )}
        </div>

        {/* Coming up feed */}
        <div style={{ marginTop: 32, padding: '0 16px' }}>
          <h2 style={{ margin: '0 0 12px', color: '#9EA8B5', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Coming up
          </h2>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} className="bg-white border border-[#E5E7EB] rounded-xl p-3 h-[60px] animate-pulse" />
              ))}
            </div>
          ) : !data || data.comingUp.length === 0 ? (
            <div style={{ background: '#fff', border: '1px dashed #E5E7EB', borderRadius: 12, padding: 24, textAlign: 'center', color: '#A0A8B0', fontSize: 14 }}>
              Nothing coming up in the next 90 days
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.comingUp.map((ev) => {
                const isUrgent = ev.urgency === 'urgent';
                const pillStyle =
                  ev.urgency === 'urgent' ? { background: 'rgba(239,68,68,0.10)', color: '#B91C1C' }
                  : ev.urgency === 'soon' ? { background: 'rgba(245,158,11,0.12)', color: '#A16207' }
                  : { background: '#F3F4F6', color: '#6B7280' };
                return (
                  <Link key={ev.id} href={`/agent/lettings/properties/${ev.propertyId}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 12, padding: 12 }}>
                    <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isUrgent ? 'rgba(212,175,55,0.10)' : '#F3F4F6', border: isUrgent ? '0.5px solid rgba(212,175,55,0.22)' : '0.5px solid #E5E7EB' }}>
                      {ev.type === 'lease_renewal' ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isUrgent ? '#C49B2A' : '#6B7280'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><circle cx="18" cy="18" r="4" /><polyline points="18 16.5 18 18 19.5 19" />
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isUrgent ? '#C49B2A' : '#6B7280'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="8" r="6" /><polyline points="8.21 13.89 7 22 12 19 17 22 15.79 13.88" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="truncate" style={{ fontSize: 14, fontWeight: 600, color: '#0D0D12' }}>
                        {ev.label}: {ev.propertyAddress}
                      </div>
                      <div className="truncate" style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                        {ev.contextLine}
                      </div>
                    </div>
                    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <span style={{ ...pillStyle, padding: '2px 8px', fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', borderRadius: 999 }}>
                        {ev.daysUntil <= 0 ? 'Today' : `${ev.daysUntil}d`}
                      </span>
                      <span style={{ fontSize: 11, color: '#A0A8B0' }}>{formatDate(ev.eventDate)}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AgentShell>
  );
}

function Tile({ icon, label, value, subtext }: { icon: React.ReactNode; label: string; value: string; subtext: string }) {
  return (
    <div style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 18, background: 'rgba(212,175,55,0.10)', border: '0.5px solid rgba(212,175,55,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: '#9EA8B5', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#0D0D12', letterSpacing: '-0.01em', lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>{subtext}</div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <AgentShell>
      <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 32px 80px', textAlign: 'center', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
        <div style={{ width: 64, height: 64, borderRadius: 18, background: 'rgba(212,175,55,0.10)', border: '0.5px solid rgba(212,175,55,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C49B2A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="m21 2-9.6 9.6" />
            <circle cx="7.5" cy="15.5" r="5.5" />
            <path d="m21 2-2 2" />
            <path d="m18 5 3 3" />
            <path d="m15 8 3 3" />
          </svg>
        </div>
        <h1 style={{ color: '#0D0D12', fontSize: 24, fontWeight: 600, letterSpacing: '-0.01em', margin: '0 0 8px' }}>No properties yet</h1>
        <p style={{ color: '#6B7280', fontSize: 15, lineHeight: 1.5, margin: '0 0 28px', maxWidth: 280 }}>
          Add your first property to get started. We&rsquo;ll fill in most of it for you.
        </p>
        <Link href="/agent/lettings/properties/new" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 22px', borderRadius: 12, background: 'linear-gradient(135deg, #D4AF37, #C49B2A)', color: '#0D0D12', fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em', textDecoration: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 6px 18px rgba(196,155,42,0.32)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0D0D12" strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add a property
        </Link>
        <Link href="/agent/lettings/properties/import" style={{ marginTop: 14, color: '#A0A8B0', fontSize: 13, textDecoration: 'none' }}>
          Or import from a spreadsheet
        </Link>
      </div>
    </AgentShell>
  );
}
