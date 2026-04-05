'use client';

import Link from 'next/link';

interface LoginCardProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  showBack?: boolean;
}

export default function LoginCard({ title, subtitle, children, showBack = true }: LoginCardProps) {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ backgroundColor: '#050507' }}>
      <style jsx global>{`
        @keyframes logoBreath {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.16); }
        }
        @keyframes auraBreath {
          0%, 100% { opacity: 0.45; transform: scale(1); }
          50% { opacity: 0.65; transform: scale(1.15); }
        }
        .logo-breathing-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .logo-breathing-wrapper::before {
          content: '';
          position: absolute;
          width: 180%;
          height: 180%;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) scale(1);
          background: radial-gradient(ellipse at center, rgba(212, 175, 55, 0.55) 0%, rgba(194, 158, 55, 0.35) 25%, rgba(178, 140, 55, 0.15) 50%, transparent 75%);
          border-radius: 50%;
          pointer-events: none;
          filter: blur(12px);
          animation: auraBreath 8s ease-in-out infinite;
          z-index: -1;
        }
        .logo-breathe {
          animation: logoBreath 8s ease-in-out infinite;
          will-change: transform;
        }
        @media (prefers-reduced-motion: reduce) {
          .logo-breathe,
          .logo-breathing-wrapper::before {
            animation: none;
          }
          .logo-breathing-wrapper::before {
            opacity: 0.5;
            transform: translate(-50%, -50%) scale(1);
          }
        }
      `}</style>

      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, #0a0a0f 0%, #050507 70%, #020203 100%)' }} />

      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")' }} />

      <div className="relative z-10 w-full max-w-[420px] mx-4">
        <div
          className="rounded-2xl overflow-hidden relative"
          style={{
            background: 'linear-gradient(180deg, rgba(18, 18, 22, 0.95) 0%, rgba(12, 12, 15, 0.98) 100%)',
            border: '1px solid rgba(212, 175, 55, 0.08)',
            boxShadow: '0 25px 80px -20px rgba(0, 0, 0, 0.8), inset 0 1px 0 0 rgba(255, 255, 255, 0.03)',
            padding: '40px 32px',
          }}
        >
          {/* Back link — absolutely positioned so it doesn't push logo down */}
          {showBack && (
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 transition-colors"
              style={{
                position: 'absolute',
                top: 20,
                left: 24,
                color: 'rgba(255,255,255,0.35)',
                fontSize: 13,
                textDecoration: 'none',
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.35)'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15,18 9,12 15,6"/></svg>
              All products
            </Link>
          )}

          {/* Logo — breathing animation matching developer login */}
          <div className="flex justify-center mb-12" style={{ marginTop: showBack ? 16 : 0 }}>
            <div className="logo-breathing-wrapper">
              <div className="logo-breathe">
                <img
                  src="/branding/openhouse-ai-logo.png"
                  alt="OpenHouse AI"
                  className="h-[6.5rem] md:h-32 w-auto object-contain"
                />
              </div>
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="text-2xl md:text-[1.65rem] font-semibold mb-2" style={{ color: '#f5f5f4' }}>
              {title}
            </h1>
            <p className="text-sm tracking-wide" style={{ color: '#6b7280' }}>
              {subtitle}
            </p>
          </div>

          {children}

          <div className="mt-8 pt-6" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.04)' }}>
            <p className="text-center text-xs" style={{ color: '#4b5563' }}>
              By signing in, you agree to our{' '}
              <a href="/terms" className="transition-colors" style={{ color: '#78716c' }}>Terms of Service</a>
              {' '}and{' '}
              <a href="/privacy" className="transition-colors" style={{ color: '#78716c' }}>Privacy Policy</a>
            </p>
          </div>
        </div>

        <p className="text-center text-xs mt-8 tracking-wide" style={{ color: '#3f3f46' }}>
          OpenHouse AI Property Intelligence Platform
        </p>
      </div>
    </div>
  );
}
