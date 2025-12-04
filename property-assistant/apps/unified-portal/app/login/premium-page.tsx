'use client';

import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter, useSearchParams } from 'next/navigation';

export default function PremiumLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '/dashboard';

  const supabase = createClientComponentClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'login') {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;

        if (data.session) {
          router.push(redirectTo);
          router.refresh();
        } else {
          throw new Error('No session returned from sign in');
        }
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (signUpError) throw signUpError;

        setError('Check your email to confirm your account!');
        setMode('login');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      {/* Premium Background Pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-grey-50 via-white to-gold-50 opacity-50" />
      <div className="absolute inset-0" style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, rgb(199 165 86 / 0.05) 1px, transparent 0)`,
        backgroundSize: '40px 40px'
      }} />

      <div className="relative z-10 w-full max-w-md px-6">
        {/* Logo & Title */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 mb-6 rounded-premium bg-black">
            <svg className="w-10 h-10 text-gold-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <h1 className="text-display text-black font-bold tracking-tight mb-2">
            OpenHouse AI
          </h1>
          <div className="h-1 w-24 bg-gold-500 mx-auto mb-4" />
          <p className="text-body text-grey-600 font-medium">
            Developer Portal
          </p>
        </div>

        {/* Premium Card */}
        <div className="bg-white rounded-premium shadow-premium-lg border-2 border-grey-100 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-black mb-2">
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
                className="
                  w-full px-4 py-3
                  bg-white border-2 border-grey-200
                  rounded-premium
                  text-black placeholder-grey-400
                  transition-all duration-premium
                  focus:outline-none focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20
                "
                placeholder="sam@evolvai.ie"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-black mb-2">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="
                  w-full px-4 py-3
                  bg-white border-2 border-grey-200
                  rounded-premium
                  text-black placeholder-grey-400
                  transition-all duration-premium
                  focus:outline-none focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20
                "
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className={`rounded-premium p-4 ${error.includes('email') ? 'bg-gold-50 border border-gold-200 text-gold-900' : 'bg-red-50 border border-red-200 text-red-900'}`}>
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="
                w-full px-6 py-4
                bg-gold-500 text-black
                rounded-premium
                font-semibold text-base
                transition-all duration-premium
                hover:bg-gold-600 hover:shadow-gold-glow
                active:scale-[0.98]
                disabled:opacity-50 disabled:cursor-not-allowed
                focus:outline-none focus:ring-2 focus:ring-gold-500 focus:ring-offset-2
              "
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                mode === 'login' ? 'Sign In' : 'Create Account'
              )}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'login' ? 'signup' : 'login');
                  setError(null);
                }}
                className="text-sm text-grey-600 hover:text-gold-600 transition-colors font-medium"
              >
                {mode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
              </button>
            </div>
          </form>
        </div>

        {/* Info Card */}
        <div className="mt-6 rounded-premium bg-gradient-to-r from-black to-grey-900 p-6 border border-gold-500/20">
          <p className="text-xs text-gold-100 font-medium leading-relaxed">
            <strong className="text-gold-500">Super Admin Test Account</strong>
            <br />
            Email: sam@evolvai.ie
            <br />
            (Set your password on first signup)
          </p>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-grey-500">
            Premium Property Management Platform
          </p>
        </div>
      </div>
    </div>
  );
}
