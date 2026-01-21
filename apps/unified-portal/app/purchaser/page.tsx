'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePurchaserSession } from '@/contexts/PurchaserContext';
import { ArrowRight, Loader2 } from 'lucide-react';

export default function PurchaserLoginPage() {
  const router = useRouter();
  const { session, isLoading, login, logout } = usePurchaserSession();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionCleared, setSessionCleared] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      // If user already has a valid session, redirect them to their home instead of logging out
      if (session && session.unitUid) {
        router.push(`/homes/${session.unitUid}?token=${encodeURIComponent(session.token)}`);
        return;
      }
      setSessionCleared(true);
    }
  }, [isLoading, session, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/purchaser/auth/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Invalid code');
        setIsSubmitting(false);
        return;
      }

      login(data.session);
      // Set the iOS install dismissed cookie so user won't see app download prompt
      // They entered a code manually, so they're intentionally using the web version
      document.cookie = 'ios_install_dismissed=1; path=/; max-age=7776000; SameSite=Lax';
      router.push(`/homes/${data.session.unitUid}?token=${encodeURIComponent(data.session.token)}`);
    } catch (err) {
      setError('Connection error. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (isLoading || !sessionCleared) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#050507' }}>
        <Loader2 className="w-8 h-8 text-gold-500 animate-spin" />
      </div>
    );
  }

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
          <div className="flex justify-center mb-12">
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
            <h1 className="text-2xl md:text-[1.65rem] font-semibold mb-2" style={{ color: '#f5f5f4' }}>
              Welcome Home
            </h1>
            <p className="text-sm tracking-wide" style={{ color: '#6b7280' }}>
              Enter your OpenHouse code to access your home
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="code" className="block text-sm font-medium mb-2.5" style={{ color: '#a1a1aa' }}>
                OpenHouse Code
              </label>
              <input
                id="code"
                name="code"
                type="text"
                autoComplete="off"
                required
                autoFocus
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setError(null);
                }}
                disabled={isSubmitting}
                className="w-full px-4 py-3.5 rounded-xl transition-all duration-200 text-center text-lg font-mono tracking-wider"
                style={{
                  backgroundColor: '#0e1116',
                  border: '1px solid rgba(212, 175, 55, 0.12)',
                  color: '#e4e4e7',
                  outline: 'none',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'rgba(212, 175, 55, 0.35)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(212, 175, 55, 0.08)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(212, 175, 55, 0.12)';
                  e.target.style.boxShadow = 'none';
                }}
                placeholder="e.g. LV-PARK-001"
              />
            </div>

            {error && (
              <div 
                className="p-3.5 rounded-xl text-sm text-center"
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  color: '#f87171',
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !code.trim()}
              className="w-full py-3.5 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2"
              style={{
                background: isSubmitting || !code.trim() 
                  ? 'linear-gradient(180deg, #3f3f46 0%, #27272a 100%)'
                  : 'linear-gradient(180deg, #d4af37 0%, #b8962e 100%)',
                color: isSubmitting || !code.trim() ? '#71717a' : '#0a0a0a',
                boxShadow: isSubmitting || !code.trim() 
                  ? 'none'
                  : '0 4px 20px -4px rgba(212, 175, 55, 0.4), inset 0 1px 0 0 rgba(255, 255, 255, 0.15)',
                cursor: isSubmitting || !code.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  Access my home
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-xs text-center" style={{ color: '#52525b' }}>
            Your code was provided by your property developer
          </p>
        </div>

        <p className="mt-8 text-xs text-center" style={{ color: '#3f3f46' }}>
          OpenHouse AI Property Intelligence Platform
        </p>
      </div>
    </div>
  );
}
