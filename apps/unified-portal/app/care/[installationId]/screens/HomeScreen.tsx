'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useCareApp } from '../care-app-provider';

/* ── Helpers ── */
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getFirstName(fullName: string): string {
  return fullName.split(' ')[0];
}

function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

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

/* ── Animated Counter ── */
function AnimatedCounter({
  target,
  prefix = '',
  suffix = '',
  decimals = 0,
  duration = 1200,
  delay = 0,
}: {
  target: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  delay?: number;
}) {
  const [value, setValue] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  useEffect(() => {
    if (!started) return;
    const start = performance.now();
    let raf: number;

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutQuart(progress);
      setValue(eased * target);
      if (progress < 1) raf = requestAnimationFrame(animate);
    };

    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [started, target, duration]);

  return (
    <span>
      {prefix}
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
}

/* ── Stagger Entry Wrapper ── */
function StaggerItem({
  index,
  children,
  baseDelay = 0,
  stagger = 60,
}: {
  index: number;
  children: React.ReactNode;
  baseDelay?: number;
  stagger?: number;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(
      () => setVisible(true),
      baseDelay + index * stagger
    );
    return () => clearTimeout(timer);
  }, [index, baseDelay, stagger]);

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        transition:
          'opacity 550ms cubic-bezier(.16, 1, .3, 1), transform 550ms cubic-bezier(.16, 1, .3, 1)',
      }}
    >
      {children}
    </div>
  );
}

/* ── Energy Chart ── */
function EnergyChart() {
  const reveal = useScrollReveal(0.1);
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const values = [3.2, 4.1, 2.8, 5.0, 4.2, 3.6, 4.8];
  const max = Math.max(...values);

  return (
    <div ref={reveal.ref}>
      <div
        style={{
          background: '#FAFAFA',
          borderRadius: 20,
          padding: '20px 16px 16px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a' }}>
            This Week
          </span>
          <span style={{ fontSize: 12, color: '#888' }}>kWh generated</span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            height: 120,
            gap: 8,
          }}
        >
          {values.map((v, i) => {
            const heightPct = (v / max) * 100;
            const isToday = i === days.length - 1;
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: isToday ? '#B8934C' : '#999',
                    opacity: reveal.visible ? 1 : 0,
                    transition: `opacity 400ms ease ${i * 80 + 300}ms`,
                  }}
                >
                  {v}
                </span>
                <div
                  style={{
                    width: '100%',
                    maxWidth: 32,
                    borderRadius: 8,
                    background: isToday
                      ? 'linear-gradient(180deg, #D4AF37, #B8934C)'
                      : 'linear-gradient(180deg, #E8E8E8, #D8D8D8)',
                    height: reveal.visible ? `${heightPct}%` : '0%',
                    transition: `height 600ms cubic-bezier(.16, 1, .3, 1) ${i * 80}ms`,
                    minHeight: 4,
                  }}
                />
                <span
                  style={{
                    fontSize: 10,
                    color: isToday ? '#B8934C' : '#aaa',
                    fontWeight: isToday ? 700 : 500,
                  }}
                >
                  {days[i]}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Push Notification ── */
function PushNotification() {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const hasShownNotification = useRef(false);

  useEffect(() => {
    if (hasShownNotification.current) return;
    const showTimer = setTimeout(() => {
      setShow(true);
      hasShownNotification.current = true;
    }, 8000);
    return () => clearTimeout(showTimer);
  }, []);

  useEffect(() => {
    if (!show || dismissed) return;
    const dismissTimer = setTimeout(() => setDismissed(true), 6000);
    return () => clearTimeout(dismissTimer);
  }, [show, dismissed]);

  if (!show) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        left: 16,
        right: 16,
        zIndex: 2000,
        opacity: dismissed ? 0 : 1,
        transform: dismissed
          ? 'translateY(-100%) scale(0.95)'
          : show
            ? 'translateY(0) scale(1)'
            : 'translateY(-100%) scale(0.95)',
        transition:
          'all 500ms cubic-bezier(.34, 1.56, .64, 1)',
        pointerEvents: dismissed ? 'none' : 'auto',
      }}
      onClick={() => setDismissed(true)}
    >
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: 16,
          padding: '14px 16px',
          boxShadow:
            '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #D4AF37, #B8934C)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: '#1a1a1a',
              marginBottom: 2,
            }}
          >
            Great news!
          </div>
          <div
            style={{
              fontSize: 12,
              color: '#666',
              lineHeight: 1.3,
            }}
          >
            Your system generated 12% more energy than average this week.
          </div>
        </div>
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#D4AF37',
            flexShrink: 0,
          }}
        />
      </div>
    </div>
  );
}

