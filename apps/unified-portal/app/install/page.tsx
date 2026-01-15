'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function sanitizeRedirectTarget(target: string | null): string {
  if (!target) return '/';
  
  try {
    const decoded = decodeURIComponent(target);
    
    if (!decoded.startsWith('/') || decoded.startsWith('//')) {
      return '/';
    }
    
    try {
      const url = new URL(decoded, 'https://portal.openhouseai.ie');
      if (url.origin !== 'https://portal.openhouseai.ie') {
        return '/';
      }
      return url.pathname + url.search + url.hash;
    } catch {
      if (decoded.startsWith('/') && !decoded.startsWith('//')) {
        return decoded.split(/[<>'"]/)[0];
      }
      return '/';
    }
  } catch {
    return '/';
  }
}

function InstallContent() {
  const searchParams = useSearchParams();
  const rawTarget = searchParams.get('target');
  const safeTarget = sanitizeRedirectTarget(rawTarget);
  
  const appStoreUrl = 'https://apps.apple.com/app/openhouse-ai/id6504372916';

  const handleContinueWeb = () => {
    document.cookie = 'ios_install_dismissed=1; path=/; max-age=86400; SameSite=Lax';
    window.location.href = safeTarget;
  };

  const handleGetApp = () => {
    window.location.href = appStoreUrl;
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ backgroundColor: '#050507' }}>
      <style jsx global>{`
        @keyframes logoBreath {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.16);
          }
        }
        @keyframes auraBreath {
          0%, 100% {
            opacity: 0.45;
            transform: scale(1);
          }
          50% {
            opacity: 0.65;
            transform: scale(1.15);
          }
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
          className="rounded-2xl p-8 md:p-10 overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, rgba(18, 18, 22, 0.95) 0%, rgba(12, 12, 15, 0.98) 100%)',
            border: '1px solid rgba(212, 175, 55, 0.08)',
            boxShadow: '0 25px 80px -20px rgba(0, 0, 0, 0.8), inset 0 1px 0 0 rgba(255, 255, 255, 0.03)',
          }}
        >
          <div className="flex justify-center mb-10">
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

          <div className="text-center mb-8">
            <h1 className="text-2xl md:text-[1.65rem] font-semibold mb-3" style={{ color: '#f5f5f4' }}>
              Get the Full Experience
            </h1>
            <p className="text-sm tracking-wide leading-relaxed" style={{ color: '#9ca3af' }}>
              Access your home portal with the OpenHouse AI app for the best experience.
            </p>
          </div>

          <div className="space-y-4">
            <button
              onClick={handleGetApp}
              className="w-full py-4 px-4 font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-3"
              style={{
                background: 'linear-gradient(135deg, #d4af37 0%, #b8934c 100%)',
                color: '#0a0a0f',
                boxShadow: '0 4px 20px -4px rgba(212, 175, 55, 0.4)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 25px -4px rgba(212, 175, 55, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 20px -4px rgba(212, 175, 55, 0.4)';
              }}
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
              Get the App
            </button>

            <button
              onClick={handleContinueWeb}
              className="w-full py-4 px-4 font-medium rounded-xl transition-all duration-200"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(212, 175, 55, 0.15)',
                color: '#a1a1aa',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.25)';
                e.currentTarget.style.color = '#d4d4d8';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.15)';
                e.currentTarget.style.color = '#a1a1aa';
              }}
            >
              Continue on Web
            </button>
          </div>

          <div className="mt-8 pt-6" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.04)' }}>
            <div className="flex items-start gap-3 text-left">
              <div className="flex-shrink-0 mt-0.5">
                <svg className="w-5 h-5" style={{ color: '#6b7280' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: '#6b7280' }}>
                After installing, open the app and scan your QR code again for the best experience.
              </p>
            </div>
          </div>
        </div>

        <p className="text-center text-xs mt-8 tracking-wide" style={{ color: '#3f3f46' }}>
          OpenHouse AI Property Intelligence Platform
        </p>
      </div>
    </div>
  );
}

export default function InstallPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#050507' }}>
          <div className="text-center">
            <div className="w-10 h-10 rounded-full animate-spin mx-auto mb-4" style={{ border: '2px solid rgba(212, 175, 55, 0.2)', borderTopColor: '#d4af37' }} />
            <p className="text-sm" style={{ color: '#6b7280' }}>Loading...</p>
          </div>
        </div>
      }
    >
      <InstallContent />
    </Suspense>
  );
}
