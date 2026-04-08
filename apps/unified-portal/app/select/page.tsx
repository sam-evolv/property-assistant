'use client';

import { useRouter } from 'next/navigation';
import { Building2, Home, ArrowRight, ArrowLeft } from 'lucide-react';
import Image from 'next/image';

const gold = '#D4AF37';
const bg = '#0b0c0f';
const surface = '#0f1115';
const surfaceHover = '#12151b';
const border = '#1e2531';
const borderHoverColor = 'rgba(212, 175, 55, 0.4)';
const textPrimary = '#eef2f8';
const textSecondary = '#9ca8bc';

const cardBase: React.CSSProperties = {
  background: surface,
  border: `1px solid ${border}`,
  borderRadius: 16,
  padding: 32,
  cursor: 'pointer',
  transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
  flex: 1,
  minHeight: 240,
};

const iconBox: React.CSSProperties = {
  width: 52,
  height: 52,
  borderRadius: 12,
  background: 'rgba(212, 175, 55, 0.1)',
  border: '1px solid rgba(212, 175, 55, 0.2)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

function Card({
  icon,
  label,
  description,
  cta,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  cta: string;
  onClick: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      style={cardBase}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.borderColor = borderHoverColor;
        el.style.background = surfaceHover;
        el.style.transform = 'translateY(-2px)';
        el.style.boxShadow = '0 8px 32px rgba(212, 175, 55, 0.08)';
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.borderColor = border;
        el.style.background = surface;
        el.style.transform = 'translateY(0)';
        el.style.boxShadow = 'none';
      }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = 'scale(0.98)';
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
    >
      <div style={iconBox}>{icon}</div>

      <div style={{ flex: 1 }}>
        <p style={{
          fontSize: 18,
          fontWeight: 600,
          color: textPrimary,
          letterSpacing: '-0.02em',
          margin: '0 0 8px 0',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}>
          {label}
        </p>
        <p style={{
          fontSize: 14,
          color: textSecondary,
          lineHeight: 1.6,
          margin: 0,
          fontFamily: 'Inter, system-ui, sans-serif',
        }}>
          {description}
        </p>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        color: gold,
        fontSize: 13,
        fontWeight: 500,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        {cta}
        <ArrowRight size={16} />
      </div>
    </div>
  );
}

export default function SelectRolePicker() {
  const router = useRouter();

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 720,
        padding: '24px 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 40 }}>
          <Image
            src="/branding/openhouse-ai-logo.png"
            alt="OpenHouse"
            width={120}
            height={32}
            style={{ height: 32, width: 'auto', objectFit: 'contain', marginBottom: 16 }}
            priority
          />
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: gold,
            fontFamily: 'Inter, system-ui, sans-serif',
          }}>
            OpenHouse Select
          </span>
          <div style={{
            width: 120,
            height: 1,
            background: 'rgba(212, 175, 55, 0.15)',
            marginTop: 16,
          }} />
        </div>

        {/* Cards */}
        <div
          style={{
            display: 'flex',
            gap: 20,
            width: '100%',
          }}
          className="select-cards"
        >
          <Card
            icon={<Building2 size={28} color={gold} />}
            label="Builder Dashboard"
            description="Manage your projects, documents and homeowners from one place."
            cta="Enter dashboard"
            onClick={() => {
              // TODO: Confirm with Sam whether this should be target="_blank" or a full navigate for the builder dashboard domain
              window.open('https://select.openhouseai.ie', '_blank', 'noopener');
            }}
          />
          <Card
            icon={<Home size={28} color={gold} />}
            label="Homeowner Portal"
            description="Your home, your documents, your story. Everything in one place."
            cta="Enter portal"
            onClick={() => router.push('/login/homeowner')}
          />
        </div>

        {/* Back link */}
        <button
          onClick={() => router.push('/login')}
          style={{
            marginTop: 32,
            background: 'none',
            border: 'none',
            color: textSecondary,
            fontSize: 13,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: 'Inter, system-ui, sans-serif',
            transition: 'color 200ms',
            padding: '8px 0',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = textPrimary; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = textSecondary; }}
        >
          <ArrowLeft size={14} />
          Back to products
        </button>

        {/* Responsive styles — stack cards on mobile */}
        <style>{`
          @media (max-width: 639px) {
            .select-cards {
              flex-direction: column !important;
              gap: 16px !important;
            }
            .select-cards > div {
              min-height: auto !important;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
