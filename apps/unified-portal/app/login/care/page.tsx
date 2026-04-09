'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import LoginCard from '../_components/LoginCard';
import {
  inputClassName, inputStyle, labelClassName, labelStyle,
  primaryButtonClassName, primaryButtonStyle, errorStyle,
  handleInputFocus, handleInputBlur,
} from '../_components/LoginField';

export default function CareLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
          portal: 'care',
          email: email.trim().toLowerCase(),
          password,
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

        <div>
          <label htmlFor="care-password" className={labelClassName} style={labelStyle}>Password</label>
          <input
            id="care-password"
            type="password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Your password"
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
          {loading ? 'Signing in...' : 'Sign in'}
        </button>

        <p className="text-center text-sm" style={{ color: '#6b7280', margin: 0 }}>
          Your login was provided by your installer.
        </p>
      </form>
    </LoginCard>
  );
}
