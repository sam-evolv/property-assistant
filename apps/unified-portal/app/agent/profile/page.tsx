'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAgent } from '@/lib/agent/AgentContext';
import AgentShell from '../_components/AgentShell';
import type { AgentType } from '@/lib/agent/agentPipelineService';
import { getCommissionStats, updateAgentProfile } from '@/lib/agent/independentAgentService';

export default function ProfilePage() {
  const { agent, loading: agentLoading } = useAgent();

  const [agentType, setAgentType] = useState<AgentType>('scheme');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [specialisations, setSpecialisations] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [commissionData, setCommissionData] = useState<{ projected: number; received: number; total: number } | null>(null);

  useEffect(() => {
    if (agent) {
      setAgentType(agent.agentType || 'scheme');
      setBio(agent.bio || '');
      setLocation(agent.location || '');
      setSpecialisations(agent.specialisations?.join(', ') || '');

      // Load commission data for independent agents
      if (agent.agentType !== 'scheme') {
        getCommissionStats(agent.id).then(setCommissionData);
      }
    }
  }, [agent]);

  const handleSave = async () => {
    if (!agent) return;
    setSaving(true);
    const success = await updateAgentProfile(agent.id, {
      agent_type: agentType,
      bio: bio || undefined,
      location: location || undefined,
      specialisations: specialisations ? specialisations.split(',').map(s => s.trim()).filter(Boolean) : undefined,
    });
    setSaving(false);
    if (success) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      // Reload page to pick up new agent_type
      if (agentType !== agent.agentType) {
        window.location.reload();
      }
    }
  };

  if (agentLoading || !agent) {
    return (
      <AgentShell agentName="Agent" urgentCount={0}>
        <div style={{ padding: '16px 24px 100px' }}>
          <div style={{ height: 200, background: '#f3f4f6', borderRadius: 18, animation: 'pulse 1.5s infinite' }} />
        </div>
      </AgentShell>
    );
  }

  return (
    <AgentShell agentName={agent.displayName?.split(' ')[0]} urgentCount={0}>
      <div style={{ padding: '8px 24px 100px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0D0D12', letterSpacing: '-0.04em', marginBottom: 20 }}>Profile</h1>

        {/* Agent Info Card */}
        <div style={{
          background: '#FFFFFF', borderRadius: 18, padding: '18px', marginBottom: 20,
          boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: 'linear-gradient(135deg, #C49B2A, #E8C84A)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>
                {agent.displayName?.split(' ').map(w => w[0]).slice(0, 2).join('')}
              </span>
            </div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 600, color: '#0D0D12', marginBottom: 2 }}>{agent.displayName}</p>
              <p style={{ fontSize: 13, color: '#A0A8B0' }}>{agent.agencyName}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#6B7280' }}>
            {agent.email && <span>{agent.email}</span>}
            {agent.phone && <span>{agent.phone}</span>}
          </div>
        </div>

        {/* Account Type */}
        <SectionLabel>Account type</SectionLabel>
        <div style={{
          background: '#FFFFFF', borderRadius: 18, padding: '16px 18px', marginBottom: 20,
          boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.04)',
        }}>
          {([
            { value: 'scheme' as AgentType, label: 'Scheme agent', desc: 'New-build developments' },
            { value: 'independent' as AgentType, label: 'Independent agent', desc: 'Standalone properties' },
            { value: 'hybrid' as AgentType, label: 'Both', desc: 'Schemes + standalone listings' },
          ]).map(option => (
            <div
              key={option.value}
              onClick={() => setAgentType(option.value)}
              className="agent-tappable"
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', cursor: 'pointer',
                borderBottom: option.value !== 'hybrid' ? '1px solid rgba(0,0,0,0.04)' : 'none',
              }}
            >
              <div style={{
                width: 20, height: 20, borderRadius: 10,
                border: agentType === option.value ? '6px solid #C49B2A' : '2px solid rgba(0,0,0,0.15)',
                boxSizing: 'border-box', flexShrink: 0,
              }} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 500, color: '#0D0D12', marginBottom: 1 }}>{option.label}</p>
                <p style={{ fontSize: 11, color: '#A0A8B0' }}>{option.desc}</p>
              </div>
            </div>
          ))}
          {agentType !== agent.agentType && (
            <p style={{
              fontSize: 12, color: '#6B7280', marginTop: 12, padding: '10px 12px',
              background: '#F9FAFB', borderRadius: 10,
            }}>
              {agentType === 'scheme'
                ? 'Your app will show scheme-wide buyer lists and development pipelines.'
                : 'Your app will show listings, enquiries, and contacts in your pipeline instead of scheme-wide buyer lists.'}
            </p>
          )}
        </div>

        {/* Profile fields */}
        <SectionLabel>About you</SectionLabel>
        <div style={{
          background: '#FFFFFF', borderRadius: 18, padding: '16px 18px', marginBottom: 20,
          boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.04)',
        }}>
          <FieldLabel>Bio</FieldLabel>
          <textarea
            value={bio} onChange={e => setBio(e.target.value)}
            placeholder="A short bio about your experience..."
            rows={3}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', fontSize: 13, marginBottom: 14, boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none', resize: 'vertical' }}
          />

          <FieldLabel>Location</FieldLabel>
          <FieldInput value={location} onChange={setLocation} placeholder="Cork City" />

          <FieldLabel>Specialisations (comma separated)</FieldLabel>
          <FieldInput value={specialisations} onChange={setSpecialisations} placeholder="Residential, First-time buyers, South Cork" />
        </div>

        {/* Save button */}
        <button onClick={handleSave} disabled={saving} className="agent-tappable" style={{
          width: '100%', padding: '14px 0', borderRadius: 14, border: 'none',
          background: '#0D0D12', fontSize: 14, fontWeight: 600, color: '#fff',
          cursor: 'pointer', marginBottom: 24, opacity: saving ? 0.6 : 1,
        }}>
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save changes'}
        </button>

        {/* Commission tracker (independent agents only) */}
        {agentType !== 'scheme' && commissionData && (
          <>
            <SectionLabel>Commission this year</SectionLabel>
            <div style={{
              background: '#FFFFFF', borderRadius: 18, padding: '16px 18px', marginBottom: 20,
              boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.04)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: '#6B7280' }}>Received</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#059669' }}>
                  {'\u20AC'}{commissionData.received.toLocaleString('en-IE')}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: '#6B7280' }}>Pipeline</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#D97706' }}>
                  {'\u20AC'}{commissionData.projected.toLocaleString('en-IE')}
                </span>
              </div>
              <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', marginBottom: 8 }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#0D0D12' }}>Total</span>
                <span style={{ fontSize: 17, fontWeight: 700, color: '#0D0D12' }}>
                  {'\u20AC'}{commissionData.total.toLocaleString('en-IE')}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </AgentShell>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#A0A8B0', marginBottom: 12 }}>
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 6 }}>{children}</label>;
}

function FieldInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', fontSize: 13, marginBottom: 14, boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }}
    />
  );
}
