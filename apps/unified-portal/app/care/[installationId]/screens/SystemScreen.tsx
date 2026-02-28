'use client';

import { useEffect, useRef, useState } from 'react';
import { useCareApp } from '../care-app-provider';

/* ── Scroll Reveal Hook ── */
function useScrollReveal(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    if (prefersReduced) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, visible };
}

/* ── Reveal Section ── */
function RevealSection({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  const { ref, visible } = useScrollReveal(0.1);

  return (
    <div ref={ref}>
      <div
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(20px)',
          transition: `opacity 550ms cubic-bezier(.16, 1, .3, 1) ${delay}ms, transform 550ms cubic-bezier(.16, 1, .3, 1) ${delay}ms`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ── Spec Row ── */
function SpecRow({
  label,
  value,
  isLast = false,
}: {
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 0',
        borderBottom: isLast ? 'none' : '1px solid rgba(0,0,0,0.04)',
      }}
    >
      <span style={{ fontSize: 13, color: '#888', fontWeight: 500 }}>
        {label}
      </span>
      <span
        style={{
          fontSize: 14,
          color: '#1a1a1a',
          fontWeight: 600,
          textAlign: 'right',
          maxWidth: '55%',
        }}
      >
        {value}
      </span>
    </div>
  );
}

/* ── Warranty Progress Bar ── */
function WarrantyBar({
  label,
  totalYears,
  installYear,
}: {
  label: string;
  totalYears: number;
  installYear: number;
}) {
  const currentYear = new Date().getFullYear();
  const expiryYear = installYear + totalYears;
  const elapsed = currentYear - installYear;
  const remaining = Math.max(expiryYear - currentYear, 0);
  const progress = Math.min((elapsed / totalYears) * 100, 100);

  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 6,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>
          {label}
        </span>
        <span style={{ fontSize: 12, color: '#888', fontWeight: 500 }}>
          {remaining} years remaining
        </span>
      </div>
      <div
        style={{
          width: '100%',
          height: 8,
          borderRadius: 100,
          background: '#f0f0f0',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: '100%',
            borderRadius: 100,
            background: 'linear-gradient(90deg, #22C55E, #16A34A)',
            transition: 'width 800ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 4,
        }}
      >
        <span style={{ fontSize: 11, color: '#aaa' }}>{installYear}</span>
        <span style={{ fontSize: 11, color: '#aaa' }}>{expiryYear}</span>
      </div>
    </div>
  );
}

