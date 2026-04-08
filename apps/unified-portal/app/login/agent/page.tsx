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

export default function AgentLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (authError || !data.session) {
      setError('Incorrect email or password.');
      setLoading(false);
      return;
    }

    // Verify this user has an agent profile
    const { data: profile } = await supabase
      .from('agent_profiles')
      .select('id, display_name, agency_name')
      .eq('user_id', data.session.user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!profile) {
      await supabase.auth.signOut();
      setError("No agent account found for this email. Contact your agency admin.");
      setLoading(false);
      return;
    }

    // Upsert user_contexts row
    await supabase.from('user_contexts').upsert({
      auth_user_id: data.session.user.id,
      product: 'agent',
      context_type: 'agent_profile',
      context_id: profile.id,
      display_name: profile.agency_name || profile.display_name,
      display_subtitle: 'Estate Agent',
      display_icon: 'briefcase',
      last_active_at: new Date().toISOString(),
    }, { onConflict: 'auth_user_id,context_type,context_id' });

    // Device-aware routing — mobile gets the app, desktop gets the dashboard
    const isMobile = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i
      .test(navigator.userAgent);
    router.push(isMobile ? '/agent/home' : '/agent/dashboard');
  }

  return (
    <LoginCard title="Agent Login" subtitle="Access your sales pipeline">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="agent-email" className={labelClassName} style={labelStyle}>Email Address</label>
          <input
            id="agent-email"
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@agency.ie"
            className={inputClassName}
            style={inputStyle}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
          />
        </div>

        <div>
          <label htmlFor="agent-password" className={labelClassName} style={labelStyle}>Password</label>
          <div className="relative">
            <input
              id="agent-password"
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              className={inputClassName}
              style={{ ...inputStyle, paddingRight: 48 }}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
              style={{ color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}
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

        {error && (
          <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(127, 29, 29, 0.2)', border: '1px solid rgba(185, 28, 28, 0.3)' }}>
            <p className="text-sm" style={errorStyle}>{error}</p>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <a href="/login/developer?forgot=1" className="text-sm transition-colors" style={{ color: '#b8934c', textDecoration: 'none' }}>
            Forgot password?
          </a>
        </div>

        <button
          type="submit"
          disabled={loading}
          className={primaryButtonClassName}
          style={{ ...primaryButtonStyle, opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

        <p className="text-center text-sm" style={{ color: '#6b7280', margin: 0 }}>
          Need access?{' '}
          <a href="mailto:hello@openhouseai.ie" style={{ color: '#b8934c', textDecoration: 'none' }}>
            Contact your agency admin
          </a>
        </p>
      </form>
    </LoginCard>
  );
}
