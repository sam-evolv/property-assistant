'use client';

import { Suspense, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || null;

  const supabase = createClientComponentClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    console.log('[LOGIN] Starting authentication...', { mode, email });

    try {
      if (mode === 'login') {
        console.log('[LOGIN] Calling login API...');
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (!response.ok) {
          console.error('[LOGIN] Login failed:', data.error);
          if (data.error === 'Invalid login credentials') {
            throw new Error('Invalid email or password. Please check your credentials and try again.');
          }
          throw new Error(data.error || 'Login failed');
        }

        console.log('[LOGIN] Login successful, fetching user role...');
        
        const meRes = await fetch('/api/auth/me');
        const userData = await meRes.json();
        
        if (!meRes.ok) {
          console.error('[LOGIN] User check failed:', userData);
          if (userData.error === 'not_provisioned') {
            throw new Error(`Your account (${userData.email}) is not set up for portal access. Please contact your administrator.`);
          }
          throw new Error(userData.message || 'Unable to verify account access.');
        }
        
        let finalRedirect = redirectTo;
        if (!finalRedirect) {
          if (userData.role === 'super_admin') {
            finalRedirect = '/super';
          } else if (userData.role === 'developer' || userData.role === 'admin') {
            finalRedirect = '/developer';
          } else {
            finalRedirect = '/dashboard';
          }
        }
        
        console.log('[LOGIN] Redirecting to:', finalRedirect);
        window.location.href = finalRedirect;
      } else {
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gold-50 to-indigo-100">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-lg">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            OpenHouse AI
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Unified Portal
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                placeholder="sam@evolvai.ie"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
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
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div className={`rounded-lg p-4 ${error.includes('email') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              <p className="text-sm">{error}</p>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-gold-500 hover:bg-gold-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gold-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm hover:shadow-md"
            >
              {loading ? 'Processing...' : mode === 'login' ? 'Sign in' : 'Sign up'}
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                setError(null);
              }}
              className="text-sm text-gold-600 hover:text-gold-700 font-medium"
            >
              {mode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
            </button>
          </div>
        </form>

        <div className="mt-6 rounded-lg bg-gold-50 border border-gold-200 p-4">
          <p className="text-xs text-gold-800">
            <strong>💡 Test Accounts:</strong>
            <br />
            Visit <span className="font-mono">/test-hub</span> for quick login access
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gold-50 to-indigo-100">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">🔒</div>
          <p className="text-gray-600">Loading login...</p>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
