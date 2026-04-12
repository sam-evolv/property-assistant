'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Settings,
  Save,
  Smartphone,
  Home,
  Building,
  LogOut,
} from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useAgentDashboard } from '../layout-provider';

export const dynamic = 'force-dynamic';

export default function AgentDashboardSettingsPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const { profile } = useAgentDashboard();

  const [form, setForm] = useState({
    displayName: profile.display_name || '',
    agencyName: profile.agency_name || '',
    email: '',
    phone: '',
    psra: '',
    agentType: profile.agent_type || 'scheme',
    tone: 'professional',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setForm(f => ({ ...f, email: user.email || '' }));
        const { data } = await supabase
          .from('agent_profiles')
          .select('phone, psra_licence, agent_type')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })
          .limit(1);
        const row = Array.isArray(data) ? data[0] : data;
        if (row) {
          setForm(f => ({
            ...f,
            phone: row.phone || '',
            psra: row.psra_licence || '',
            agentType: row.agent_type || 'scheme',
          }));
        }
      }
    }
    loadProfile();
  }, [supabase]);

  async function saveProfile() {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase
        .from('agent_profiles')
        .update({
          display_name: form.displayName,
          agency_name: form.agencyName,
          phone: form.phone,
          psra_licence: form.psra,
          agent_type: form.agentType,
        })
        .eq('id', profile.id);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* silent */ }
    setSaving(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login/agent');
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 38, padding: '0 12px',
    border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8,
    fontSize: 13, fontFamily: 'inherit', outline: 'none',
    background: '#fff',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: '#111',
    margin: '0 0 5px', display: 'block',
  };

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Quick Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 32px', background: '#fff', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'rgba(0,0,0,0.35)', textTransform: 'uppercase' as const, marginRight: 8 }}>SETTINGS</span>
      </div>

      <div style={{ padding: '28px 32px', maxWidth: 560 }}>
        <h1 style={{ color: '#111', fontSize: 20, fontWeight: 700, letterSpacing: '-0.04em', margin: '0 0 24px' }}>Settings</h1>

        {/* Section 1: Profile */}
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)', padding: '20px', marginBottom: 16 }}>
          <h3 style={{ fontSize: 13.5, fontWeight: 600, color: '#111', margin: '0 0 16px', letterSpacing: '-0.02em' }}>Profile</h3>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Display Name</label>
            <input type="text" value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} style={inputStyle} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Agency Name</label>
            <input type="text" value={form.agencyName} onChange={e => setForm(f => ({ ...f, agencyName: e.target.value }))} style={inputStyle} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Email</label>
            <input type="email" value={form.email} disabled style={{ ...inputStyle, background: '#f9f8f5', color: 'rgba(0,0,0,0.5)' }} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Phone</label>
            <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} style={inputStyle} placeholder="+353..." />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>PSRA Licence</label>
            <input type="text" value={form.psra} onChange={e => setForm(f => ({ ...f, psra: e.target.value }))} style={inputStyle} placeholder="PSRA licence number" />
          </div>

          <button onClick={saveProfile} disabled={saving} style={{ height: 30, padding: '0 14px', background: '#c8960a', border: 'none', borderRadius: 7, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5, opacity: saving ? 0.7 : 1 }}>
            <Save size={13} /> {saving ? 'Saving...' : saved ? 'Saved!' : 'Save changes'}
          </button>
        </div>

        {/* Section 2: Agent Type */}
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)', padding: '20px', marginBottom: 16 }}>
          <h3 style={{ fontSize: 13.5, fontWeight: 600, color: '#111', margin: '0 0 14px', letterSpacing: '-0.02em' }}>Agent Type</h3>
          {[
            { value: 'scheme', label: 'Scheme agent', desc: 'Managing new-build developments' },
            { value: 'independent', label: 'Independent', desc: 'Selling standalone properties' },
            { value: 'hybrid', label: 'Both', desc: 'I do both' },
          ].map(opt => (
            <label key={opt.value} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', cursor: 'pointer' }}>
              <input
                type="radio"
                name="agentType"
                value={opt.value}
                checked={form.agentType === opt.value}
                onChange={e => setForm(f => ({ ...f, agentType: e.target.value }))}
                style={{ marginTop: 3, accentColor: '#c8960a' }}
              />
              <div>
                <p style={{ fontSize: 13, fontWeight: 500, color: '#111', margin: 0 }}>{opt.label}</p>
                <p style={{ fontSize: 11, color: 'rgba(0,0,0,0.45)', margin: '1px 0 0' }}>{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>

        {/* Section 3: Intelligence Preferences */}
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)', padding: '20px', marginBottom: 16 }}>
          <h3 style={{ fontSize: 13.5, fontWeight: 600, color: '#111', margin: '0 0 14px', letterSpacing: '-0.02em' }}>Intelligence Preferences</h3>
          <p style={{ fontSize: 12, fontWeight: 500, color: 'rgba(0,0,0,0.5)', margin: '0 0 8px' }}>Tone</p>
          <div style={{ display: 'flex', gap: 6 }}>
            {['professional', 'warm', 'concise'].map(t => (
              <button key={t} onClick={() => setForm(f => ({ ...f, tone: t }))} style={{ padding: '6px 14px', borderRadius: 8, background: form.tone === t ? 'rgba(200,150,10,0.1)' : '#fff', border: form.tone === t ? '1px solid rgba(200,150,10,0.3)' : '1px solid rgba(0,0,0,0.12)', color: form.tone === t ? '#c8960a' : '#374151', fontSize: 12, fontWeight: form.tone === t ? 600 : 500, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize' as const }}>
                {t === 'warm' ? 'Warm & conversational' : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Section 4: Switch Product */}
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)', padding: '20px', marginBottom: 16 }}>
          <h3 style={{ fontSize: 13.5, fontWeight: 600, color: '#111', margin: '0 0 14px', letterSpacing: '-0.02em' }}>Switch Product</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <a href="/agent/home" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 40, borderRadius: 8, background: '#fff', border: '1px solid rgba(0,0,0,0.12)', color: '#374151', fontSize: 12, fontWeight: 500, textDecoration: 'none', fontFamily: 'inherit' }}>
              <Smartphone size={14} /> Mobile App
            </a>
            <a href="/developer" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 40, borderRadius: 8, background: '#fff', border: '1px solid rgba(0,0,0,0.12)', color: '#374151', fontSize: 12, fontWeight: 500, textDecoration: 'none', fontFamily: 'inherit' }}>
              <Building size={14} /> Developer Dashboard
            </a>
          </div>
        </div>

        {/* Section 5: Danger Zone */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(185,28,28,0.2)', padding: '20px' }}>
          <h3 style={{ fontSize: 13.5, fontWeight: 600, color: '#b91c1c', margin: '0 0 12px', letterSpacing: '-0.02em' }}>Danger Zone</h3>
          <button onClick={handleSignOut} style={{ height: 34, padding: '0 16px', background: '#fff', border: '1px solid rgba(185,28,28,0.3)', borderRadius: 7, color: '#b91c1c', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
            <LogOut size={14} /> Sign out of OpenHouse
          </button>
        </div>
      </div>
    </div>
  );
}
