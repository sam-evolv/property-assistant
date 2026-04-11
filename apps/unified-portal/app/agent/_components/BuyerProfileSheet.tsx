'use client';

import { useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import StatusBadge from './StatusBadge';

/** Buyer profile shape used by this sheet. */
export interface BuyerProfile {
  id: number | string;
  name: string;
  initials: string;
  unit: string;
  scheme: string;
  type: string;
  beds: number;
  price: number;
  status: string;
  urgent: boolean;
  daysSinceIssued: number | null;
  saleAgreedDate: string | null;
  depositDate: string | null;
  contractsIssuedDate: string | null;
  contractsSignedDate: string | null;
  handoverDate: string | null;
  snagDate: string | null;
  estimatedCloseDate: string | null;
  kitchenSelected: boolean | null;
  sqMetres: number;
  sqFeet: number;
  ber: string;
  floors: number;
  parking: string;
  heating: string;
  orientation: string;
  phone: string;
  email: string;
  address: string;
  solicitorFirm: string;
  solicitorContact: string;
  solicitorPhone: string;
  solicitorEmail: string;
  lender: string | null;
  approvalAmount: number | null;
  mortgageExpiry: string | null;
  intelligenceNotes: Array<{ date: string; action: string; detail: string }>;
}
import type { BadgeStatus } from './types';

interface BuyerProfileSheetProps {
  profile: BuyerProfile | null;
  onClose: () => void;
}

export default function BuyerProfileSheet({ profile, onClose }: BuyerProfileSheetProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!profile) return null;

  const badgeStatus: BadgeStatus =
    profile.status === 'sale_agreed' ? 'reserved' :
    profile.status === 'contracts_signed' ? 'exchanged' :
    profile.status === 'sold' ? 'confirmed' :
    (profile.status as BadgeStatus);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      {/* Backdrop */}
      <div
        className="sheet-backdrop-enter"
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.50)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      />

      {/* Sheet */}
      <div
        className="sheet-enter"
        style={{
          position: 'relative',
          background: '#FFFFFF',
          borderRadius: '28px 28px 0 0',
          maxHeight: '92dvh',
          overflowY: 'auto',
          overflowX: 'hidden',
          scrollbarWidth: 'none',
          boxShadow: '0 -4px 32px rgba(0,0,0,0.12)',
        }}
      >
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 14, paddingBottom: 4 }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: '#E0E0DC' }} />
        </div>

        <div style={{ padding: '0 24px 120px' }}>

          {/* ─── Header: Avatar, Name, Badge ─── */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: 'linear-gradient(135deg, #FFFBEB, #FEF3C7)',
              border: '1px solid rgba(212, 175, 55, 0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <span style={{ color: '#92400E', fontSize: 18, fontWeight: 700 }}>{profile.initials}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.03em', color: '#0D0D12', margin: '0 0 4px', lineHeight: 1.2 }}>
                {profile.name}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: '#6B7280' }}>{profile.unit} · {profile.scheme}</span>
                <StatusBadge status={badgeStatus} />
              </div>
            </div>
          </div>

          {/* Urgent banner */}
          {profile.urgent && profile.daysSinceIssued && (
            <div style={{
              background: '#FEF2F2', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 14,
              padding: '12px 16px', marginBottom: 20,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#DC2626' }}>
                Contracts {profile.daysSinceIssued} days overdue. Solicitor follow-up needed
              </span>
            </div>
          )}

          {/* ─── Intelligence Context ─── */}
          {profile.intelligenceNotes.length > 0 && (
            <>
              <SectionHeader icon="intelligence" label="Intelligence Activity" />
              <div style={{
                background: 'rgba(196,155,42,0.04)', border: '1px solid rgba(196,155,42,0.12)',
                borderRadius: 16, overflow: 'hidden', marginBottom: 24,
              }}>
                {profile.intelligenceNotes.map((note, i) => (
                  <div key={i} style={{
                    padding: '12px 16px',
                    borderBottom: i < profile.intelligenceNotes.length - 1 ? '1px solid rgba(196,155,42,0.08)' : 'none',
                    display: 'flex', gap: 10,
                  }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: 7,
                      background: 'rgba(196,155,42,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, marginTop: 1,
                    }}>
                      <Image src="/oh-logo-icon.png" alt="" width={14} height={14} style={{ objectFit: 'contain' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#0D0D12' }}>{note.action}</span>
                        <span style={{ fontSize: 10, color: '#A0A8B0' }}>{formatDateShort(note.date)}</span>
                      </div>
                      <p style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.45, margin: 0 }}>{note.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ─── Property Details ─── */}
          <SectionHeader icon="property" label="Property Details" />
          <div style={{
            background: '#FFFFFF', borderRadius: 16,
            border: '0.5px solid rgba(0,0,0,0.07)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)',
            overflow: 'hidden', marginBottom: 24,
          }}>
            <DetailRow label="Type" value={profile.type} />
            <DetailRow label="Bedrooms" value={String(profile.beds)} />
            <DetailRow label="Size" value={`${profile.sqMetres} m² / ${profile.sqFeet.toLocaleString()} sq ft`} />
            <DetailRow label="BER Rating" value={profile.ber} highlight />
            <DetailRow label="Floors" value={String(profile.floors)} />
            <DetailRow label="Orientation" value={profile.orientation} />
            <DetailRow label="Parking" value={profile.parking} />
            <DetailRow label="Heating" value={profile.heating} />
            <DetailRow label="Price" value={`€${profile.price.toLocaleString()}`} bold last />
          </div>

          {/* ─── Contact Details ─── */}
          <SectionHeader icon="contact" label="Contact Details" />
          <div style={{
            background: '#FFFFFF', borderRadius: 16,
            border: '0.5px solid rgba(0,0,0,0.07)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)',
            overflow: 'hidden', marginBottom: 24,
          }}>
            <DetailRow label="Phone" value={profile.phone} action="call" />
            <DetailRow label="Email" value={profile.email} action="email" />
            <DetailRow label="Address" value={profile.address} last />
          </div>

          {/* ─── Timeline / Dates ─── */}
          <SectionHeader icon="timeline" label="Sales Timeline" />
          <div style={{
            background: '#FFFFFF', borderRadius: 16,
            border: '0.5px solid rgba(0,0,0,0.07)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)',
            overflow: 'hidden', marginBottom: 24,
          }}>
            <DetailRow label="Sale Agreed" value={formatDate(profile.saleAgreedDate)} />
            <DetailRow label="Deposit Paid" value={formatDate(profile.depositDate)} />
            <DetailRow label="Contracts Issued" value={formatDate(profile.contractsIssuedDate)} />
            <DetailRow label="Contracts Signed" value={formatDate(profile.contractsSignedDate)} />
            <DetailRow label="Snag Date" value={formatDate(profile.snagDate)} />
            <DetailRow label="Est. Closing" value={formatDate(profile.estimatedCloseDate)} />
            <DetailRow label="Handover" value={formatDate(profile.handoverDate)} />
            <DetailRow label="Kitchen Selected" value={profile.kitchenSelected === null ? '-' : profile.kitchenSelected ? 'Yes' : 'No'} last />
          </div>

          {/* ─── Solicitor ─── */}
          <SectionHeader icon="solicitor" label="Solicitor" />
          <div style={{
            background: '#FFFFFF', borderRadius: 16,
            border: '0.5px solid rgba(0,0,0,0.07)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)',
            overflow: 'hidden', marginBottom: 24,
          }}>
            <DetailRow label="Firm" value={profile.solicitorFirm} />
            <DetailRow label="Contact" value={profile.solicitorContact} />
            <DetailRow label="Phone" value={profile.solicitorPhone} action="call" />
            <DetailRow label="Email" value={profile.solicitorEmail} action="email" last />
          </div>

          {/* ─── Mortgage ─── */}
          {profile.lender && (
            <>
              <SectionHeader icon="mortgage" label="Mortgage" />
              <div style={{
                background: '#FFFFFF', borderRadius: 16,
                border: '0.5px solid rgba(0,0,0,0.07)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)',
                overflow: 'hidden', marginBottom: 24,
              }}>
                <DetailRow label="Lender" value={profile.lender} />
                <DetailRow label="Approval" value={`€${profile.approvalAmount?.toLocaleString()}`} />
                <DetailRow label="Expires" value={formatDate(profile.mortgageExpiry)} last />
              </div>
            </>
          )}

          {/* ─── Quick Actions ─── */}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <Link
              href="/agent/intelligence"
              className="agent-tappable"
              style={{
                flex: 1, padding: '14px 16px',
                background: '#0D0D12', borderRadius: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                textDecoration: 'none',
                boxShadow: '0 4px 24px rgba(0,0,0,0.20), 0 1px 4px rgba(0,0,0,0.12)',
              }}
            >
              <Image src="/oh-logo-icon.png" alt="" width={16} height={16} style={{ objectFit: 'contain' }} />
              <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>Follow up with Intelligence</span>
            </Link>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <ActionButton icon="phone" label="Call" href={`tel:${profile.phone}`} />
            <ActionButton icon="email" label="Email" href={`mailto:${profile.email}`} />
            <ActionButton icon="solicitor" label="Call Solicitor" href={`tel:${profile.solicitorPhone}`} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */

function SectionHeader({ icon, label }: { icon: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <SectionIcon type={icon} />
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: '#A0A8B0' }}>
        {label}
      </span>
    </div>
  );
}

function DetailRow({ label, value, bold, highlight, action, last }: {
  label: string;
  value: string;
  bold?: boolean;
  highlight?: boolean;
  action?: 'call' | 'email';
  last?: boolean;
}) {
  const content = (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '11px 16px',
      borderBottom: last ? 'none' : '1px solid rgba(0,0,0,0.04)',
    }}>
      <span style={{ fontSize: 13, color: '#6B7280', fontWeight: 400 }}>{label}</span>
      <span style={{
        fontSize: 13,
        fontWeight: bold ? 700 : 500,
        color: highlight ? '#10B981' : action ? '#C49B2A' : '#0D0D12',
        letterSpacing: bold ? '-0.02em' : '-0.01em',
        textAlign: 'right' as const,
        maxWidth: '60%',
      }}>
        {value || '-'}
      </span>
    </div>
  );

  if (action === 'call') {
    return <a href={`tel:${value}`} style={{ textDecoration: 'none', display: 'block' }} className="agent-tappable">{content}</a>;
  }
  if (action === 'email') {
    return <a href={`mailto:${value}`} style={{ textDecoration: 'none', display: 'block' }} className="agent-tappable">{content}</a>;
  }
  return content;
}

function ActionButton({ icon, label, href }: { icon: string; label: string; href: string }) {
  return (
    <a
      href={href}
      className="agent-tappable"
      style={{
        flex: 1, padding: '14px 10px',
        background: '#F5F5F3', border: '0.5px solid rgba(0,0,0,0.07)', borderRadius: 14,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
        minHeight: 44,
        textDecoration: 'none',
      }}
    >
      <ActionIcon type={icon} />
      <span style={{ fontSize: 11, fontWeight: 500, color: '#6B7280' }}>{label}</span>
    </a>
  );
}

function SectionIcon({ type }: { type: string }) {
  const size = 14;
  switch (type) {
    case 'property':
      return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#A0A8B0" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>;
    case 'contact':
      return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#A0A8B0" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
    case 'timeline':
      return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#A0A8B0" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>;
    case 'solicitor':
      return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#A0A8B0" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a4 4 0 00-8 0v2"/></svg>;
    case 'mortgage':
      return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#A0A8B0" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>;
    case 'intelligence':
      return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#C49B2A" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2"/></svg>;
    default:
      return null;
  }
}

function ActionIcon({ type }: { type: string }) {
  const size = 18;
  const color = '#6B7280';
  switch (type) {
    case 'phone':
      return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg>;
    case 'email':
      return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>;
    case 'solicitor':
      return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg>;
    default:
      return null;
  }
}

/* ─── Date helpers ─── */

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return '-'; }
}

function formatDateShort(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });
  } catch { return iso; }
}
