'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function AccessPendingContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || 'your email';

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ backgroundColor: '#050507' }}>
      <style jsx global>{`
        @keyframes logoBreath {
          0%, 100% {
            transform: scale(1);
            filter: drop-shadow(0 0 20px rgba(212, 175, 55, 0.3));
          }
          50% {
            transform: scale(1.02);
            filter: drop-shadow(0 0 35px rgba(212, 175, 55, 0.5));
          }
        }
        .logo-breathe {
          animation: logoBreath 7s ease-in-out infinite;
        }
      `}</style>

      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, #0a0a0f 0%, #050507 70%, #020203 100%)' }} />
      
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")' }} />
      
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(212, 175, 55, 0.04) 0%, transparent 70%)' }} />

      <div className="relative z-10 w-full max-w-[420px] mx-4">
        <div 
          className="rounded-2xl p-8 md:p-10"
          style={{
            background: 'linear-gradient(180deg, rgba(18, 18, 22, 0.95) 0%, rgba(12, 12, 15, 0.98) 100%)',
            border: '1px solid rgba(212, 175, 55, 0.08)',
            boxShadow: '0 25px 80px -20px rgba(0, 0, 0, 0.8), 0 0 60px -30px rgba(212, 175, 55, 0.15), inset 0 1px 0 0 rgba(255, 255, 255, 0.03)',
          }}
        >
          <div className="flex justify-center mb-10">
            <div className="logo-breathe">
              <img
                src="/branding/openhouse-ai-logo.png"
                alt="OpenHouse AI"
                className="h-20 md:h-24 w-auto object-contain"
              />
            </div>
          </div>

          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: 'rgba(212, 175, 55, 0.08)' }}>
              <svg className="w-8 h-8" style={{ color: '#d4af37' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold mb-2" style={{ color: '#f5f5f4' }}>
              Access Not Configured
            </h1>
            <p className="text-sm" style={{ color: '#6b7280' }}>
              Your account has been created, but access has not been linked to a developer account yet.
            </p>
          </div>

          <div className="rounded-xl p-4 mb-6" style={{ backgroundColor: '#0e1116', border: '1px solid rgba(212, 175, 55, 0.12)' }}>
            <p className="text-sm mb-1" style={{ color: '#a1a1aa' }}>Signed in as:</p>
            <p className="font-medium break-all" style={{ color: '#d4af37' }}>{email}</p>
          </div>

          <div className="space-y-4">
            <p className="text-sm text-center" style={{ color: '#6b7280' }}>
              Please contact support to complete your account setup:
            </p>

            <a
              href={`mailto:sam@openhouseai.ie?subject=Developer%20Portal%20Access%20Request&body=Hi%20OpenHouse%20AI%20Team%2C%0A%0AI%20have%20created%20an%20account%20with%20the%20email%20${encodeURIComponent(email)}%20and%20would%20like%20to%20request%20access%20to%20the%20Developer%20Portal.%0A%0APlease%20let%20me%20know%20what%20information%20you%20need%20to%20complete%20my%20setup.%0A%0AThank%20you!`}
              className="w-full py-4 px-4 font-semibold rounded-xl flex items-center justify-center gap-2 transition-all duration-200"
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
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Contact Support
            </a>

            <Link
              href="/login"
              className="w-full py-3.5 px-4 font-medium rounded-xl flex items-center justify-center gap-2 transition-all duration-200"
              style={{
                backgroundColor: '#0e1116',
                border: '1px solid rgba(212, 175, 55, 0.12)',
                color: '#a1a1aa',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.25)';
                e.currentTarget.style.color = '#e4e4e7';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.12)';
                e.currentTarget.style.color = '#a1a1aa';
              }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
              </svg>
              Back to Login
            </Link>
          </div>

          <div className="mt-8 pt-6" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.04)' }}>
            <p className="text-center text-xs" style={{ color: '#4b5563' }}>
              Need help? Email us at{' '}
              <a 
                href="mailto:sam@openhouseai.ie" 
                className="transition-colors"
                style={{ color: '#b8934c' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#d4af37'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#b8934c'}
              >
                sam@openhouseai.ie
              </a>
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

export default function AccessPendingPage() {
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
      <AccessPendingContent />
    </Suspense>
  );
}
