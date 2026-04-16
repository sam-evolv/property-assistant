'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import LoginCard from '../_components/LoginCard';
import {
  inputClassName, inputStyle, labelClassName, labelStyle,
  primaryButtonClassName, primaryButtonStyle, errorStyle,
  handleInputFocus, handleInputBlur,
} from '../_components/LoginField';

type Step = 'form' | 'check-email' | 'admin-password';

export default function CareLogin() {
  return (
    <Suspense fallback={null}>
      <CareLoginInner />
    </Suspense>
  );
}

function CareLoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams?.get('next') ?? null;

  const [step, setStep] = useState<Step>(nextParam ? 'admin-password' : 'form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const hasSupabaseClientEnv =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const supabase = hasSupabaseClientEnv ? createClientComponentClient() : null;

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setError('');

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (authError || !data.session) {
      setError('Incorrect password.');
      setLoading(false);
      return;
    }

    // Verify admin role via server-side API (bypasses RLS)
    const meRes = await fetch('/api/auth/me');
    const meData = meRes.ok ? await meRes.json() : null;

    if (!meData || !['super_admin', 'developer', 'admin'].includes(meData.role)) {
      await supabase.auth.signOut();
      setError('Admin access required.');
      setLoading(false);
      return;
    }

    if (nextParam) {
      router.push(nextParam);
      return;
    }

    // Find any installation to use as demo context
    const { data: installation } = await supabase
      .from('installations')
      .select('id, address_line_1, system_type')
      .limit(1)
      .single();

    if (installation) {
      await supabase.from('user_contexts').upsert({
        auth_user_id: data.session.user.id,
        product: 'care',
        context_type: 'installation',
        context_id: installation.id,
        display_name: installation.address_line_1 || 'Test Installation',
        display_subtitle: installation.system_type || 'Energy System (Admin Access)',
        display_icon: 'sun',
        last_active_at: new Date().toISOString(),
      }, { onConflict: 'auth_user_id,context_type,context_id' });

      router.push(`/care/${installation.id}`);
    } else {
      router.push('/care-dashboard');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setError('Authentication is temporarily unavailable.');
      return;
    }
    setLoading(true);
    setError('');

    // Standard care flow — find installation by customer email, send magic link
    const { data: installation } = await supabase
      .from('installations')
      .select('id, address_line_1, system_type')
      .eq('customer_email', email.trim().toLowerCase())
      .single();

    if (!installation) {
      setError("We couldn't find a portal for that email. Contact your installer.");
      setLoading(false);
      return;
    }

    const redirectTo = `${window.location.origin}/auth/callback?context=care&installation_id=${installation.id}`;

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: redirectTo },
    });

    if (otpError) {
      setError("Couldn't send the link. Please try again.");
      setLoading(false);
      return;
    }

    setStep('check-email');
    setLoading(false);
  }

  if (step === 'check-email') {
    return (
      <LoginCard title="Check your email" subtitle={`Access link sent to ${email}`} showBack={false}>
        <div className="text-center py-2 pb-4">
          <div style={{ fontSize: 48, marginBottom: 20 }}>&#x1F4EC;</div>
          <p className="text-sm mb-7" style={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
            Tap the link in your email to access your energy portal. No password needed.
          </p>
          <button
            onClick={() => setStep('form')}
            className="text-sm transition-colors"
            style={{ background: 'none', border: 'none', color: '#b8934c', cursor: 'pointer', fontFamily: 'inherit' }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#d4af37'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#b8934c'}
          >
            &larr; Try a different email
          </button>
        </div>
      </LoginCard>
    );
  }

  if (step === 'admin-password') {
    return (
      <LoginCard title="Your Energy Portal" subtitle="Admin access — enter your password">
        <form onSubmit={handleAdminLogin} className="space-y-5">
          <div>
            <label htmlFor="care-email-admin" className={labelClassName} style={labelStyle}>Email Address</label>
            <input
              id="care-email-admin"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className={inputClassName}
              style={inputStyle}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
            />
          </div>

          <div>
            <label htmlFor="care-password" className={labelClassName} style={labelStyle}>Password</label>
            <input
              id="care-password"
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              className={inputClassName}
              style={inputStyle}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              autoFocus
            />
          </div>

          {error && (
            <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(127, 29, 29, 0.2)', border: '1px solid rgba(185, 28, 28, 0.3)' }}>
              <p className="text-sm" style={errorStyle}>{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={primaryButtonClassName}
            style={{ ...primaryButtonStyle, marginTop: 8, opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <button
            type="button"
            onClick={() => { setStep('form'); setError(''); setPassword(''); }}
            className="text-center text-sm w-full transition-colors"
            style={{ color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            &larr; Back
          </button>
        </form>
      </LoginCard>
    );
  }

  return (
    <LoginCard title="Your Energy Portal" subtitle="Monitor and manage your system">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="care-email" className={labelClassName} style={labelStyle}>Your email address</label>
          <input
            id="care-email"
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={inputClassName}
            style={inputStyle}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
          />
        </div>

        {error && (
          <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(127, 29, 29, 0.2)', border: '1px solid rgba(185, 28, 28, 0.3)' }}>
            <p className="text-sm" style={errorStyle}>{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className={primaryButtonClassName}
          style={{ ...primaryButtonStyle, marginTop: 8, opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          {loading ? 'Sending...' : 'Send access link'}
        </button>

        <div className="text-center mt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16 }}>
          <button
            type="button"
            onClick={() => { setStep('admin-password'); setError(''); }}
            className="text-sm transition-colors"
            style={{ color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#a1a1aa'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#6b7280'}
          >
            Admin / developer? Sign in with password
          </button>
        </div>
      </form>
    </LoginCard>
  );
}
