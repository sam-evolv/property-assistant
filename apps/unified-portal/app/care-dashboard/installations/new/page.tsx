'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Copy, ExternalLink } from 'lucide-react';

const IRISH_COUNTIES = [
  'Carlow', 'Cavan', 'Clare', 'Cork', 'Donegal', 'Dublin', 'Galway',
  'Kerry', 'Kildare', 'Kilkenny', 'Laois', 'Leitrim', 'Limerick',
  'Longford', 'Louth', 'Mayo', 'Meath', 'Monaghan', 'Offaly',
  'Roscommon', 'Sligo', 'Tipperary', 'Waterford', 'Westmeath',
  'Wexford', 'Wicklow',
];

const SYSTEM_TYPES = [
  { value: 'solar_pv', label: 'Solar PV' },
  { value: 'heat_pump', label: 'Heat Pump' },
  { value: 'ev_charger', label: 'EV Charger' },
];

interface CreatedInstallation {
  id: string;
  access_code: string;
  customer_name: string;
}

export default function NewInstallationPage() {
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<CreatedInstallation | null>(null);
  const [copied, setCopied] = useState(false);

  // Form state
  const [form, setForm] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    address_line_1: '',
    city: '',
    county: '',
    system_type: 'solar_pv',
    system_size_kwp: '',
    inverter_model: '',
    panel_model: '',
    panel_count: '',
    install_date: '',
    job_reference: '',
  });

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/care/installations/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          system_size_kwp: form.system_size_kwp ? Number(form.system_size_kwp) : null,
          panel_count: form.panel_count ? Number(form.panel_count) : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create installation');
      }

      const data = await res.json();
      setCreated(data.installation);
      setStep('success');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const copyCode = async () => {
    if (!created?.access_code) return;
    await navigator.clipboard.writeText(created.access_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (step === 'success' && created) {
    return (
      <div className="min-h-full bg-gray-50">
        <div className="p-6 lg:p-8">
          <div className="max-w-lg mx-auto">
            <div className="bg-white border border-gold-100 rounded-xl shadow-sm p-8 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                <Check className="w-7 h-7 text-emerald-600" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 mb-2">Installation Created</h1>
              <p className="text-sm text-gray-500 mb-6">
                Share this access code with {created.customer_name} so they can access their homeowner portal.
              </p>

              {/* Access Code */}
              <div className="bg-gray-50 rounded-xl p-6 mb-6">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Access Code</p>
                <p className="text-3xl font-bold font-mono tracking-widest text-gray-900 mb-3">
                  {created.access_code}
                </p>
                <button
                  onClick={copyCode}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy Code'}
                </button>
              </div>

              <div className="flex flex-col gap-3">
                <a
                  href={`/care/${created.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                  style={{ background: 'linear-gradient(135deg, #D4AF37, #B8934C)' }}
                >
                  <ExternalLink className="w-4 h-4" />
                  Preview Homeowner Portal
                </a>
                <Link
                  href="/care-dashboard/installations"
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Installations
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gray-50">
      <div className="p-6 lg:p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <Link
              href="/care-dashboard/installations"
              className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Installations
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">New Installation</h1>
            <p className="text-sm text-gray-500 mt-1">Register a new customer installation</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Customer Details */}
            <div className="bg-white border border-gold-100 rounded-xl shadow-sm p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Customer Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={form.customer_name}
                    onChange={(e) => set('customer_name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37] outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                  <input
                    type="email"
                    value={form.customer_email}
                    onChange={(e) => set('customer_email', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37] outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={form.customer_phone}
                    onChange={(e) => set('customer_phone', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37] outline-none transition-all"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Address *</label>
                  <input
                    type="text"
                    required
                    value={form.address_line_1}
                    onChange={(e) => set('address_line_1', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37] outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">City *</label>
                  <input
                    type="text"
                    required
                    value={form.city}
                    onChange={(e) => set('city', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37] outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">County</label>
                  <select
                    value={form.county}
                    onChange={(e) => set('county', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37] outline-none transition-all bg-white"
                  >
                    <option value="">Select county...</option>
                    {IRISH_COUNTIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* System Details */}
            <div className="bg-white border border-gold-100 rounded-xl shadow-sm p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">System Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">System Type</label>
                  <select
                    value={form.system_type}
                    onChange={(e) => set('system_type', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37] outline-none transition-all bg-white"
                  >
                    {SYSTEM_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">System Size (kWp)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.system_size_kwp}
                    onChange={(e) => set('system_size_kwp', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37] outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Inverter Model</label>
                  <input
                    type="text"
                    value={form.inverter_model}
                    onChange={(e) => set('inverter_model', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37] outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Panel Model</label>
                  <input
                    type="text"
                    value={form.panel_model}
                    onChange={(e) => set('panel_model', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37] outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Panel Count</label>
                  <input
                    type="number"
                    min="0"
                    value={form.panel_count}
                    onChange={(e) => set('panel_count', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37] outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Install Date</label>
                  <input
                    type="date"
                    value={form.install_date}
                    onChange={(e) => set('install_date', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37] outline-none transition-all"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Job Reference *</label>
                  <input
                    type="text"
                    required
                    value={form.job_reference}
                    onChange={(e) => set('job_reference', e.target.value)}
                    placeholder="e.g. SE-2026-0312"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37] outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #D4AF37, #B8934C)' }}
            >
              {submitting ? 'Creating...' : 'Create Installation'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
