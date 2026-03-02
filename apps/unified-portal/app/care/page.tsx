'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function CareAccessPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/care/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });

      if (!res.ok) {
        setError('Invalid access code. Please check and try again.');
        setLoading(false);
        inputRef.current?.focus();
        return;
      }

      const { installationId } = await res.json();
      router.push(`/care/${installationId}`);
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-white">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-grey-200 bg-white">
        <div className="flex items-center px-4 py-2.5 max-w-4xl mx-auto">
          <Image
            src="/branding/openhouse-ai-logo.png"
            alt="OpenHouse AI"
            width={100}
            height={30}
            className="h-8 w-auto object-contain"
          />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm space-y-8">
          {/* Icon */}
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-2xl bg-[#D4AF37]/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-[#D4AF37]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
              </svg>
            </div>
          </div>

          {/* Heading */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-semibold text-gray-900">Welcome to OpenHouse Care</h1>
            <p className="text-gray-500 text-sm leading-relaxed">
              Enter the access code from your installation handover to get started.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                ref={inputRef}
                type="text"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setError('');
                }}
                placeholder="e.g. HEATPUMP01"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                className="w-full px-4 py-3.5 text-center text-lg font-mono tracking-widest rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40 focus:border-[#D4AF37] transition-all placeholder:text-gray-300 placeholder:tracking-normal placeholder:font-sans placeholder:text-base"
              />
              {error && (
                <p className="mt-2 text-sm text-red-500 text-center">{error}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={!code.trim() || loading}
              className="w-full py-3.5 rounded-xl bg-[#D4AF37] text-white font-medium text-base transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Verifying...
                </span>
              ) : (
                'Access My System'
              )}
            </button>
          </form>

          {/* Footer hint */}
          <p className="text-center text-xs text-gray-400">
            Access code provided by your installer at handover
          </p>
        </div>
      </main>
    </div>
  );
}
