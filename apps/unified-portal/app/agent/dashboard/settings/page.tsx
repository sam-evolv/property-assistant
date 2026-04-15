'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Smartphone, Building, LogOut } from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useAgentDashboard } from '../layout-provider';

export const dynamic = 'force-dynamic';
const tokens = { gold: '#D4AF37', cream: '#fafaf8', dark: '#1a1a1a' };

export default function AgentDashboardSettingsPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const { profile } = useAgentDashboard();

  const [form, setForm] = useState({ displayName: profile.display_name || '', agencyName: profile.agency_name || '', email: '', phone: '', psra: '', agentType: profile.agent_type || 'scheme', tone: 'professional' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { (async () => { const { data: { user } } = await supabase.auth.getUser(); if (user) { setForm(f => ({ ...f, email: user.email || '' })); const { data } = await supabase.from('agent_profiles').select('phone, psra_licence, agent_type').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1); const row = Array.isArray(data) ? data[0] : data; if (row) setForm(f => ({ ...f, phone: row.phone || '', psra: row.psra_licence || '', agentType: row.agent_type || 'scheme' })); } })(); }, [supabase]);

  async function saveProfile() {
    setSaving(true);
    try { await supabase.from('agent_profiles').update({ display_name: form.displayName, agency_name: form.agencyName, phone: form.phone, psra_licence: form.psra, agent_type: form.agentType }).eq('id', profile.id); setSaved(true); setTimeout(() => setSaved(false), 2000); } catch {}
    setSaving(false);
  }

  async function handleSignOut() { await supabase.auth.signOut(); router.push('/login/agent'); }

  return (
    <div className="min-h-full" style={{ backgroundColor: tokens.cream }}>
      <div className="p-8 max-w-xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

        {/* Profile */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Profile</h3>
          {[{ label: 'Display Name', value: form.displayName, key: 'displayName' }, { label: 'Agency Name', value: form.agencyName, key: 'agencyName' }, { label: 'Phone', value: form.phone, key: 'phone', placeholder: '+353...' }, { label: 'PSRA Licence', value: form.psra, key: 'psra', placeholder: 'PSRA licence number' }].map(f => (
            <div key={f.key} className="mb-3">
              <label className="block text-xs font-semibold text-gray-700 mb-1">{f.label}</label>
              <input type="text" value={f.value} onChange={e => setForm(fm => ({ ...fm, [f.key]: e.target.value }))} placeholder={f.placeholder} className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gold-500 focus:ring-1 focus:ring-gold-500/30" />
            </div>
          ))}
          <div className="mb-4"><label className="block text-xs font-semibold text-gray-700 mb-1">Email</label><input type="email" value={form.email} disabled className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500" /></div>
          <button onClick={saveProfile} disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg text-white transition-all hover:shadow-md disabled:opacity-60" style={{ backgroundColor: tokens.gold }}>
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : saved ? 'Saved!' : 'Save changes'}
          </button>
        </div>

        {/* Agent Type */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Agent Type</h3>
          {[{ value: 'scheme', label: 'Scheme agent', desc: 'Managing new-build developments' }, { value: 'independent', label: 'Independent', desc: 'Selling standalone properties' }, { value: 'hybrid', label: 'Both', desc: 'I do both' }].map(opt => (
            <label key={opt.value} className="flex items-start gap-3 py-2 cursor-pointer">
              <input type="radio" name="agentType" value={opt.value} checked={form.agentType === opt.value} onChange={e => setForm(f => ({ ...f, agentType: e.target.value }))} className="mt-1 accent-gold-500" />
              <div><p className="text-sm font-medium text-gray-900">{opt.label}</p><p className="text-xs text-gray-500">{opt.desc}</p></div>
            </label>
          ))}
        </div>

        {/* Intelligence Preferences */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Intelligence Preferences</h3>
          <p className="text-xs font-medium text-gray-500 mb-2">Tone</p>
          <div className="flex gap-2">{['professional', 'warm', 'concise'].map(t => (
            <button key={t} onClick={() => setForm(f => ({ ...f, tone: t }))}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${form.tone === t ? 'bg-gold-50 text-gold-800 border border-gold-300' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
              {t === 'warm' ? 'Warm & conversational' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}</div>
        </div>

        {/* Switch Product */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Switch Product</h3>
          <div className="flex gap-3">
            <a href="/agent/home" className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg bg-gray-50 text-sm font-medium text-gray-700 border border-gray-200 hover:bg-gray-100 transition-colors"><Smartphone className="w-4 h-4" /> Mobile App</a>
            <a href="/developer" className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg bg-gray-50 text-sm font-medium text-gray-700 border border-gray-200 hover:bg-gray-100 transition-colors"><Building className="w-4 h-4" /> Developer</a>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-white rounded-2xl border border-red-200 p-5">
          <h3 className="text-sm font-semibold text-red-700 mb-3">Danger Zone</h3>
          <button onClick={handleSignOut} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg text-red-700 bg-white border border-red-200 hover:bg-red-50 transition-colors"><LogOut className="w-4 h-4" /> Sign out of OpenHouse</button>
        </div>
      </div>
    </div>
  );
}
