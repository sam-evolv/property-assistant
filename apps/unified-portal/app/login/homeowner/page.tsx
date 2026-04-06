'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import LoginCard from '../_components/LoginCard';
import {
  inputClassName, inputStyle, labelClassName, labelStyle,
  primaryButtonClassName, primaryButtonStyle, errorStyle,
  handleInputFocus, handleInputBlur,
} from '../_components/LoginField';

export default function HomeownerLogin() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tier = searchParams.get('tier');
  const [email, setEmail] = useState('');
  const [propertyCode, setPropertyCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/portal-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portal: 'homeowner',
          email: email.trim().toLowerCase(),
          propertyCode: propertyCode.toUpperCase().trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed. Please try again.');
        setLoading(false);
        return;
      }

      if (data.redirect) {
        router.push(data.redirect);
      }
    } catch (err) {
      setError('Connection error. Please try again.');
      setLoading(false);
    }
  }

  const title = tier === 'select' ? 'OpenHouse Select' : 'Welcome Home';
  const subtitle = tier === 'select'
    ? 'Access your custom build portal'
    : 'Access your property information';

  return (
    <LoginCard title={title} subtitle={subtitle}>
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
          {loading ? 'Signing in...' : 'Continue'}
        </button>

        <p className="text-center text-sm" style={{ color: '#6b7280', margin: 0 }}>
          First time? Your property code is in your welcome pack.
        </p>
      </form>
    </LoginCard>
  );
}