/* ── Main HomeScreen ── */
export default function HomeScreen() {
  const { installation, setActiveTab } = useCareApp();
  const scrollRef = useRef<HTMLDivElement>(null);

  /* Scroll-reveal sections */
  const savingsReveal = useScrollReveal(0.1);
  const chartReveal = useScrollReveal(0.1);
  const tipReveal = useScrollReveal(0.1);
  const actionsReveal = useScrollReveal(0.1);
  const warrantyReveal = useScrollReveal(0.1);

  /* Savings ticker */
  const [savingsTick, setSavingsTick] = useState(847.32);
  useEffect(() => {
    const interval = setInterval(() => {
      setSavingsTick((prev) => prev + 0.01);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const quickActions = [
    {
      label: 'Something Wrong?',
      icon: (
        <svg
          width={22}
          height={22}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#B8934C"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
      action: () => setActiveTab('diagnostic'),
      bg: 'linear-gradient(135deg, #FFF8E7, #FFF3D6)',
    },
    {
      label: 'Ask Assistant',
      icon: (
        <svg
          width={22}
          height={22}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#B8934C"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      ),
      action: () => setActiveTab('assistant'),
      bg: 'linear-gradient(135deg, #F0F7FF, #E3EFFD)',
    },
    {
      label: 'Guides & Videos',
      icon: (
        <svg
          width={22}
          height={22}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#B8934C"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      ),
      action: () => setActiveTab('guides'),
      bg: 'linear-gradient(135deg, #F0FFF4, #DCFCE7)',
    },
    {
      label: 'View System',
      icon: (
        <svg
          width={22}
          height={22}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#B8934C"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      ),
      action: () => setActiveTab('system'),
      bg: 'linear-gradient(135deg, #FFF5F5, #FEE2E2)',
    },
  ];

  return (
    <div
      ref={scrollRef}
      className="care-screen-scroll"
      style={{
        height: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        paddingBottom: 100,
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {/* Keyframe animations */}
      <style>{`
        @keyframes careOrbFloat1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -20px) scale(1.1); }
          66% { transform: translate(-20px, 15px) scale(0.95); }
        }
        @keyframes careOrbFloat2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-25px, 25px) scale(0.9); }
          66% { transform: translate(35px, -10px) scale(1.05); }
        }
        @keyframes carePulseGreen {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.5); }
          50% { box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); }
        }
        @keyframes careShimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes careCounterPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
      `}</style>

      <PushNotification />

      <div style={{ padding: '0 20px' }}>
        {/* ── Logo ── */}
        <StaggerItem index={0} baseDelay={100}>
          <div style={{ paddingTop: 56, marginBottom: 4 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: 'linear-gradient(135deg, #D4AF37, #B8934C)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg
                  width={16}
                  height={16}
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
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: '#B8934C',
                  letterSpacing: '-0.02em',
                }}
              >
                OpenHouse
                <span style={{ fontWeight: 400, color: '#999', marginLeft: 4 }}>
                  Care
                </span>
              </span>
            </div>
          </div>
        </StaggerItem>

        {/* ── Greeting ── */}
        <StaggerItem index={1} baseDelay={100}>
          <div style={{ marginBottom: 2, marginTop: 20 }}>
            <span style={{ fontSize: 15, color: '#888' }}>
              {getGreeting()},{' '}
              <span style={{ color: '#1a1a1a', fontWeight: 600 }}>
                {getFirstName(installation.customer_name)}
              </span>
            </span>
          </div>
        </StaggerItem>

        {/* ── Title ── */}
        <StaggerItem index={2} baseDelay={100}>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: '#1a1a1a',
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
              margin: '0 0 8px',
            }}
          >
            Your Solar System
          </h1>
        </StaggerItem>

        {/* ── Installer Badge ── */}
        <StaggerItem index={3} baseDelay={100}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#F8F8F8',
              borderRadius: 100,
              padding: '6px 14px 6px 8px',
              marginBottom: 20,
            }}
          >
            <svg
              width={16}
              height={16}
              viewBox="0 0 24 24"
              fill="#22C55E"
              stroke="white"
              strokeWidth={2}
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline
                points="22 4 12 14.01 9 11.01"
                fill="none"
                stroke="#22C55E"
                strokeWidth={2}
              />
            </svg>
            <span style={{ fontSize: 12, color: '#666', fontWeight: 500 }}>
              Installed by{' '}
              <span style={{ fontWeight: 700, color: '#1a1a1a' }}>
                {installation.installer_name}
              </span>
            </span>
          </div>
        </StaggerItem>

        {/* ── Hero Card ── */}
        <StaggerItem index={4} baseDelay={100}>
          <div
            style={{
              position: 'relative',
              borderRadius: 24,
              padding: 24,
              background:
                'linear-gradient(145deg, #FDF8EF 0%, #F8ECDA 40%, #F2E0C4 100%)',
              overflow: 'hidden',
              marginBottom: 16,
            }}
          >
            {/* Floating orbs */}
            <div
              style={{
                position: 'absolute',
                top: -20,
                right: -20,
                width: 100,
                height: 100,
                borderRadius: '50%',
                background:
                  'radial-gradient(circle, rgba(212,175,55,0.2), transparent)',
                animation: 'careOrbFloat1 6s ease-in-out infinite',
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: -30,
                left: -10,
                width: 80,
                height: 80,
                borderRadius: '50%',
                background:
                  'radial-gradient(circle, rgba(184,147,76,0.15), transparent)',
                animation: 'careOrbFloat2 8s ease-in-out infinite',
              }}
            />

            <div
              style={{
                position: 'relative',
                zIndex: 1,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 16,
                }}
              >
                {/* Pulsing green dot */}
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: '#22C55E',
                    animation: 'carePulseGreen 2s ease-in-out infinite',
                  }}
                />
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#22C55E',
                  }}
                >
                  System Healthy
                </span>
              </div>

              <div
                style={{
                  fontSize: 14,
                  color: '#8B7355',
                  marginBottom: 4,
                  fontWeight: 500,
                }}
              >
                {installation.system_size_kwp} kWp Solar PV System
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: '#A08B6D',
                }}
              >
                {installation.panel_count}x {installation.panel_model} &bull;{' '}
                {installation.inverter_model}
              </div>
            </div>
          </div>
        </StaggerItem>

        {/* ── Metrics Row ── */}
        <StaggerItem index={5} baseDelay={100}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 10,
              marginBottom: 16,
            }}
          >
            {[
              {
                label: 'Generated Today',
                value: 4.2,
                suffix: ' kWh',
                decimals: 1,
                delay: 300,
              },
              {
                label: 'Saved Today',
                value: 3.18,
                prefix: '\u20AC',
                decimals: 2,
                delay: 400,
              },
              {
                label: 'Efficiency',
                value: 94,
                suffix: '%',
                decimals: 0,
                delay: 500,
              },
            ].map((metric, i) => (
              <div
                key={i}
                style={{
                  background: '#FAFAFA',
                  borderRadius: 16,
                  padding: '16px 12px',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: '#1a1a1a',
                    letterSpacing: '-0.02em',
                    lineHeight: 1.2,
                    marginBottom: 4,
                  }}
                >
                  <AnimatedCounter
                    target={metric.value}
                    prefix={metric.prefix || ''}
                    suffix={metric.suffix || ''}
                    decimals={metric.decimals}
                    delay={metric.delay}
                    duration={1200}
                  />
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: '#999',
                    fontWeight: 500,
                    lineHeight: 1.2,
                  }}
                >
                  {metric.label}
                </div>
              </div>
            ))}
          </div>
        </StaggerItem>

        {/* ── Savings Counter Card ── */}
        <div ref={savingsReveal.ref}>
          <div
            style={{
              opacity: savingsReveal.visible ? 1 : 0,
              transform: savingsReveal.visible
                ? 'translateY(0)'
                : 'translateY(20px)',
              transition:
                'opacity 550ms cubic-bezier(.16, 1, .3, 1), transform 550ms cubic-bezier(.16, 1, .3, 1)',
            }}
          >
            <div
              style={{
                position: 'relative',
                borderRadius: 20,
                padding: '20px 20px',
                background:
                  'linear-gradient(135deg, #065F46, #047857, #059669)',
                overflow: 'hidden',
                marginBottom: 16,
              }}
            >
              {/* Shimmer effect */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  overflow: 'hidden',
                  borderRadius: 20,
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background:
                      'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)',
                    animation: 'careShimmer 3s ease-in-out infinite',
                  }}
                />
              </div>

              <div style={{ position: 'relative', zIndex: 1 }}>
                <div
                  style={{
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.7)',
                    fontWeight: 500,
                    marginBottom: 6,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Total Savings Since Install
                </div>
                <div
                  style={{
                    fontSize: 36,
                    fontWeight: 800,
                    color: 'white',
                    letterSpacing: '-0.03em',
                    lineHeight: 1,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {'\u20AC'}
                  {savingsTick.toFixed(2)}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.6)',
                    marginTop: 6,
                  }}
                >
                  Since {installation.install_date}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Energy Chart ── */}
        <div ref={chartReveal.ref}>
          <div
            style={{
              opacity: chartReveal.visible ? 1 : 0,
              transform: chartReveal.visible
                ? 'translateY(0)'
                : 'translateY(20px)',
              transition:
                'opacity 550ms cubic-bezier(.16, 1, .3, 1), transform 550ms cubic-bezier(.16, 1, .3, 1)',
              marginBottom: 16,
            }}
          >
            <EnergyChart />
          </div>
        </div>

        {/* ── Tip Card ── */}
        <div ref={tipReveal.ref}>
          <div
            style={{
              opacity: tipReveal.visible ? 1 : 0,
              transform: tipReveal.visible
                ? 'translateY(0)'
                : 'translateY(20px)',
              transition:
                'opacity 550ms cubic-bezier(.16, 1, .3, 1), transform 550ms cubic-bezier(.16, 1, .3, 1)',
              marginBottom: 20,
            }}
          >
            <div
              style={{
                borderRadius: 20,
                padding: 20,
                background:
                  'linear-gradient(135deg, #1E40AF, #3B82F6, #60A5FA)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: -20,
                  right: -20,
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.1)',
                }}
              />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  <svg
                    width={18}
                    height={18}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 12 18.469V19a3.374 3.374 0 0 0-.938-1.964l-.548-.547z" />
                  </svg>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: 'white',
                    }}
                  >
                    Energy Tip
                  </span>
                </div>
                <p
                  style={{
                    fontSize: 13,
                    color: 'rgba(255,255,255,0.9)',
                    lineHeight: 1.5,
                    margin: 0,
                  }}
                >
                  Run your dishwasher and washing machine during peak solar
                  hours (11am - 3pm) to maximise self-consumption and save
                  more.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Quick Actions Grid ── */}
        <div ref={actionsReveal.ref}>
          <div
            style={{
              opacity: actionsReveal.visible ? 1 : 0,
              transform: actionsReveal.visible
                ? 'translateY(0)'
                : 'translateY(20px)',
              transition:
                'opacity 550ms cubic-bezier(.16, 1, .3, 1), transform 550ms cubic-bezier(.16, 1, .3, 1)',
              marginBottom: 20,
            }}
          >
            <h2
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: '#1a1a1a',
                marginBottom: 12,
                letterSpacing: '-0.02em',
              }}
            >
              Quick Actions
            </h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
              }}
            >
              {quickActions.map((action, i) => (
                <QuickActionButton
                  key={i}
                  label={action.label}
                  icon={action.icon}
                  bg={action.bg}
                  onClick={action.action}
                  delay={i * 60}
                  parentVisible={actionsReveal.visible}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── Warranty Cards ── */}
        <div ref={warrantyReveal.ref}>
          <div
            style={{
              opacity: warrantyReveal.visible ? 1 : 0,
              transform: warrantyReveal.visible
                ? 'translateY(0)'
                : 'translateY(20px)',
              transition:
                'opacity 550ms cubic-bezier(.16, 1, .3, 1), transform 550ms cubic-bezier(.16, 1, .3, 1)',
              marginBottom: 32,
            }}
          >
            <h2
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: '#1a1a1a',
                marginBottom: 12,
                letterSpacing: '-0.02em',
              }}
            >
              Warranty Coverage
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                {
                  title: 'Panel Warranty',
                  years: installation.system_specs.panel_warranty_years,
                  icon: '\u2600\uFE0F',
                  color: '#F59E0B',
                },
                {
                  title: 'Inverter Warranty',
                  years: installation.system_specs.inverter_warranty_years,
                  icon: '\u26A1',
                  color: '#3B82F6',
                },
                {
                  title: 'Workmanship Warranty',
                  years:
                    installation.system_specs.workmanship_warranty_years,
                  icon: '\uD83D\uDEE0\uFE0F',
                  color: '#8B5CF6',
                },
              ].map((warranty, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#FAFAFA',
                    borderRadius: 16,
                    padding: '14px 16px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: `${warranty.color}15`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 18,
                      }}
                    >
                      {warranty.icon}
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: '#1a1a1a',
                        }}
                      >
                        {warranty.title}
                      </div>
                      <div style={{ fontSize: 12, color: '#888' }}>
                        {warranty.years} years coverage
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: '#22C55E',
                      }}
                    />
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#22C55E',
                      }}
                    >
                      Active
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div
          style={{
            textAlign: 'center',
            paddingBottom: 16,
            opacity: 0.4,
          }}
        >
          <span style={{ fontSize: 11, color: '#888' }}>
            Powered by OpenHouse Care
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Quick Action Button ── */
function QuickActionButton({
  label,
  icon,
  bg,
  onClick,
  delay,
  parentVisible,
}: {
  label: string;
  icon: React.ReactNode;
  bg: string;
  onClick: () => void;
  delay: number;
  parentVisible: boolean;
}) {
  const [pressed, setPressed] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!parentVisible) return;
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [parentVisible, delay]);

  return (
    <button
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        background: bg,
        border: 'none',
        borderRadius: 20,
        padding: '20px 12px',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        transform: pressed
          ? 'scale(0.95)'
          : visible
            ? 'scale(1)'
            : 'scale(0.95)',
        opacity: visible ? 1 : 0,
        transition:
          'all 400ms cubic-bezier(.34, 1.56, .64, 1)',
      }}
    >
      {icon}
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: '#1a1a1a',
          lineHeight: 1.2,
          textAlign: 'center',
        }}
      >
        {label}
      </span>
    </button>
  );
}
