'use client';

import { Suspense, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [showPassword, setShowPassword] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirectTo = searchParams.get('redirectTo') || null;
  
  const sanitizeRedirect = (url: string | null): string | null => {
    if (!url) return null;
    try {
      if (url.startsWith('/') && !url.startsWith('//')) {
        return url;
      }
      const parsed = new URL(url, window.location.origin);
      if (parsed.origin === window.location.origin) {
        return parsed.pathname + parsed.search + parsed.hash;
      }
      return null;
    } catch {
      return null;
    }
  };
  
  const redirectTo = sanitizeRedirect(rawRedirectTo);

  const supabase = createClientComponentClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (mode === 'signin') {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (!response.ok) {
          if (data.error === 'Invalid login credentials') {
            throw new Error('Invalid email or password. Please check your credentials and try again.');
          }
          throw new Error(data.error || 'Login failed');
        }

        const postLoginUrl = redirectTo 
          ? `/api/auth/post-login?redirectTo=${encodeURIComponent(redirectTo)}`
          : '/api/auth/post-login';
        
        console.log('[LOGIN] Redirecting to server post-login handler:', postLoginUrl);
        window.location.href = postLoginUrl;
      } else if (mode === 'signup') {
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match.');
        }

        if (password.length < 8) {
          throw new Error('Password must be at least 8 characters.');
        }

        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (signUpError) {
          throw signUpError;
        }

        setSuccess('Account created! Check your email to confirm your account.');
        setMode('signin');
        setPassword('');
        setConfirmPassword('');
      } else if (mode === 'forgot') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });

        if (resetError) {
          throw resetError;
        }

        setSuccess('Password reset email sent. Check your inbox.');
        setMode('signin');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    switch (mode) {
      case 'signup':
        return 'Create Account';
      case 'forgot':
        return 'Reset Password';
      default:
        return 'Developer Login';
    }
  };

  const getSubtitle = () => {
    switch (mode) {
      case 'signup':
        return 'Join the OpenHouse AI platform';
      case 'forgot':
        return 'Enter your email to reset your password';
      default:
        return 'Access your developer portal';
    }
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
              {getTitle()}
            </h1>
            <p className="text-sm tracking-wide" style={{ color: '#6b7280' }}>
              {getSubtitle()}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2.5" style={{ color: '#a1a1aa' }}>
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl transition-all duration-200"
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
                placeholder="you@company.com"
              />
            </div>

            {mode !== 'forgot' && (
              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-2.5" style={{ color: '#a1a1aa' }}>
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3.5 pr-12 rounded-xl transition-all duration-200"
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
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: '#6b7280' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#a1a1aa'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#6b7280'}
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )}

            {mode === 'signup' && (
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2.5" style={{ color: '#a1a1aa' }}>
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl transition-all duration-200"
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
                  placeholder="Confirm your password"
                />
              </div>
            )}

            {mode === 'signin' && (
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot');
                    setError(null);
                    setSuccess(null);
                  }}
                  className="text-sm transition-colors"
                  style={{ color: '#b8934c' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#d4af37'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#b8934c'}
                >
                  Forgot password?
                </button>
              </div>
            )}

            {error && (
              <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(127, 29, 29, 0.2)', border: '1px solid rgba(185, 28, 28, 0.3)' }}>
                <p className="text-sm" style={{ color: '#fca5a5' }}>{error}</p>
              </div>
            )}

            {success && (
              <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(6, 78, 59, 0.2)', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                <p className="text-sm" style={{ color: '#86efac' }}>{success}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 px-4 font-semibold rounded-xl transition-all duration-200 mt-2"
              style={{
                background: 'linear-gradient(135deg, #d4af37 0%, #b8934c 100%)',
                color: '#0a0a0f',
                boxShadow: '0 4px 20px -4px rgba(212, 175, 55, 0.4)',
                opacity: loading ? 0.6 : 1,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 6px 25px -4px rgba(212, 175, 55, 0.5)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 20px -4px rgba(212, 175, 55, 0.4)';
              }}
              onMouseDown={(e) => {
                if (!loading) {
                  e.currentTarget.style.transform = 'translateY(1px)';
                }
              }}
              onMouseUp={(e) => {
                if (!loading) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing...
                </span>
              ) : mode === 'signin' ? (
                'Sign In'
              ) : mode === 'signup' ? (
                'Create Account'
              ) : (
                'Send Reset Link'
              )}
            </button>
          </form>

          <div className="mt-7 text-center">
            {mode === 'signin' && (
              <p className="text-sm" style={{ color: '#6b7280' }}>
                Need an account?{' '}
                <button
                  onClick={() => {
                    setMode('signup');
                    setError(null);
                    setSuccess(null);
                  }}
                  className="font-medium transition-colors"
                  style={{ color: '#b8934c' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#d4af37'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#b8934c'}
                >
                  Create one
                </button>
              </p>
            )}
            {mode === 'signup' && (
              <p className="text-sm" style={{ color: '#6b7280' }}>
                Already have an account?{' '}
                <button
                  onClick={() => {
                    setMode('signin');
                    setError(null);
                    setSuccess(null);
                    setConfirmPassword('');
                  }}
                  className="font-medium transition-colors"
                  style={{ color: '#b8934c' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#d4af37'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#b8934c'}
                >
                  Sign in
                </button>
              </p>
            )}
            {mode === 'forgot' && (
              <p className="text-sm" style={{ color: '#6b7280' }}>
                Remember your password?{' '}
                <button
                  onClick={() => {
                    setMode('signin');
                    setError(null);
                    setSuccess(null);
                  }}
                  className="font-medium transition-colors"
                  style={{ color: '#b8934c' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#d4af37'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#b8934c'}
                >
                  Sign in
                </button>
              </p>
            )}
          </div>

          <div className="mt-8 pt-6" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.04)' }}>
            <p className="text-center text-xs" style={{ color: '#4b5563' }}>
              By signing in, you agree to our{' '}
              <a 
                href="#" 
                className="transition-colors"
                style={{ color: '#78716c' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#a8a29e'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#78716c'}
              >
                Terms of Service
              </a>{' '}
              and{' '}
              <a 
                href="#" 
                className="transition-colors"
                style={{ color: '#78716c' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#a8a29e'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#78716c'}
              >
                Privacy Policy
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

export default function LoginPage() {
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
      <LoginForm />
    </Suspense>
  );
}
