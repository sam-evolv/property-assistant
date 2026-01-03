'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { usePurchaserSession } from '@/contexts/PurchaserContext';
import { Home, ArrowRight, Loader2 } from 'lucide-react';

export default function PurchaserLoginPage() {
  const router = useRouter();
  const { session, isLoading, login, logout } = usePurchaserSession();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Clear any existing session when visiting the login page
    // This allows users to log in with a different code
    if (session) {
      logout();
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/purchaser/auth/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Invalid code');
        setIsSubmitting(false);
        return;
      }

      login(data.session);
      // Redirect directly to the same /homes portal that QR codes use
      router.push(`/homes/${data.session.unitId}?token=${encodeURIComponent(data.session.token)}`);
    } catch (err) {
      setError('Connection error. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gold-500 animate-spin" />
      </div>
    );
  }

  if (session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Image
            src="/branding/openhouse-logo.png"
            alt="OpenHouse AI"
            width={200}
            height={60}
            className="h-16 w-auto object-contain"
            priority
          />
        </div>

        <div className="bg-grey-900/50 rounded-2xl p-8 border border-grey-800">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gold-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Home className="w-8 h-8 text-gold-500" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">
              Welcome Home
            </h1>
            <p className="text-grey-400 text-sm">
              Enter your OpenHouse code to access your home
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-grey-300 mb-2">
                OpenHouse Code
              </label>
              <input
                type="text"
                id="code"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setError(null);
                }}
                placeholder="e.g. LV-PARK-001"
                className="w-full px-4 py-3 bg-grey-800 border border-grey-700 rounded-xl text-white placeholder-grey-500 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent text-center text-lg font-mono tracking-wider"
                autoComplete="off"
                autoFocus
                disabled={isSubmitting}
              />
              {error && (
                <p className="mt-2 text-sm text-red-400 text-center">{error}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !code.trim()}
              className="w-full py-3 px-4 bg-gold-500 hover:bg-gold-600 disabled:bg-grey-700 disabled:cursor-not-allowed text-black font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  Access my home
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-xs text-grey-500 text-center">
            Your code was provided by your property developer
          </p>
        </div>
      </div>
    </div>
  );
}
