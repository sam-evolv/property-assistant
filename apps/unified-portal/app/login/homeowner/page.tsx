'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import LoginCard from '../_components/LoginCard';
import {
  inputClassName,
  inputStyle,
  labelClassName,
  labelStyle,
  primaryButtonClassName,
  primaryButtonStyle,
  errorStyle,
  handleInputFocus,
  handleInputBlur,
} from '../_components/LoginField';

type Step = 'code' | 'confirm' | 'signin' | 'admin-password';

interface UnitInfo {
  unitId: string;
  address: string;
  name: string;
}

export default function HomeownerLogin() {
  const [step, setStep] = useState<Step>('code');

  // Screen 1 — property code
  const [propertyCode, setPropertyCode] = useState('');

  // Screen 2 — confirm + register
  const [unitInfo, setUnitInfo] = useState<UnitInfo | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Screen 3 — return sign-in
  const [siEmail, setSiEmail] = useState('');
  const [siPassword, setSiPassword] = useState('');

  // Admin screen
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const hasSupabaseClientEnv =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const supabase = hasSupabaseClientEnv ? createClientComponentClient() : null;

  // ─── Screen 1: Property code lookup ─────────────────────────────────────────

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/homeowner/lookup-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: propertyCode }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || 'Code not found. Check your handover pack.');
      return;
    }

    if (data.alreadyRegistered) {
      // Unit already has an account — send them to the sign-in screen
      setStep('signin');
      return;
    }

    setUnitInfo({ unitId: data.unitId, address: data.address, name: data.name });
    setStep('confirm');
  }

  // ─── Screen 2: Confirm address + create account ──────────────────────────────

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    setError('');

    const res = await fetch('/api/homeowner/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unitId: unitInfo!.unitId, email, password }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || 'Registration failed. Please try again.');
      return;
    }

    if (data.redirect) {
      router.push(data.redirect);
    }
  }

  // ─── Screen 3: Return sign-in ────────────────────────────────────────────────

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setError('Authentication is temporarily unavailable.');
      return;
    }
    setLoading(true);
    setError('');

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: siEmail.trim().toLowerCase(),
      password: siPassword,
    });

    if (authError || !data.session) {
      setError('Incorrect email or password.');
      setLoading(false);
      return;
    }

    // Look up homeowner context to find their unit
    const { data: ctx } = await supabase
      .from('user_contexts')
      .select('context_id')
      .eq('product', 'homeowner')
      .limit(1)
      .single();

    if (ctx?.context_id) {
      router.push(`/homes/${ctx.context_id}`);
    } else {
      router.push('/homes');
    }
  }

  // ─── Admin login (unchanged from previous flow) ──────────────────────────────

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setError('');

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: adminEmail.trim().toLowerCase(),
      password: adminPassword,
    });

    if (authError || !data.session) {
      setError('Incorrect password.');
      setLoading(false);
      return;
    }

    const meRes = await fetch('/api/auth/me');
    const meData = meRes.ok ? await meRes.json() : null;

    if (!meData || !['super_admin', 'developer', 'admin'].includes(meData.role)) {
      await supabase.auth.signOut();
      setError('Admin access required.');
      setLoading(false);
      return;
    }

    const { data: ownUnit } = await supabase
      .from('units')
      .select('id, address_line_1')
      .eq('purchaser_email', adminEmail.trim().toLowerCase())
      .limit(1)
      .single();

    const unitFallback = ownUnit
      ? ownUnit
      : (await supabase.from('units').select('id, address_line_1').limit(1).single()).data;

    if (unitFallback) {
      await supabase.from('user_contexts').upsert(
        {
          auth_user_id: data.session.user.id,
          product: 'homeowner',
          context_type: 'unit',
          context_id: unitFallback.id,
          display_name: unitFallback.address_line_1 || 'Test Property',
          display_subtitle: 'Homeowner (Admin Access)',
          display_icon: 'home',
          last_active_at: new Date().toISOString(),
        },
        { onConflict: 'auth_user_id,context_type,context_id' }
      );
      router.push(`/homes/${unitFallback.id}`);
    } else {
      router.push('/homes');
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (step === 'admin-password') {
    return (
      <LoginCard title="Welcome Home" subtitle="Admin access — enter your password">
        <form onSubmit={handleAdminLogin} className="space-y-5">
          <div>
            <label htmlFor="admin-email" className={labelClassName} style={labelStyle}>
              Email Address
            </label>
            <input
              id="admin-email"
              type="email"
              required
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="you@example.com"
              className={inputClassName}
              style={inputStyle}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="admin-password" className={labelClassName} style={labelStyle}>
              Password
            </label>
            <input
              id="admin-password"
              type="password"
              required
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Enter your password"
              className={inputClassName}
              style={inputStyle}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
            />
          </div>

          {error && (
            <div
              className="rounded-xl p-4"
              style={{
                backgroundColor: 'rgba(127, 29, 29, 0.2)',
                border: '1px solid rgba(185, 28, 28, 0.3)',
              }}
            >
              <p className="text-sm" style={errorStyle}>
                {error}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={primaryButtonClassName}
            style={{
              ...primaryButtonStyle,
              marginTop: 8,
              opacity: loading ? 0.6 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <button
            type="button"
            onClick={() => {
              setStep('code');
              setError('');
              setAdminEmail('');
              setAdminPassword('');
            }}
            className="text-center text-sm w-full transition-colors"
            style={{
              color: '#6b7280',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            &larr; Back
          </button>
        </form>
      </LoginCard>
    );
  }

  if (step === 'confirm' && unitInfo) {
    return (
      <LoginCard
        title="Is this your home?"
        subtitle={unitInfo.address || 'Confirm your address below'}
        showBack={false}
      >
        <form onSubmit={handleRegister} className="space-y-5">
          {unitInfo.name && (
            <p
              className="text-center text-sm -mt-4 mb-2"
              style={{ color: 'rgba(255,255,255,0.4)' }}
            >
              {unitInfo.name}
            </p>
          )}

          <div>
            <label htmlFor="reg-email" className={labelClassName} style={labelStyle}>
              Your email address
            </label>
            <input
              id="reg-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={inputClassName}
              style={inputStyle}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="reg-password" className={labelClassName} style={labelStyle}>
              Choose a password
            </label>
            <input
              id="reg-password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className={inputClassName}
              style={inputStyle}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
            />
          </div>

          <div>
            <label htmlFor="reg-confirm" className={labelClassName} style={labelStyle}>
              Confirm password
            </label>
            <input
              id="reg-confirm"
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat your password"
              className={inputClassName}
              style={inputStyle}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
            />
          </div>

          {error && (
            <div
              className="rounded-xl p-4"
              style={{
                backgroundColor: 'rgba(127, 29, 29, 0.2)',
                border: '1px solid rgba(185, 28, 28, 0.3)',
              }}
            >
              <p className="text-sm" style={errorStyle}>
                {error}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={primaryButtonClassName}
            style={{
              ...primaryButtonStyle,
              marginTop: 8,
              opacity: loading ? 0.6 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Creating your account...' : 'Create my account'}
          </button>

          <button
            type="button"
            onClick={() => {
              setStep('code');
              setError('');
              setEmail('');
              setPassword('');
              setConfirmPassword('');
            }}
            className="text-center text-sm w-full transition-colors"
            style={{
              color: '#6b7280',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            &larr; Different code
          </button>
        </form>
      </LoginCard>
    );
  }

  if (step === 'signin') {
    return (
      <LoginCard title="Welcome back" subtitle="Sign in with your email and password">
        <form onSubmit={handleSignIn} className="space-y-5">
          <div>
            <label htmlFor="si-email" className={labelClassName} style={labelStyle}>
              Email address
            </label>
            <input
              id="si-email"
              type="email"
              required
              value={siEmail}
              onChange={(e) => setSiEmail(e.target.value)}
              placeholder="you@example.com"
              className={inputClassName}
              style={inputStyle}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="si-password" className={labelClassName} style={labelStyle}>
              Password
            </label>
            <input
              id="si-password"
              type="password"
              required
              value={siPassword}
              onChange={(e) => setSiPassword(e.target.value)}
              placeholder="Your password"
              className={inputClassName}
              style={inputStyle}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
            />
          </div>

          {error && (
            <div
              className="rounded-xl p-4"
              style={{
                backgroundColor: 'rgba(127, 29, 29, 0.2)',
                border: '1px solid rgba(185, 28, 28, 0.3)',
              }}
            >
              <p className="text-sm" style={errorStyle}>
                {error}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={primaryButtonClassName}
            style={{
              ...primaryButtonStyle,
              marginTop: 8,
              opacity: loading ? 0.6 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>

          <div
            className="text-center mt-4"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16 }}
          >
            <button
              type="button"
              onClick={() => {
                setStep('code');
                setError('');
                setSiEmail('');
                setSiPassword('');
              }}
              className="text-sm transition-colors"
              style={{
                color: '#6b7280',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#a1a1aa')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#6b7280')}
            >
              First time? Enter your property code
            </button>
          </div>
        </form>
      </LoginCard>
    );
  }

  // ─── Default: Screen 1 — Property code entry ─────────────────────────────────

  return (
    <LoginCard
      title="Welcome to your new home"
      subtitle="Enter the property code from your handover pack"
    >
      <form onSubmit={handleCodeSubmit} className="space-y-5">
        <div>
          <label htmlFor="property-code" className={labelClassName} style={labelStyle}>
            Property code
          </label>
          <input
            id="property-code"
            type="text"
            required
            value={propertyCode}
            onChange={(e) => setPropertyCode(e.target.value.toUpperCase())}
            placeholder="AV-000-0000"
            className={inputClassName}
            style={{
              ...inputStyle,
              fontFamily: 'monospace',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              textAlign: 'center',
              fontSize: '1.1rem',
            }}
            maxLength={20}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            autoFocus
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        {error && (
          <div
            className="rounded-xl p-4"
            style={{
              backgroundColor: 'rgba(127, 29, 29, 0.2)',
              border: '1px solid rgba(185, 28, 28, 0.3)',
            }}
          >
            <p className="text-sm" style={errorStyle}>
              {error}
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !propertyCode.trim()}
          className={primaryButtonClassName}
          style={{
            ...primaryButtonStyle,
            marginTop: 8,
            opacity: loading || !propertyCode.trim() ? 0.6 : 1,
            cursor: loading || !propertyCode.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Checking...' : 'Continue'}
        </button>

        <div
          className="text-center mt-4"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16 }}
        >
          <button
            type="button"
            onClick={() => {
              setStep('signin');
              setError('');
              setPropertyCode('');
            }}
            className="text-sm transition-colors"
            style={{
              color: '#6b7280',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#a1a1aa')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#6b7280')}
          >
            Already registered? Sign in
          </button>
        </div>

        <div className="text-center">
          <button
            type="button"
            onClick={() => {
              setStep('admin-password');
              setError('');
            }}
            className="text-sm transition-colors"
            style={{
              color: '#4b5563',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#6b7280')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#4b5563')}
          >
            Admin / developer? Sign in with password
          </button>
        </div>
      </form>
    </LoginCard>
  );
}
