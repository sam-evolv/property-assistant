'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { AgentProfile } from '@/lib/agent/agentPipelineService';
import type { Listing, Enquiry, HomeStats, PriceReviewCandidate } from '@/lib/agent/independentAgentService';
import {
  getIndependentHomeStats,
  getPriceReviewCandidates,
  getRecentEnquiries,
  getListings,
} from '@/lib/agent/independentAgentService';
import DraftsHomeTile from './DraftsHomeTile';

interface IndependentHomeViewProps {
  agent: AgentProfile;
}

export default function IndependentHomeView({ agent }: IndependentHomeViewProps) {
  const [stats, setStats] = useState<HomeStats | null>(null);
  const [priceReviews, setPriceReviews] = useState<PriceReviewCandidate[]>([]);
  const [recentEnquiries, setRecentEnquiries] = useState<Enquiry[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [homeStats, reviews, enquiries, activeListings] = await Promise.all([
        getIndependentHomeStats(agent.id),
        getPriceReviewCandidates(agent.id),
        getRecentEnquiries(agent.id, 3),
        getListings(agent.id, 'active'),
      ]);
      setStats(homeStats);
      setPriceReviews(reviews);
      setRecentEnquiries(enquiries);
      setListings(activeListings);
      setLoading(false);
    }
    load();
  }, [agent.id]);

  if (loading) {
    return (
      <div style={{ padding: '2px 24px 100px' }}>
        <div style={{ height: 40, background: '#f3f4f6', borderRadius: 12, marginBottom: 20, animation: 'pulse 1.5s infinite' }} />
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: 80, background: '#f3f4f6', borderRadius: 16, marginBottom: 10, animation: 'pulse 1.5s infinite' }} />
        ))}
      </div>
    );
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning,' : hour < 18 ? 'Good afternoon,' : 'Good evening,';

  return (
    <div style={{ padding: '2px 24px 100px' }}>
      {/* Greeting */}
      <p style={{ color: '#A0A8B0', fontSize: 13, fontWeight: 400, marginBottom: 4, letterSpacing: '0.01em' }}>
        {greeting}
      </p>
      <h1 style={{ color: '#0D0D12', fontSize: 32, fontWeight: 700, letterSpacing: '-0.055em', lineHeight: 1.05, marginBottom: 4 }}>
        {agent.displayName?.split(' ')[0] || 'Agent'}.
      </h1>
      <p style={{ color: '#B0B8C4', fontSize: 13, letterSpacing: '0.01em', marginBottom: 28 }}>
        {agent.agencyName} &middot; Independent agent
      </p>

      {/* Stat rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        <Link href="/agent/pipeline" style={{ textDecoration: 'none' }}>
          <StatRow icon="home" label="Active listings" value={stats?.activeListings ?? 0} color="#10B981" />
        </Link>
        <Link href="/agent/enquiries" style={{ textDecoration: 'none' }}>
          <StatRow icon="mail" label="New enquiries" value={stats?.newEnquiries ?? 0} color="#3B82F6" urgent={(stats?.newEnquiries ?? 0) > 0} />
        </Link>
        <Link href="/agent/enquiries?filter=follow_up" style={{ textDecoration: 'none' }}>
          <StatRow icon="clock" label="Follow-ups due" value={stats?.followUpsDue ?? 0} color="#EF4444" urgent={(stats?.followUpsDue ?? 0) > 0} />
        </Link>
      </div>

      {/* Drafts tile — replaces the bottom-nav Drafts tab. */}
      <DraftsHomeTile />

      {/* Price review alerts */}
      {priceReviews.length > 0 && (
        <>
          <SectionLabel>Price review alerts</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
            {priceReviews.map(review => (
              <Link key={review.listingId} href={`/agent/intelligence?prompt=${encodeURIComponent(`Prepare a price review conversation guide for ${review.address}`)}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  padding: '14px 18px',
                  background: '#FFFBEB',
                  border: '1px solid rgba(217,119,6,.2)',
                  borderLeft: '3px solid #D97706',
                  borderRadius: 14,
                }}>
                  <p style={{ color: '#92400E', fontSize: 13, fontWeight: 600, margin: '0 0 2px' }}>
                    {review.address}
                  </p>
                  <p style={{ color: '#B45309', fontSize: 12, margin: '0 0 8px' }}>
                    {review.daysOnMarket} days on market &middot; {review.totalViewings} viewings &middot; no offers
                  </p>
                  <span style={{ color: '#D97706', fontSize: 12, fontWeight: 600 }}>
                    Prepare vendor conversation &rarr;
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* New enquiries */}
      {recentEnquiries.length > 0 && (
        <>
          <SectionLabel>New enquiries</SectionLabel>
          <div style={{
            background: '#FFFFFF',
            borderRadius: 18,
            overflow: 'hidden',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.04)',
            marginBottom: 28,
          }}>
            {recentEnquiries.map((enquiry, i) => (
              <div
                key={enquiry.id}
                style={{
                  padding: '14px 18px',
                  borderBottom: i < recentEnquiries.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 500, color: '#0D0D12' }}>
                    {enquiry.enquirerName || 'Unknown'}
                  </span>
                  <span style={{
                    background: '#EFF6FF', border: '1px solid rgba(59,130,246,0.2)',
                    borderRadius: 20, padding: '2px 8px', fontSize: 9.5, fontWeight: 700, color: '#1D4ED8',
                  }}>
                    NEW
                  </span>
                </div>
                <p style={{ fontSize: 12, color: '#A0A8B0', margin: '0 0 4px' }}>
                  {enquiry.source && `${enquiry.source} · `}{enquiry.listingAddress || 'General enquiry'}
                </p>
                {enquiry.message && (
                  <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 8px', fontStyle: 'italic' }}>
                    &ldquo;{enquiry.message.slice(0, 80)}{enquiry.message.length > 80 ? '...' : ''}&rdquo;
                  </p>
                )}
                <Link
                  href={`/agent/intelligence?prompt=${encodeURIComponent(`Draft a warm, professional reply to this enquiry from ${enquiry.enquirerName || 'this person'} about ${enquiry.listingAddress || 'a property'}. Their message: "${enquiry.message || 'No message'}"`)}`}
                  style={{
                    fontSize: 12, fontWeight: 600, color: '#C49B2A', textDecoration: 'none',
                  }}
                >
                  Draft reply &rarr;
                </Link>
              </div>
            ))}
          </div>
        </>
      )}

      {/* My listings */}
      <SectionLabel>My listings</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {listings.length === 0 ? (
          <div style={{
            background: '#FFFFFF', borderRadius: 18, padding: '24px 18px', textAlign: 'center',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.04)',
          }}>
            <p style={{ color: '#A0A8B0', fontSize: 13, marginBottom: 12 }}>No listings yet</p>
            <Link href="/agent/pipeline" style={{
              fontSize: 13, fontWeight: 600, color: '#C49B2A', textDecoration: 'none',
            }}>
              Add your first listing &rarr;
            </Link>
          </div>
        ) : (
          listings.slice(0, 5).map(listing => (
            <ListingCardMini key={listing.id} listing={listing} />
          ))
        )}
      </div>
      {listings.length > 5 && (
        <Link href="/agent/pipeline" style={{
          display: 'block', textAlign: 'center', marginTop: 12,
          fontSize: 13, fontWeight: 600, color: '#C49B2A', textDecoration: 'none',
        }}>
          View all {listings.length} listings &rarr;
        </Link>
      )}
    </div>
  );
}

function ListingCardMini({ listing }: { listing: Listing }) {
  const daysOnMarket = listing.listedDate
    ? Math.floor((Date.now() - new Date(listing.listedDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const statusConfig: Record<string, { bg: string; color: string; label: string }> = {
    active: { bg: '#ECFDF5', color: '#059669', label: 'ACTIVE' },
    sale_agreed: { bg: '#FFF7ED', color: '#D97706', label: 'SALE AGREED' },
    sold: { bg: '#F3E8FF', color: '#7C3AED', label: 'SOLD' },
  };
  const sc = statusConfig[listing.status] || statusConfig.active;

  return (
    <Link href={`/agent/pipeline/${listing.id}`} style={{ textDecoration: 'none' }}>
      <div className="agent-tappable" style={{
        background: '#FFFFFF', borderRadius: 18, padding: '16px 18px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{
            background: sc.bg, color: sc.color,
            padding: '2px 8px', borderRadius: 10, fontSize: 9, fontWeight: 700, letterSpacing: '0.05em',
          }}>
            {sc.label}
          </span>
        </div>
        <p style={{ fontSize: 14.5, fontWeight: 600, color: '#0D0D12', letterSpacing: '-0.01em', margin: '0 0 4px' }}>
          {listing.address}
        </p>
        <p style={{ fontSize: 12, color: '#A0A8B0', margin: '0 0 10px' }}>
          {listing.bedrooms && `${listing.bedrooms} bed `}{listing.propertyType || ''}{listing.askingPrice ? ` · €${listing.askingPrice.toLocaleString('en-IE')}` : ''}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: '#A0A8B0' }}>
          {daysOnMarket !== null && <span>Listed {daysOnMarket}d ago</span>}
          <span>{listing.totalViewings} viewings</span>
          <span>{listing.totalEnquiries} enquiries</span>
        </div>
        {/* Progress bar */}
        <div style={{ display: 'flex', gap: 3, marginTop: 10 }}>
          <ProgressStep active={true} label="Listed" />
          <ProgressStep active={listing.status === 'sale_agreed' || listing.status === 'sold'} label="Agreed" />
          <ProgressStep active={!!listing.contractsIssuedAt} label="Contracts" />
          <ProgressStep active={listing.status === 'sold'} label="Sold" />
        </div>
      </div>
    </Link>
  );
}

function ProgressStep({ active, label }: { active: boolean; label: string }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{
        height: 3, borderRadius: 2,
        background: active ? 'linear-gradient(90deg, #B8960C, #E8C84A)' : 'rgba(0,0,0,0.06)',
        marginBottom: 3,
      }} />
      <span style={{ fontSize: 9, color: active ? '#92400E' : '#C0C8D4', fontWeight: 500 }}>{label}</span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#A0A8B0', marginBottom: 12 }}>
      {children}
    </div>
  );
}

function StatRow({ icon, label, value, color, urgent }: {
  icon: 'home' | 'mail' | 'clock'; label: string; value: number; color: string; urgent?: boolean;
}) {
  const iconBg = urgent ? 'rgba(239,68,68,0.08)' : icon === 'home' ? 'rgba(16,185,129,0.08)' : 'rgba(59,130,246,0.08)';
  const iconBorder = urgent ? 'rgba(239,68,68,0.15)' : icon === 'home' ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.15)';

  return (
    <div className="agent-tappable" style={{
      padding: '16px 18px', borderRadius: 16, background: '#FFFFFF',
      boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.04)',
      display: 'flex', alignItems: 'center', gap: 14, position: 'relative', overflow: 'hidden',
      cursor: 'pointer',
    }}>
      {urgent && (
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'linear-gradient(180deg, #EF4444, #DC2626)', borderRadius: '3px 0 0 3px' }} />
      )}
      <div style={{
        width: 34, height: 34, borderRadius: 10, background: iconBg, border: `1px solid ${iconBorder}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: urgent ? 8 : 0,
      }}>
        <StatIcon type={icon} color={urgent ? '#EF4444' : color} />
      </div>
      <span style={{ flex: 1, color: '#6B7280', fontSize: 13, fontWeight: 500 }}>{label}</span>
      <span style={{ color: urgent ? '#EF4444' : '#0D0D12', fontSize: 24, fontWeight: 700, letterSpacing: '-0.05em', lineHeight: 1 }}>
        {value}
      </span>
      <div style={{
        width: 22, height: 22, borderRadius: 7, background: iconBg, border: `1px solid ${iconBorder}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke={urgent ? 'rgba(239,68,68,0.5)' : `${color}80`} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9,18 15,12 9,6" />
        </svg>
      </div>
    </div>
  );
}

function StatIcon({ type, color }: { type: 'home' | 'mail' | 'clock'; color: string }) {
  switch (type) {
    case 'home':
      return <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9,22 9,12 15,12 15,22" /></svg>;
    case 'mail':
      return <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>;
    case 'clock':
      return <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12,6 12,12 16,14" /></svg>;
  }
}
