'use client';

import { useState, FormEvent, CSSProperties, FocusEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Loader2, ArrowRight } from 'lucide-react';

const IRISH_COUNTIES = [
  'Antrim', 'Armagh', 'Carlow', 'Cavan', 'Clare', 'Cork', 'Derry', 'Donegal',
  'Down', 'Dublin', 'Fermanagh', 'Galway', 'Kerry', 'Kildare', 'Kilkenny',
  'Laois', 'Leitrim', 'Limerick', 'Longford', 'Louth', 'Mayo', 'Meath',
  'Monaghan', 'Offaly', 'Roscommon', 'Sligo', 'Tipperary', 'Tyrone',
  'Waterford', 'Westmeath', 'Wexford', 'Wicklow',
];

const inputStyle: CSSProperties = {
  backgroundColor: '#0e1116',
  border: '1px solid rgba(212, 175, 55, 0.12)',
  color: '#e4e4e7',
  outline: 'none',
};

function focusIn(e: FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.target.style.borderColor = 'rgba(212, 175, 55, 0.35)';
  e.target.style.boxShadow = '0 0 0 3px rgba(212, 175, 55, 0.08)';
}

function focusOut(e: FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.target.style.borderColor = 'rgba(212, 175, 55, 0.12)';
  e.target.style.boxShadow = 'none';
}

export default function SignupPage() {
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [schemeName, setSchemeName] = useState('');
  const [county, setCounty] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, companyName, email, password, schemeName, county }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong — please try again.');
        setSubmitting(false);
        return;
      }
      window.location.href = data.redirectTo || '/developer';
    } catch {
      setError('Network error — please try again.');
      setSubmitting(false);
    }
  };

  const labelStyle: CSSProperties = { color: '#a1a1aa' };

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden py-10"
      style={{ backgroundColor: '#050507' }}
    >
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center, #0a0a0f 0%, #050507 70%, #020203 100%)' }}
      />

      <div className="relative z-10 w-full max-w-[440px] mx-4">
        <div
          className="rounded-2xl p-8 md:p-10 overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, rgba(18, 18, 22, 0.95) 0%, rgba(12, 12, 15, 0.98) 100%)',
            border: '1px solid rgba(212, 175, 55, 0.08)',
            boxShadow: '0 25px 80px -20px rgba(0, 0, 0, 0.8), inset 0 1px 0 0 rgba(255, 255, 255, 0.03)',
          }}
        >
          <div className="flex justify-center mb-6">
            <Image
              src="/branding/openhouse-logo.png"
              alt="OpenHouse AI"
              width={180}
              height={64}
              className="h-14 w-auto object-contain"
              priority
            />
          </div>

          <h1 className="text-center text-2xl font-semibold tracking-tight" style={{ color: '#f4f4f5' }}>
            You&apos;re minutes from live.
          </h1>
          <p className="mt-2 text-center text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            An account, your first scheme — then drop in your sales sheet.
          </p>

          {error && (
            <div
              className="mt-6 rounded-xl px-4 py-3 text-sm"
              style={{
                backgroundColor: 'rgba(220, 38, 38, 0.08)',
                border: '1px solid rgba(220, 38, 38, 0.25)',
                color: '#fca5a5',
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium mb-2" style={labelStyle}>
                Your name
              </label>
              <input
                id="fullName" type="text" autoComplete="name" required
                value={fullName} onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl transition-all duration-200"
                style={inputStyle} onFocus={focusIn} onBlur={focusOut}
                placeholder="Pat Murphy"
              />
            </div>

            <div>
              <label htmlFor="companyName" className="block text-sm font-medium mb-2" style={labelStyle}>
                Company <span className="text-xs" style={{ color: '#6b7280' }}>(optional)</span>
              </label>
              <input
                id="companyName" type="text" autoComplete="organization"
                value={companyName} onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl transition-all duration-200"
                style={inputStyle} onFocus={focusIn} onBlur={focusOut}
                placeholder="Murphy Homes"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2" style={labelStyle}>
                Email
              </label>
              <input
                id="email" type="email" autoComplete="email" required
                value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl transition-all duration-200"
                style={inputStyle} onFocus={focusIn} onBlur={focusOut}
                placeholder="pat@murphyhomes.ie"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2" style={labelStyle}>
                Password
              </label>
              <input
                id="password" type="password" autoComplete="new-password" required minLength={8}
                value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl transition-all duration-200"
                style={inputStyle} onFocus={focusIn} onBlur={focusOut}
                placeholder="At least 8 characters"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="schemeName" className="block text-sm font-medium mb-2" style={labelStyle}>
                  Your scheme
                </label>
                <input
                  id="schemeName" type="text" required
                  value={schemeName} onChange={(e) => setSchemeName(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl transition-all duration-200"
                  style={inputStyle} onFocus={focusIn} onBlur={focusOut}
                  placeholder="Riverside Gardens"
                />
              </div>
              <div>
                <label htmlFor="county" className="block text-sm font-medium mb-2" style={labelStyle}>
                  County
                </label>
                <select
                  id="county" value={county} onChange={(e) => setCounty(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl transition-all duration-200 appearance-none"
                  style={inputStyle} onFocus={focusIn} onBlur={focusOut}
                >
                  <option value="">Choose…</option>
                  {IRISH_COUNTIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-xl font-semibold text-base transition-all duration-200 disabled:opacity-60"
              style={{
                background: 'linear-gradient(135deg, #D4AF37 0%, #B8934C 100%)',
                color: '#0c0c0f',
                boxShadow: '0 8px 24px -8px rgba(212, 175, 55, 0.45)',
              }}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" /> Setting you up…
                </>
              ) : (
                <>
                  Create my account <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-7 space-y-2 text-center text-sm">
            <p style={{ color: 'rgba(255,255,255,0.4)' }}>
              Already have an account?{' '}
              <Link href="/login/developer" className="font-semibold" style={{ color: '#D4AF37' }}>
                Sign in
              </Link>
            </p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Joining with an invitation code?{' '}
              <Link href="/login/developer" className="underline" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Use it here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
