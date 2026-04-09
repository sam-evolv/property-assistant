'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { AgentProfile } from '@/lib/agent/agentPipelineService';
import type { Listing, ListingStatus } from '@/lib/agent/independentAgentService';
import { getListings, createListing } from '@/lib/agent/independentAgentService';

interface Props {
  agent: AgentProfile;
}

type FilterKey = 'all' | 'active' | 'sale_agreed' | 'sold';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'sale_agreed', label: 'Sale Agreed' },
  { key: 'sold', label: 'Sold' },
];

const PROPERTY_TYPES = [
  'Semi-detached', 'Detached', 'Terraced', 'Apartment', 'Bungalow', 'Duplex',
];

export default function IndependentPipelineView({ agent }: Props) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [showAddSheet, setShowAddSheet] = useState(false);

  useEffect(() => {
    async function load() {
      const data = await getListings(agent.id);
      setListings(data);
      setLoading(false);
    }
    load();
  }, [agent.id]);

  const filtered = activeFilter === 'all'
    ? listings
    : listings.filter(l => l.status === activeFilter);

  const handleListingCreated = (listing: Listing) => {
    setListings(prev => [listing, ...prev]);
    setShowAddSheet(false);
  };

  if (loading) {
    return (
      <div style={{ padding: '16px 24px 100px' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: 140, background: '#f3f4f6', borderRadius: 18, marginBottom: 12, animation: 'pulse 1.5s infinite' }} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ padding: '8px 24px 100px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0D0D12', letterSpacing: '-0.04em' }}>My Listings</h1>
        <button
          onClick={() => setShowAddSheet(true)}
          className="agent-tappable"
          style={{
            padding: '8px 16px', borderRadius: 12, border: 'none',
            background: 'linear-gradient(135deg, #C49B2A, #E8C84A)',
            color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(196,155,42,0.3)',
          }}
        >
          + Add listing
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key)}
            style={{
              padding: '7px 14px', borderRadius: 20, border: 'none',
              fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer',
              background: activeFilter === f.key ? '#0D0D12' : 'transparent',
              color: activeFilter === f.key ? '#fff' : '#A0A8B0',
              transition: 'all 0.15s ease',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Listings */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.length === 0 ? (
          <div style={{
            background: '#FFFFFF', borderRadius: 18, padding: '32px 18px', textAlign: 'center',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.04)',
          }}>
            <p style={{ color: '#A0A8B0', fontSize: 13, marginBottom: 12 }}>
              {activeFilter === 'all' ? 'No listings yet. Add your first property.' : `No ${activeFilter.replace('_', ' ')} listings.`}
            </p>
            {activeFilter === 'all' && (
              <button
                onClick={() => setShowAddSheet(true)}
                style={{
                  fontSize: 13, fontWeight: 600, color: '#C49B2A', background: 'none', border: 'none', cursor: 'pointer',
                }}
              >
                Add listing &rarr;
              </button>
            )}
          </div>
        ) : (
          filtered.map(listing => <ListingCard key={listing.id} listing={listing} />)
        )}
      </div>

      {/* Contacts link */}
      <Link href="/agent/contacts" style={{
        display: 'flex', alignItems: 'center', gap: 6, marginTop: 20, textDecoration: 'none',
      }}>
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
        </svg>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#D4AF37', letterSpacing: '-0.01em' }}>
          View Contacts
        </span>
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9,18 15,12 9,6" />
        </svg>
      </Link>

      {/* Add Listing Sheet */}
      {showAddSheet && (
        <AddListingSheet
          agent={agent}
          onClose={() => setShowAddSheet(false)}
          onCreated={handleListingCreated}
        />
      )}
    </div>
  );
}

