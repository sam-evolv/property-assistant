'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import LoginCard from '../_components/LoginCard';
import {
  inputClassName, inputStyle, labelClassName, labelStyle,
  primaryButtonClassName, primaryButtonStyle, errorStyle,
  handleInputFocus, handleInputBlur,
} from '../_components/LoginField';

type Step = 'form' | 'check-email' | 'admin-password';

export default function CareLogin() {
  const [step, setStep] = useState<Step>('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const hasSupabaseClientEnv =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const supabase = hasSupabaseClientEnv ? createClientComponentClient() : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setError('Authentication is temporarily unavailable.');
      return;
    }
    setLoading(true);
    setError('');

    // Check if this email belongs to an admin (for testing access)
    const { data: admin } = await supabase
      .from('admins')
      .select('id, role, tenant_id')
      .eq('email', email.trim().toLowerCase())
      .single();

    if (admin && ['super_admin', 'developer', 'admin'].includes(admin.role)) {
      // Admin user — switch to password login mode
      if (step !== 'admin-password') {
        setStep('admin-password');
        setLoading(false);
        return;
      }

      // Admin password login
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (authError || !data.session) {
        setError('Incorrect password.');
        setLoading(false);
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
      return;
    }

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
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="care-email-admin" className={labelClassName} style={labelStyle}>Email Address</label>
            <input
              id="care-email-admin"
              type="email"
              value={email}
              disabled
              className={inputClassName}
              style={{ ...inputStyle, opacity: 0.6 }}
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

        <p className="text-center text-sm" style={{ color: '#6b7280', margin: 0 }}>
          We&apos;ll email you a secure link. No password needed.
        </p>
      </form>
    </LoginCard>
  );
}
