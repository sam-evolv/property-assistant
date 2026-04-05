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

export default function HomeownerLogin() {
  const [step, setStep] = useState<Step>('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [propertyCode, setPropertyCode] = useState('');
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

      // Find any unit to use as demo context, or use tenant as context
      const { data: unit } = await supabase
        .from('units')
        .select('id, address_line_1')
        .limit(1)
        .single();

      if (unit) {
        await supabase.from('user_contexts').upsert({
          auth_user_id: data.session.user.id,
          product: 'homeowner',
          context_type: 'unit',
          context_id: unit.id,
          display_name: unit.address_line_1 || 'Test Property',
          display_subtitle: 'Homeowner (Admin Access)',
          display_icon: 'home',
          last_active_at: new Date().toISOString(),
        }, { onConflict: 'auth_user_id,context_type,context_id' });

        router.push(`/homes/${unit.id}`);
      } else {
        // No units in DB — just go to homes root
        router.push('/homes');
      }
      return;
    }

    // Standard homeowner flow — verify property code, send magic link
    // 1. Verify property code exists
    const { data: unit, error: unitError } = await supabase
      .from('units')
      .select('id, address_line_1, unit_code')
      .eq('unit_code', propertyCode.toUpperCase().trim())
      .single();

    if (unitError || !unit) {
      setError("Property code not found. Check your welcome pack or contact your developer.");
      setLoading(false);
      return;
    }

    // 2. Send magic link
    const redirectTo = `${window.location.origin}/auth/callback?context=homeowner&unit_id=${unit.id}`;

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: redirectTo,
        data: { product: 'homeowner', unit_id: unit.id },
      },
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
      <LoginCard title="Check your email" subtitle={`We've sent a link to ${email}`} showBack={false}>
        <div className="text-center py-2 pb-4">
          <div style={{ fontSize: 48, marginBottom: 20 }}>&#x1F4EC;</div>
          <p className="text-sm mb-7" style={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
            Tap the link in your email to access your property portal. The link expires in 1 hour.
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
      <LoginCard title="Welcome Home" subtitle="Admin access — enter your password">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="ho-email-admin" className={labelClassName} style={labelStyle}>Email Address</label>
            <input
              id="ho-email-admin"
              type="email"
              value={email}
              disabled
              className={inputClassName}
              style={{ ...inputStyle, opacity: 0.6 }}
            />
          </div>

          <div>
            <label htmlFor="ho-password" className={labelClassName} style={labelStyle}>Password</label>
            <input
              id="ho-password"
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
    <LoginCard title="Welcome Home" subtitle="Access your property information">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="ho-email" className={labelClassName} style={labelStyle}>Your email address</label>
          <input
            id="ho-email"
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

        <div>
          <label htmlFor="ho-code" className={labelClassName} style={labelStyle}>Property code</label>
          <input
            id="ho-code"
            type="text"
            required
            value={propertyCode}
            onChange={e => setPropertyCode(e.target.value.toUpperCase())}
            placeholder="e.g. OHR-2024-001"
            className={inputClassName}
            style={{ ...inputStyle, fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase' as const }}
            maxLength={20}
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
          {loading ? 'Checking...' : 'Continue'}
        </button>

        <p className="text-center text-sm" style={{ color: '#6b7280', margin: 0 }}>
          First time? Your property code is in your welcome pack.
        </p>
      </form>
    </LoginCard>
  );
}