function ListingCard({ listing }: { listing: Listing }) {
  const daysOnMarket = listing.listedDate
    ? Math.floor((Date.now() - new Date(listing.listedDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const statusConfig: Record<string, { bg: string; color: string; label: string }> = {
    active: { bg: '#ECFDF5', color: '#059669', label: 'ACTIVE' },
    sale_agreed: { bg: '#FFF7ED', color: '#D97706', label: 'SALE AGREED' },
    sold: { bg: '#F3E8FF', color: '#7C3AED', label: 'SOLD' },
  };
  const sc = statusConfig[listing.status] || statusConfig.active;

  const stages = [
    { label: 'Listed', active: true },
    { label: 'Viewing', active: listing.totalViewings > 0 },
    { label: 'Sale Agreed', active: listing.status === 'sale_agreed' || listing.status === 'sold' },
    { label: 'Contracts', active: !!listing.contractsIssuedAt },
    { label: 'Sold', active: listing.status === 'sold' },
  ];

  return (
    <Link href={`/agent/pipeline/${listing.id}`} style={{ textDecoration: 'none' }}>
      <div className="agent-tappable" style={{
        background: '#FFFFFF', borderRadius: 18, padding: '16px 18px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.04)',
      }}>
        <div style={{ marginBottom: 8 }}>
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
          {listing.bedrooms && `${listing.bedrooms} bed `}{listing.propertyType?.toLowerCase() || ''}{listing.askingPrice ? ` · €${listing.askingPrice.toLocaleString('en-IE')}` : ''}
        </p>
        <div style={{
          height: 1, background: 'rgba(0,0,0,0.04)', marginBottom: 10,
        }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: '#A0A8B0', marginBottom: 10 }}>
          {daysOnMarket !== null && <span>Listed {daysOnMarket} days ago</span>}
          <span>&middot;</span>
          <span>{listing.totalViewings} viewings</span>
          <span>&middot;</span>
          <span>{listing.totalEnquiries} enquiries</span>
        </div>
        {/* Progress bar */}
        <div style={{ display: 'flex', gap: 3 }}>
          {stages.map((stage, i) => (
            <div key={i} style={{ flex: 1 }}>
              <div style={{
                height: 3, borderRadius: 2,
                background: stage.active ? 'linear-gradient(90deg, #B8960C, #E8C84A)' : 'rgba(0,0,0,0.06)',
              }} />
            </div>
          ))}
        </div>
      </div>
    </Link>
  );
}

function AddListingSheet({ agent, onClose, onCreated }: {
  agent: AgentProfile;
  onClose: () => void;
  onCreated: (listing: Listing) => void;
}) {
  const [address, setAddress] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [bathrooms, setBathrooms] = useState('');
  const [askingPrice, setAskingPrice] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [vendorPhone, setVendorPhone] = useState('');
  const [daftUrl, setDaftUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!address.trim()) return;
    setSaving(true);

    const listing = await createListing({
      agentId: agent.id,
      tenantId: agent.tenantId,
      address: address.trim(),
      propertyType: propertyType || undefined,
      bedrooms: bedrooms ? parseInt(bedrooms) : undefined,
      bathrooms: bathrooms ? parseInt(bathrooms) : undefined,
      askingPrice: askingPrice ? parseInt(askingPrice.replace(/,/g, '')) : undefined,
      vendorName: vendorName.trim() || undefined,
      vendorPhone: vendorPhone.trim() || undefined,
      daftUrl: daftUrl.trim() || undefined,
    });

    setSaving(false);
    if (listing) {
      onCreated(listing);
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff', borderRadius: '28px 28px 0 0', width: '100%', maxWidth: 500,
          padding: '20px 24px 36px', maxHeight: '85vh', overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ width: 40, height: 4, background: '#E0E0DC', borderRadius: 2, margin: '0 auto 16px' }} />
        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0D0D12', marginBottom: 20 }}>Add listing</h3>

        <FieldLabel>Address *</FieldLabel>
        <FieldInput value={address} onChange={setAddress} placeholder="14 Elm Drive, Bishopstown, Cork" />

        <FieldLabel>Property type</FieldLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {PROPERTY_TYPES.map(t => (
            <button
              key={t}
              onClick={() => setPropertyType(propertyType === t ? '' : t)}
              style={{
                padding: '7px 14px', borderRadius: 20,
                border: propertyType === t ? '1.5px solid #C49B2A' : '1px solid rgba(0,0,0,0.08)',
                background: propertyType === t ? '#FFFBEB' : '#fff',
                color: propertyType === t ? '#92400E' : '#6B7280',
                fontSize: 12, fontWeight: 500, cursor: 'pointer',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 0 }}>
          <div style={{ flex: 1 }}>
            <FieldLabel>Bedrooms</FieldLabel>
            <FieldInput value={bedrooms} onChange={setBedrooms} placeholder="3" type="number" />
          </div>
          <div style={{ flex: 1 }}>
            <FieldLabel>Bathrooms</FieldLabel>
            <FieldInput value={bathrooms} onChange={setBathrooms} placeholder="2" type="number" />
          </div>
        </div>

        <FieldLabel>Asking price</FieldLabel>
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#A0A8B0', fontSize: 14 }}>&euro;</span>
          <input
            type="text"
            value={askingPrice}
            onChange={e => setAskingPrice(e.target.value)}
            placeholder="395,000"
            style={{
              width: '100%', padding: '12px 14px 12px 28px', borderRadius: 12,
              border: '1px solid rgba(0,0,0,0.08)', fontSize: 14, fontFamily: 'inherit',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        <FieldLabel>Vendor name</FieldLabel>
        <FieldInput value={vendorName} onChange={setVendorName} placeholder="John O'Brien" />

        <FieldLabel>Vendor phone</FieldLabel>
        <FieldInput value={vendorPhone} onChange={setVendorPhone} placeholder="087 123 4567" />

        <FieldLabel>Daft URL (optional)</FieldLabel>
        <FieldInput value={daftUrl} onChange={setDaftUrl} placeholder="https://www.daft.ie/..." />

        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <button
            onClick={onClose}
            className="agent-tappable"
            style={{
              flex: 1, padding: '13px 0', borderRadius: 14,
              border: '1px solid rgba(0,0,0,0.08)', background: '#fff',
              fontSize: 13, fontWeight: 600, color: '#6B7280', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!address.trim() || saving}
            className="agent-tappable"
            style={{
              flex: 1, padding: '13px 0', borderRadius: 14, border: 'none',
              background: address.trim() ? '#0D0D12' : 'rgba(0,0,0,0.1)',
              fontSize: 13, fontWeight: 600, color: '#fff', cursor: address.trim() ? 'pointer' : 'default',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Add listing'}
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 6 }}>
      {children}
    </label>
  );
}

function FieldInput({ value, onChange, placeholder, type = 'text' }: {
  value: string; onChange: (v: string) => void; placeholder: string; type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%', padding: '12px 14px', borderRadius: 12, marginBottom: 16,
        border: '1px solid rgba(0,0,0,0.08)', fontSize: 14, fontFamily: 'inherit',
        outline: 'none', boxSizing: 'border-box',
      }}
    />
  );
}
