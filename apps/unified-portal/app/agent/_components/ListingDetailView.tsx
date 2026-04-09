'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { AgentProfile } from '@/lib/agent/agentPipelineService';
import type { Listing, Enquiry, ViewingFeedback } from '@/lib/agent/independentAgentService';
import { getListingById, getEnquiries, getViewingFeedback, createViewingFeedback } from '@/lib/agent/independentAgentService';
import AgentShell from './AgentShell';

interface Props {
  listingId: string;
  agent: AgentProfile;
}

export default function ListingDetailView({ listingId, agent }: Props) {
  const [listing, setListing] = useState<Listing | null>(null);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [feedback, setFeedback] = useState<ViewingFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);

  useEffect(() => {
    async function load() {
      const [listingData, enq, fb] = await Promise.all([
        getListingById(listingId),
        getEnquiries(agent.id, listingId),
        getViewingFeedback(listingId),
      ]);
      setListing(listingData);
      setEnquiries(enq);
      setFeedback(fb);
      setLoading(false);
    }
    load();
  }, [listingId, agent.id]);

  if (loading) {
    return (
      <AgentShell agentName={agent.displayName?.split(' ')[0]} urgentCount={0}>
        <div style={{ padding: '16px 24px 100px' }}>
          <div style={{ height: 200, background: '#f3f4f6', borderRadius: 18, animation: 'pulse 1.5s infinite' }} />
        </div>
      </AgentShell>
    );
  }

  if (!listing) {
    return (
      <AgentShell agentName={agent.displayName?.split(' ')[0]} urgentCount={0}>
        <div style={{ padding: '40px 24px', textAlign: 'center' }}>
          <p style={{ color: '#A0A8B0', fontSize: 14 }}>Listing not found</p>
          <Link href="/agent/pipeline" style={{ color: '#C49B2A', fontSize: 13, fontWeight: 600, textDecoration: 'none', marginTop: 12, display: 'inline-block' }}>
            &larr; Back to listings
          </Link>
        </div>
      </AgentShell>
    );
  }

  const daysOnMarket = listing.listedDate
    ? Math.floor((Date.now() - new Date(listing.listedDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const commission = listing.askingPrice && listing.commissionRate
    ? Math.round(listing.askingPrice * (listing.commissionRate / 100))
    : null;

  return (
    <AgentShell agentName={agent.displayName?.split(' ')[0]} urgentCount={0}>
      <div style={{ padding: '8px 24px 100px' }}>
        <Link href="/agent/pipeline" style={{ color: '#A0A8B0', fontSize: 13, textDecoration: 'none', display: 'block', marginBottom: 12 }}>
          &larr; My Listings
        </Link>

        <p style={{ fontSize: 20, fontWeight: 700, color: '#0D0D12', letterSpacing: '-0.03em', marginBottom: 4 }}>
          {listing.address}
        </p>
        <p style={{ fontSize: 13, color: '#A0A8B0', marginBottom: 4 }}>
          {listing.bedrooms && `${listing.bedrooms} bed `}{listing.propertyType?.toLowerCase() || ''}{listing.berRating ? ` · BER ${listing.berRating}` : ''}
        </p>
        {daysOnMarket !== null && (
          <p style={{ fontSize: 12, color: '#A0A8B0', marginBottom: 16 }}>Listed {daysOnMarket} days ago</p>
        )}

        {/* Price + Commission */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <InfoCard label="Asking price" value={listing.askingPrice ? `\u20AC${listing.askingPrice.toLocaleString('en-IE')}` : '\u2014'} />
          {commission !== null && (
            <InfoCard label="Commission" value={`\u20AC${commission.toLocaleString('en-IE')}`} />
          )}
        </div>

        {/* Pipeline timeline */}
        <SectionLabel>Pipeline</SectionLabel>
        <div style={{
          background: '#FFFFFF', borderRadius: 18, padding: '16px 18px', marginBottom: 20,
          boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.04)',
        }}>
          <TimelineRow label="Listed" date={listing.listedDate} active={true} />
          <TimelineRow label="Sale agreed" date={listing.saleAgreedAt} active={!!listing.saleAgreedAt} />
          <TimelineRow label="Contracts" date={listing.contractsIssuedAt} active={!!listing.contractsIssuedAt} />
          <TimelineRow label="Sold" date={listing.soldAt} active={listing.status === 'sold'} isLast />
        </div>

        {/* Vendor */}
        <SectionLabel>Vendor</SectionLabel>
        <div style={{
          background: '#FFFFFF', borderRadius: 18, padding: '14px 18px', marginBottom: 20,
          boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.04)',
        }}>
          <p style={{ fontSize: 13.5, fontWeight: 500, color: '#0D0D12', marginBottom: 2 }}>
            {listing.vendorName || 'Not recorded'}
            {listing.vendorPhone && <span style={{ color: '#A0A8B0' }}> &middot; {listing.vendorPhone}</span>}
          </p>
          {listing.vendorSolicitorName && (
            <p style={{ fontSize: 12, color: '#A0A8B0' }}>
              Solicitor: {listing.vendorSolicitorName}{listing.vendorSolicitorEmail && ` · ${listing.vendorSolicitorEmail}`}
            </p>
          )}
        </div>

        {/* Buyer (if sale agreed) */}
        {listing.buyerName && (
          <>
            <SectionLabel>Buyer</SectionLabel>
            <div style={{
              background: '#FFFFFF', borderRadius: 18, padding: '14px 18px', marginBottom: 20,
              boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.04)',
            }}>
              <p style={{ fontSize: 13.5, fontWeight: 500, color: '#0D0D12', marginBottom: 2 }}>
                {listing.buyerName}
                {listing.buyerPhone && <span style={{ color: '#A0A8B0' }}> &middot; {listing.buyerPhone}</span>}
              </p>
              {listing.buyerSolicitorName && (
                <p style={{ fontSize: 12, color: '#A0A8B0' }}>
                  Solicitor: {listing.buyerSolicitorName}{listing.buyerSolicitorEmail && ` · ${listing.buyerSolicitorEmail}`}
                </p>
              )}
            </div>
          </>
        )}

        {/* Stats */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <MiniStat label="Viewings" value={listing.totalViewings} />
          <MiniStat label="Enquiries" value={enquiries.length} />
          <MiniStat label="Feedback" value={feedback.length} />
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
          <Link href={`/agent/enquiries?listing=${listing.id}`} className="agent-tappable" style={{
            flex: 1, padding: '12px 0', borderRadius: 14, border: '1px solid rgba(0,0,0,0.08)',
            background: '#fff', textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#0D0D12', textDecoration: 'none',
          }}>
            View enquiries
          </Link>
          <button onClick={() => setShowFeedbackForm(!showFeedbackForm)} className="agent-tappable" style={{
            flex: 1, padding: '12px 0', borderRadius: 14, border: '1px solid rgba(0,0,0,0.08)',
            background: '#fff', fontSize: 12, fontWeight: 600, color: '#0D0D12', cursor: 'pointer',
          }}>
            Log feedback
          </button>
          <Link href={`/agent/intelligence?prompt=${encodeURIComponent(`Prepare a vendor update for ${listing.address}`)}`} className="agent-tappable" style={{
            flex: 1, padding: '12px 0', borderRadius: 14, border: 'none',
            background: '#0D0D12', textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#fff', textDecoration: 'none',
          }}>
            Vendor update
          </Link>
        </div>

        {/* Feedback form */}
        {showFeedbackForm && (
          <FeedbackForm
            listingId={listing.id}
            agentId={agent.id}
            tenantId={agent.tenantId}
            onSaved={(fb) => { setFeedback(prev => [fb, ...prev]); setShowFeedbackForm(false); }}
            onCancel={() => setShowFeedbackForm(false)}
          />
        )}

        {/* Recent feedback */}
        {feedback.length > 0 && (
          <>
            <SectionLabel>Recent feedback</SectionLabel>
            <div style={{
              background: '#FFFFFF', borderRadius: 18, overflow: 'hidden', marginBottom: 20,
              boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.04)',
            }}>
              {feedback.slice(0, 5).map((fb, i) => (
                <div key={fb.id} style={{
                  padding: '12px 18px',
                  borderBottom: i < Math.min(feedback.length, 5) - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#0D0D12' }}>
                      {fb.viewerName || 'Viewer'}
                    </span>
                    <span style={{ fontSize: 11, color: '#A0A8B0' }}>
                      {new Date(fb.viewingDate).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11, color: '#6B7280' }}>
                    {fb.interestLevel && <span>{fb.interestLevel}</span>}
                    {fb.pricePerception && <span>&middot; Price: {fb.pricePerception}</span>}
                    {fb.wouldViewAgain !== null && <span>&middot; {fb.wouldViewAgain ? 'Would view again' : 'Would not view again'}</span>}
                  </div>
                  {fb.mainConcern && (
                    <p style={{ fontSize: 12, color: '#A0A8B0', marginTop: 4, fontStyle: 'italic' }}>&ldquo;{fb.mainConcern}&rdquo;</p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </AgentShell>
  );
}

// ─── Feedback Form ───

function FeedbackForm({ listingId, agentId, tenantId, onSaved, onCancel }: {
  listingId: string;
  agentId: string;
  tenantId: string;
  onSaved: (fb: ViewingFeedback) => void;
  onCancel: () => void;
}) {
  const [viewerName, setViewerName] = useState('');
  const [interestLevel, setInterestLevel] = useState('');
  const [pricePerception, setPricePerception] = useState('');
  const [mainConcern, setMainConcern] = useState('');
  const [wouldViewAgain, setWouldViewAgain] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!interestLevel) return;
    setSaving(true);
    const today = new Date().toISOString().split('T')[0];
    const success = await createViewingFeedback({
      listingId, agentId, tenantId,
      viewerName: viewerName || undefined,
      viewingDate: today,
      interestLevel,
      pricePerception,
      mainConcern: mainConcern || undefined,
      wouldViewAgain: wouldViewAgain ?? false,
    });
    setSaving(false);
    if (success) {
      onSaved({
        id: Date.now().toString(),
        listingId,
        viewerName: viewerName || null,
        viewingDate: today,
        interestLevel,
        pricePerception,
        mainConcern: mainConcern || null,
        wouldViewAgain,
      });
    }
  };

  return (
    <div style={{
      background: '#FFFFFF', borderRadius: 18, padding: '18px', marginBottom: 20,
      boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.04)',
    }}>
      <h4 style={{ fontSize: 15, fontWeight: 600, color: '#0D0D12', marginBottom: 14 }}>Log viewing feedback</h4>

      <FieldLabel>Viewer name</FieldLabel>
      <FieldInput value={viewerName} onChange={setViewerName} placeholder="Sarah Murphy" />

      <FieldLabel>How interested were they? *</FieldLabel>
      <RadioGroup options={['Very interested', 'Interested', 'Neutral', 'Not interested']} value={interestLevel} onChange={setInterestLevel} />

      <FieldLabel>How did they find the price?</FieldLabel>
      <RadioGroup options={['Good value', 'Fair', 'Slightly high', 'Too high']} value={pricePerception} onChange={setPricePerception} />

      <FieldLabel>Main concern (optional)</FieldLabel>
      <FieldInput value={mainConcern} onChange={setMainConcern} placeholder="e.g. Garden size, traffic noise" />

      <FieldLabel>Would they view again?</FieldLabel>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        {[true, false].map(v => (
          <button key={String(v)} onClick={() => setWouldViewAgain(v)} style={{
            padding: '8px 20px', borderRadius: 10,
            border: wouldViewAgain === v ? '1.5px solid #C49B2A' : '1px solid rgba(0,0,0,0.08)',
            background: wouldViewAgain === v ? '#FFFBEB' : '#fff',
            color: wouldViewAgain === v ? '#92400E' : '#6B7280',
            fontSize: 12, fontWeight: 500, cursor: 'pointer',
          }}>
            {v ? 'Yes' : 'No'}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={onCancel} className="agent-tappable" style={{
          flex: 1, padding: '12px 0', borderRadius: 14, border: '1px solid rgba(0,0,0,0.08)',
          background: '#fff', fontSize: 13, fontWeight: 600, color: '#6B7280', cursor: 'pointer',
        }}>Cancel</button>
        <button onClick={handleSave} disabled={!interestLevel || saving} className="agent-tappable" style={{
          flex: 1, padding: '12px 0', borderRadius: 14, border: 'none',
          background: interestLevel ? '#0D0D12' : 'rgba(0,0,0,0.1)',
          fontSize: 13, fontWeight: 600, color: '#fff', cursor: interestLevel ? 'pointer' : 'default',
          opacity: saving ? 0.6 : 1,
        }}>
          {saving ? 'Saving...' : 'Save feedback'}
        </button>
      </div>
    </div>
  );
}

// ─── Shared components ───

function RadioGroup({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
      {options.map(opt => (
        <button key={opt} onClick={() => onChange(opt)} style={{
          padding: '7px 14px', borderRadius: 20,
          border: value === opt ? '1.5px solid #C49B2A' : '1px solid rgba(0,0,0,0.08)',
          background: value === opt ? '#FFFBEB' : '#fff',
          color: value === opt ? '#92400E' : '#6B7280',
          fontSize: 11, fontWeight: 500, cursor: 'pointer',
        }}>
          {opt}
        </button>
      ))}
    </div>
  );
}

function TimelineRow({ label, date, active, isLast }: {
  label: string; date: string | null; active: boolean; isLast?: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: isLast ? 0 : 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 2 }}>
        <div style={{
          width: 10, height: 10, borderRadius: 5,
          background: active ? 'linear-gradient(135deg, #B8960C, #E8C84A)' : 'rgba(0,0,0,0.08)',
          border: active ? 'none' : '2px solid rgba(0,0,0,0.08)',
          boxSizing: 'border-box',
        }} />
        {!isLast && <div style={{ width: 1, height: 20, background: active ? 'rgba(184,150,12,0.3)' : 'rgba(0,0,0,0.06)', marginTop: 4 }} />}
      </div>
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: active ? '#0D0D12' : '#C0C8D4' }}>{label}</span>
        <span style={{ fontSize: 12, color: '#A0A8B0', marginLeft: 8 }}>
          {date ? new Date(date).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' }) : '\u2014'}
        </span>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      flex: 1, background: '#FFFFFF', borderRadius: 14, padding: '14px 16px',
      boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.04)',
    }}>
      <p style={{ fontSize: 11, color: '#A0A8B0', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 20, fontWeight: 700, color: '#0D0D12', letterSpacing: '-0.03em' }}>{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{
      flex: 1, background: '#FFFFFF', borderRadius: 14, padding: '12px', textAlign: 'center',
      boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.04)',
    }}>
      <p style={{ fontSize: 11, color: '#A0A8B0', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 20, fontWeight: 700, color: '#0D0D12', letterSpacing: '-0.03em' }}>{value}</p>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#A0A8B0', marginBottom: 10 }}>
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 6 }}>{children}</label>;
}

function FieldInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', fontSize: 13, marginBottom: 14, boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }}
    />
  );
}
