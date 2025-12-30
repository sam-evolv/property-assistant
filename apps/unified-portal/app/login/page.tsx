'use client';

import { Suspense, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';

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

        const meRes = await fetch('/api/auth/me');
        const userData = await meRes.json();

        if (!meRes.ok) {
          if (userData.error === 'not_provisioned') {
            router.push(`/access-pending?email=${encodeURIComponent(userData.email || email)}`);
            return;
          }
          throw new Error(userData.message || 'Unable to verify account access.');
        }

        let finalRedirect = redirectTo;
        if (!finalRedirect) {
          if (userData.role === 'super_admin') {
            finalRedirect = '/super';
          } else if (userData.role === 'developer' || userData.role === 'admin' || userData.role === 'tenant_admin') {
            finalRedirect = '/developer';
          } else {
            finalRedirect = '/access-pending';
          }
        }

        window.location.href = finalRedirect;
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
    <div className="min-h-screen flex items-center justify-center bg-black relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-black via-black to-gray-900" />
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gold-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gold-500/5 rounded-full blur-3xl" />
      </div>
      
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="bg-gray-900/80 backdrop-blur-xl rounded-2xl border border-gray-800/50 shadow-2xl p-8 md:p-10">
          <div className="flex justify-center mb-8">
            <Image
              src="/branding/openhouse-ai-logo.png"
              alt="OpenHouse AI"
              width={200}
              height={50}
              className="h-12 w-auto object-contain"
              priority
            />
          </div>

          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-white mb-2">
              {getTitle()}
            </h1>
            <p className="text-gray-400 text-sm">
              {getSubtitle()}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
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
                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 transition-all duration-200"
                placeholder="you@company.com"
              />
            </div>

            {mode !== 'forgot' && (
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
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
                    className="w-full px-4 py-3 pr-12 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 transition-all duration-200"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )}

            {mode === 'signup' && (
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
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
                  className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 transition-all duration-200"
                  placeholder="Confirm your password"
                />
              </div>
            )}

            {mode === 'signin' && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot');
                    setError(null);
                    setSuccess(null);
                  }}
                  className="text-sm text-gold-400 hover:text-gold-300 transition-colors"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {error && (
              <div className="bg-red-900/30 border border-red-800/50 rounded-xl p-4">
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            {success && (
              <div className="bg-green-900/30 border border-green-800/50 rounded-xl p-4">
                <p className="text-sm text-green-300">{success}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-400 hover:to-gold-500 text-black font-semibold rounded-xl shadow-lg shadow-gold-500/20 hover:shadow-gold-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
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

          <div className="mt-6 text-center">
            {mode === 'signin' && (
              <p className="text-gray-400 text-sm">
                Need an account?{' '}
                <button
                  onClick={() => {
                    setMode('signup');
                    setError(null);
                    setSuccess(null);
                  }}
                  className="text-gold-400 hover:text-gold-300 font-medium transition-colors"
                >
                  Create one
                </button>
              </p>
            )}
            {mode === 'signup' && (
              <p className="text-gray-400 text-sm">
                Already have an account?{' '}
                <button
                  onClick={() => {
                    setMode('signin');
                    setError(null);
                    setSuccess(null);
                    setConfirmPassword('');
                  }}
                  className="text-gold-400 hover:text-gold-300 font-medium transition-colors"
                >
                  Sign in
                </button>
              </p>
            )}
            {mode === 'forgot' && (
              <p className="text-gray-400 text-sm">
                Remember your password?{' '}
                <button
                  onClick={() => {
                    setMode('signin');
                    setError(null);
                    setSuccess(null);
                  }}
                  className="text-gold-400 hover:text-gold-300 font-medium transition-colors"
                >
                  Sign in
                </button>
              </p>
            )}
          </div>

          <div className="mt-8 pt-6 border-t border-gray-800/50">
            <p className="text-center text-xs text-gray-500">
              By signing in, you agree to our{' '}
              <a href="#" className="text-gold-400/80 hover:text-gold-400 transition-colors">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="#" className="text-gold-400/80 hover:text-gold-400 transition-colors">
                Privacy Policy
              </a>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
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
        <div className="min-h-screen flex items-center justify-center bg-black">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-gold-500/30 border-t-gold-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400 text-sm">Loading...</p>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