export default function SystemScreen() {
  const { installation } = useCareApp();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const installYear = parseInt(installation.install_date.split('-')[0], 10);
  const installDateFormatted = new Date(
    installation.install_date
  ).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const specs = [
    { label: 'Size', value: `${installation.system_size_kwp} kWp` },
    { label: 'Panel Type', value: installation.panel_model },
    { label: 'Panel Count', value: `${installation.panel_count} panels` },
    { label: 'Inverter', value: installation.inverter_model },
    {
      label: 'Battery',
      value: installation.system_specs.battery || 'None',
    },
    { label: 'Install Date', value: installDateFormatted },
    { label: 'Installer', value: installation.installer_name },
    { label: 'SEAI Grant', value: 'Approved' },
  ];

  const warranties = [
    {
      label: 'Panel Warranty',
      totalYears: installation.system_specs.panel_warranty_years || 25,
    },
    {
      label: 'Inverter Warranty',
      totalYears: installation.system_specs.inverter_warranty_years || 12,
    },
    {
      label: 'Workmanship',
      totalYears:
        installation.system_specs.workmanship_warranty_years || 10,
    },
  ];

  return (
    <div
      className="care-screen-scroll"
      style={{
        height: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        paddingBottom: 100,
        WebkitOverflowScrolling: 'touch',
        background: '#FFFFFF',
      }}
    >
      {/* Breathing gold shadow animation */}
      <style>{`
        @keyframes careGoldBreathe {
          0%, 100% { box-shadow: 0 0 0 0 rgba(212, 175, 55, 0.3); }
          50% { box-shadow: 0 0 24px 8px rgba(212, 175, 55, 0.15); }
        }
      `}</style>

      <div style={{ padding: '0 20px' }}>
        {/* ── Header with breathing gear icon ── */}
        <div
          style={{
            paddingTop: 56,
            marginBottom: 16,
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(12px)',
            transition:
              'opacity 550ms cubic-bezier(.16, 1, .3, 1), transform 550ms cubic-bezier(.16, 1, .3, 1)',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              marginBottom: 8,
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: 'linear-gradient(135deg, #D4AF37, #B8934C)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
                animation: 'careGoldBreathe 3s ease-in-out infinite',
              }}
            >
              <svg
                width={28}
                height={28}
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </div>
            <h1
              style={{
                fontSize: 24,
                fontWeight: 800,
                color: '#1a1a1a',
                letterSpacing: '-0.03em',
                margin: '0 0 6px',
              }}
            >
              Your System
            </h1>
          </div>

          {/* Address */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              marginBottom: 4,
            }}
          >
            <svg
              width={14}
              height={14}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#999"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span style={{ fontSize: 13, color: '#888', fontWeight: 500 }}>
              {installation.address_line_1}, Co. {installation.county}
            </span>
          </div>
        </div>

        {/* ── System Specs Card ── */}
        <RevealSection delay={0}>
          <div
            style={{
              background: '#FAFAFA',
              borderRadius: 20,
              padding: '4px 20px',
              marginBottom: 20,
            }}
          >
            <h2
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: '#1a1a1a',
                padding: '16px 0 0',
                margin: 0,
                letterSpacing: '-0.01em',
              }}
            >
              System Specifications
            </h2>
            {specs.map((spec, i) => (
              <SpecRow
                key={i}
                label={spec.label}
                value={spec.value}
                isLast={i === specs.length - 1}
              />
            ))}
          </div>
        </RevealSection>

        {/* ── Warranty Card ── */}
        <RevealSection delay={60}>
          <div
            style={{
              background: '#FAFAFA',
              borderRadius: 20,
              padding: 20,
              marginBottom: 20,
            }}
          >
            <h2
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: '#1a1a1a',
                margin: '0 0 16px',
                letterSpacing: '-0.01em',
              }}
            >
              Warranty Coverage
            </h2>
            {warranties.map((w, i) => (
              <WarrantyBar
                key={i}
                label={w.label}
                totalYears={w.totalYears}
                installYear={installYear}
              />
            ))}
          </div>
        </RevealSection>

        {/* ── Service Schedule Card ── */}
        <RevealSection delay={120}>
          <div
            style={{
              background: '#FAFAFA',
              borderRadius: 20,
              padding: 20,
              marginBottom: 20,
            }}
          >
            <h2
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: '#1a1a1a',
                margin: '0 0 16px',
                letterSpacing: '-0.01em',
              }}
            >
              Service Schedule
            </h2>

            {[
              {
                title: 'Annual Inspection',
                date: 'January 2027',
                status: 'Scheduled',
                statusColor: '#3B82F6',
                statusBg: '#EFF6FF',
              },
              {
                title: 'Panel Cleaning',
                date: 'April 2026',
                status: 'Upcoming',
                statusColor: '#F59E0B',
                statusBg: '#FFFBEB',
              },
              {
                title: 'Installation Inspection',
                date: 'January 2026',
                status: 'Completed',
                statusColor: '#22C55E',
                statusBg: '#F0FDF4',
              },
            ].map((service, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 0',
                  borderBottom:
                    i < 2 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#1a1a1a',
                      marginBottom: 2,
                    }}
                  >
                    {service.title}
                  </div>
                  <div style={{ fontSize: 12, color: '#888' }}>
                    {service.date}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: service.statusColor,
                    background: service.statusBg,
                    padding: '4px 10px',
                    borderRadius: 100,
                  }}
                >
                  {service.status}
                </span>
              </div>
            ))}
          </div>
        </RevealSection>

        {/* ── Powered By Footer ── */}
        <RevealSection delay={180}>
          <div
            style={{
              textAlign: 'center',
              padding: '24px 0 16px',
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                opacity: 0.5,
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 6,
                  background: 'linear-gradient(135deg, #D4AF37, #B8934C)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg
                  width={11}
                  height={11}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </div>
              <span style={{ fontSize: 12, color: '#888', fontWeight: 500 }}>
                Powered by OpenHouse Care
              </span>
            </div>
          </div>
        </RevealSection>
      </div>
    </div>
  );
}
