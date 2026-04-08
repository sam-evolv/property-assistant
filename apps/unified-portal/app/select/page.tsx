'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

const C = {
  bg: '#0b0c0f',
  s1: '#0f1115',
  s2: '#12151b',
  border: '#1e2531',
  borderHover: 'rgba(212, 175, 55, 0.35)',
  gold: '#D4AF37',
  goldFaint: 'rgba(212, 175, 55, 0.1)',
  goldBorder: 'rgba(212, 175, 55, 0.2)',
  t1: '#eef2f8',
  t2: '#9ca8bc',
  t3: '#778199',
};

export default function SelectRolePicker() {
  const router = useRouter();

  return (
    <div style={{
      minHeight: '100dvh',
      background: C.bg,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
      WebkitFontSmoothing: 'antialiased',
      padding: '32px 20px',
    }}>

      {/* Top gold hairline */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 1,
        background: 'linear-gradient(to right, transparent, rgba(212,175,55,0.4), transparent)',
      }} />

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        {/* Logo */}
        <div style={{
          width: 52, height: 52,
          borderRadius: 14,
          background: '#0D0D12',
          border: `1px solid ${C.goldBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          overflow: 'hidden',
        }}>
          <Image
            src="/branding/openhouse-ai-logo.png"
            alt="OpenHouse"
            width={36}
            height={36}
            style={{ objectFit: 'contain' }}
          />
        </div>

        {/* Product label */}
        <p style={{
          fontSize: 11, fontWeight: 700,
          letterSpacing: '0.12em', textTransform: 'uppercase',
          color: C.gold, marginBottom: 10,
        }}>
          OpenHouse Select
        </p>

        {/* Gold rule */}
        <div style={{
          width: 48, height: 1, margin: '0 auto 16px',
          background: 'linear-gradient(to right, transparent, rgba(212,175,55,0.4), transparent)',
        }} />

        <h1 style={{
          fontSize: 22, fontWeight: 700,
          letterSpacing: '-0.03em', color: C.t1,
          margin: 0,
        }}>
          How are you using Select?
        </h1>
      </div>

      {/* Cards */}
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        gap: 16,
        width: '100%',
        maxWidth: 560,
      }}
        className="select-cards"
      >
        {/* Builder Card */}
        <RoleCard
          icon={
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          }
          label="Builder Dashboard"
          description="Manage your projects, documents, snagging and homeowners from one place."
          cta="Enter dashboard"
          onClick={() => {
            // TODO: Update this to the correct builder dashboard URL once built
            // For now route to /builder if it exists, or show coming soon
            router.push('/builder');
          }}
        />

        {/* Homeowner Card */}
        <RoleCard
          icon={
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
            </svg>
          }
          label="Homeowner Portal"
          description="Your home, your documents, your story. Everything about your new home in one place."
          cta="Enter portal"
          onClick={() => {
            router.push('/purchaser');
          }}
        />
      </div>

      {/* Back link */}
      <button
        onClick={() => router.back()}
        style={{
          marginTop: 36,
          fontSize: 13, color: C.t3,
          background: 'none', border: 'none',
          cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', gap: 6,
          transition: 'color 150ms ease',
        }}
        onMouseEnter={e => e.currentTarget.style.color = C.t1}
        onMouseLeave={e => e.currentTarget.style.color = C.t3}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
        </svg>
        Back to products
      </button>

      {/* Mobile stacking style */}
      <style>{`
        @media (max-width: 540px) {
          .select-cards {
            flex-direction: column !important;
          }
        }
      `}</style>
    </div>
  );
}

// ── Role Card Component ──────────────────────────────────────────────────────

function RoleCard({
  icon, label, description, cta, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  cta: string;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1,
        background: hovered ? C.s2 : C.s1,
        border: `1px solid ${hovered ? C.borderHover : C.border}`,
        borderRadius: 16,
        padding: '28px 24px',
        cursor: 'pointer',
        textAlign: 'left',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hovered ? '0 8px 32px rgba(212,175,55,0.08)' : 'none',
        transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        fontFamily: "'Inter', -apple-system, system-ui, sans-serif",
        WebkitFontSmoothing: 'antialiased',
        minHeight: 220,
      }}
      onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.98)')}
      onMouseUp={e => (e.currentTarget.style.transform = hovered ? 'translateY(-2px)' : 'translateY(0)')}
    >
      {/* Icon container */}
      <div style={{
        width: 48, height: 48,
        borderRadius: 12,
        background: C.goldFaint,
        border: `1px solid ${C.goldBorder}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 20,
        flexShrink: 0,
      }}>
        {icon}
      </div>

      {/* Label */}
      <p style={{
        fontSize: 16, fontWeight: 600,
        letterSpacing: '-0.02em',
        color: C.t1,
        margin: '0 0 8px',
      }}>
        {label}
      </p>

      {/* Description */}
      <p style={{
        fontSize: 13.5, color: C.t2,
        lineHeight: 1.6, margin: '0 0 auto',
        paddingBottom: 20,
      }}>
        {description}
      </p>

      {/* CTA */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 13, fontWeight: 500,
        color: C.gold,
        marginTop: 4,
      }}>
        {cta}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
        </svg>
      </div>
    </button>
  );
}
