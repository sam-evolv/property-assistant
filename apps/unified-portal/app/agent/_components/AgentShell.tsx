'use client';

import { ReactNode, useEffect, useState } from 'react';
import StatusBar from './StatusBar';
import BottomNav from './BottomNav';

interface AgentShellProps {
  children: ReactNode;
  agentName?: string;
  urgentCount?: number;
  modal?: ReactNode;
}

export default function AgentShell({
  children,
  agentName,
  urgentCount,
  modal,
}: AgentShellProps) {
  const [isDesktop, setIsDesktop] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const check = () => {
      setIsDesktop(window.innerWidth > 768);
      setChecked(true);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Don't flash the mobile UI on desktop — wait until we've checked
  if (!checked) return null;

  if (isDesktop) {
    return (
      <div style={{
        minHeight: '100dvh',
        background: '#FAFAF8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
        WebkitFontSmoothing: 'antialiased',
      }}>
        <div style={{
          textAlign: 'center',
          padding: '40px 32px',
          maxWidth: 380,
        }}>
          {/* Phone icon */}
          <div style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: '#0D0D12',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
              <line x1="12" y1="18" x2="12.01" y2="18"/>
            </svg>
          </div>

          {/* OpenHouse wordmark */}
          <p style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#D4AF37',
            marginBottom: 16,
          }}>
            OpenHouse Agent
          </p>

          <h1 style={{
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: '-0.03em',
            color: '#0D0D12',
            marginBottom: 12,
            lineHeight: 1.25,
          }}>
            Designed for mobile
          </h1>

          <p style={{
            fontSize: 14,
            color: '#6B7280',
            lineHeight: 1.65,
            marginBottom: 32,
          }}>
            OpenHouse Agent is your mobile command centre. Open it on your phone or tablet to access your pipeline, viewings and intelligence.
          </p>

          {/* QR code placeholder — simple bordered box */}
          <div style={{
            width: 120,
            height: 120,
            border: '1px solid #E5E7EB',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px',
            background: '#F9FAFB',
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
              <line x1="14" y1="14" x2="14" y2="14"/><line x1="17" y1="14" x2="17" y2="14"/><line x1="20" y1="14" x2="20" y2="14"/>
              <line x1="14" y1="17" x2="14" y2="17"/><line x1="20" y1="17" x2="20" y2="17"/>
              <line x1="14" y1="20" x2="17" y2="20"/>
            </svg>
          </div>

          <p style={{ fontSize: 12, color: '#9CA3AF' }}>
            Scan with your phone camera
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100dvh',
          background: '#FAFAF8',
          overflow: 'hidden',
          fontFamily:
            "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif",
          WebkitFontSmoothing: 'antialiased',
        }}
      >
        <StatusBar agentName={agentName} urgentCount={urgentCount} />
        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
          className="[&::-webkit-scrollbar]:hidden"
        >
          {children}
        </main>
        <BottomNav />
      </div>
      {/* Render modals outside the overflow:hidden container */}
      {modal}
    </>
  );
}
