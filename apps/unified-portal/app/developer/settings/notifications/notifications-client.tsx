'use client';

/**
 * Sprint 3.5a notifications settings client. Single field for the
 * aftercare email address. Save persists via POST /api/settings/notifications
 * and shows a 2-second inline confirmation.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail, Loader2, CheckCircle2 } from 'lucide-react';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function NotificationsSettingsClient() {
  const [email, setEmail] = useState('');
  const [originalEmail, setOriginalEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/settings/notifications', { cache: 'no-store' });
        if (!res.ok) {
          if (!cancelled) setError('Could not load settings.');
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        const value = (data?.aftercare_email as string | null) ?? '';
        setEmail(value);
        setOriginalEmail(value);
      } catch {
        if (!cancelled) setError('Could not load settings.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (savedAt === null) return;
    const timer = setTimeout(() => setSavedAt(null), 2000);
    return () => clearTimeout(timer);
  }, [savedAt]);

  const trimmed = email.trim();
  const isEmpty = trimmed.length === 0;
  const isValid = isEmpty || EMAIL_RE.test(trimmed);
  const dirty = trimmed !== originalEmail.trim();
  const canSave = isValid && dirty && !saving && !loading;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/settings/notifications', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ aftercare_email: isEmpty ? null : trimmed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? 'Could not save settings');
      }
      const data = await res.json();
      const saved = (data?.aftercare_email as string | null) ?? '';
      setEmail(saved);
      setOriginalEmail(saved);
      setSavedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-white via-grey-50 to-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Link
          href="/developer"
          className="text-gold-500 hover:text-gold-600 flex items-center gap-1 mb-3 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Notifications</h1>
        <p className="text-gray-600 mb-8">
          Where should new homeowner-raised issues be sent?
        </p>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center gap-2">
            <Mail className="w-5 h-5 text-gold-500" />
            <h2 className="font-semibold text-gray-900">Aftercare email</h2>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label
                htmlFor="aftercare_email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Aftercare email address
              </label>
              <input
                id="aftercare_email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. aftercare@example.com"
                disabled={loading || saving}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500/40 focus:border-gold-400 text-sm disabled:bg-gray-50"
              />
              <p className="text-xs text-gray-500 mt-2">
                When a homeowner uploads a photo or raises an issue through the assistant, we will send an email to this address with the photo, the homeowner&apos;s details, and a link to the dashboard. Leave blank to disable email notifications.
              </p>
              {!isValid && !isEmpty && (
                <p className="text-xs text-red-600 mt-2">Enter a valid email address.</p>
              )}
              {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={!canSave}
                className="px-4 py-2 text-sm font-medium text-white bg-gold-500 hover:bg-gold-600 rounded-lg transition disabled:bg-gold-300 disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Save
              </button>
              {savedAt !== null && (
                <span className="inline-flex items-center gap-1.5 text-sm text-green-700">
                  <CheckCircle2 className="w-4 h-4" />
                  Saved.
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
