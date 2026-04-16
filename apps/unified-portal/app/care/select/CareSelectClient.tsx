'use client';

import Link from 'next/link';
import Image from 'next/image';

interface CardProps {
  href: string | null;
  iconPath: React.ReactNode;
  title: string;
  subtitle: string;
  cta: string;
}

function Card({ href, iconPath, title, subtitle, cta }: CardProps) {
  const disabled = !href;

  const cardStyle: React.CSSProperties = {
    flex: '1 1 280px',
    maxWidth: 340,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 18,
    padding: '32px 28px',
    textDecoration: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    transition: 'background 0.15s ease, border-color 0.15s ease',
  };

  const inner = (
    <>
      {/* Icon */}
      <div style={{
        width: 52,
        height: 52,
        borderRadius: 14,
        background: 'rgba(212,175,55,0.12)',
        border: '1px solid rgba(212,175,55,0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
          stroke="#D4AF37" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          {iconPath}
        </svg>
      </div>

      <h2 style={{
        color: '#ffffff',
        fontSize: 20,
        fontWeight: 700,
        letterSpacing: '-0.03em',
        margin: '0 0 10px',
      }}>
        {title}
      </h2>
      <p style={{
        color: 'rgba(255,255,255,0.45)',
        fontSize: 14,
        lineHeight: 1.55,
        margin: '0 0 28px',
      }}>
        {disabled ? 'Not available on this account' : subtitle}
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto' }}>
        <span style={{
          background: 'linear-gradient(135deg, #B8960C, #E8C84A)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          fontSize: 14,
          fontWeight: 600,
          letterSpacing: '-0.01em',
        }}>
          {cta}
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="#D4AF37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"/>
          <polyline points="12,5 19,12 12,19"/>
        </svg>
      </div>
    </>
  );

  if (disabled) {
    return <div style={cardStyle}>{inner}</div>;
  }

  return (
    <Link
      href={href!}
      style={cardStyle}
      onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
        e.currentTarget.style.borderColor = 'rgba(212,175,55,0.35)';
      }}
      onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)';
      }}
    >
      {inner}
    </Link>
  );
}

export default function CareSelectClient({
  dashboardHref,
  customerHref,
}: {
  dashboardHref: string | null;
  customerHref: string | null;
}) {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0b0c0f',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
      WebkitFontSmoothing: 'antialiased',
    }}>

      {/* Logo + product name */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <Image
          src="/oh-logo.png"
          alt="OpenHouse"
          width={36}
          height={36}
          style={{ objectFit: 'contain', marginBottom: 16 }}
        />
        <p style={{
          background: 'linear-gradient(135deg, #B8960C, #E8C84A)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          margin: 0,
        }}>
          OPENHOUSE CARE
        </p>
      </div>

      {/* Two-card selector */}
      <div style={{
        display: 'flex',
        gap: 20,
        width: '100%',
        maxWidth: 720,
        flexWrap: 'wrap',
        justifyContent: 'center',
      }}>
        <Card
          href={dashboardHref}
          iconPath={
            <>
              <rect x="3" y="3" width="7" height="9" rx="1.5"/>
              <rect x="14" y="3" width="7" height="5" rx="1.5"/>
              <rect x="14" y="12" width="7" height="9" rx="1.5"/>
              <rect x="3" y="16" width="7" height="5" rx="1.5"/>
            </>
          }
          title="Care Dashboard"
          subtitle="Manage installations, customers, and team communications."
          cta="Enter dashboard"
        />

        <Card
          href={customerHref}
          iconPath={
            <>
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              <polyline points="9,22 9,12 15,12 15,22"/>
            </>
          }
          title="My Energy System"
          subtitle="View your solar performance, documents, and home assistant."
          cta="Open portal"
        />
      </div>

      {/* Back to products */}
      <Link
        href="/login"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginTop: 40,
          color: 'rgba(255,255,255,0.3)',
          fontSize: 13,
          textDecoration: 'none',
          letterSpacing: '0.01em',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"/>
          <polyline points="12,19 5,12 12,5"/>
        </svg>
        Back to products
      </Link>
    </div>
  );
}
