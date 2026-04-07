'use client';

import { useState, useEffect } from 'react';
import { useAgent } from '@/lib/agent/AgentContext';
import AgentShell from '../_components/AgentShell';
import type { AgentContact } from '@/lib/agent/independentAgentService';
import { getAgentContacts, createAgentContact } from '@/lib/agent/independentAgentService';

export default function ContactsPage() {
  const { agent, loading: agentLoading } = useAgent();
  const [contacts, setContacts] = useState<AgentContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddSheet, setShowAddSheet] = useState(false);

  useEffect(() => {
    async function load() {
      if (!agent) return;
      const data = await getAgentContacts(agent.id);
      setContacts(data);
      setLoading(false);
    }
    if (!agentLoading) load();
  }, [agent, agentLoading]);

  const handleContactCreated = (contact: AgentContact) => {
    setContacts(prev => [contact, ...prev]);
    setShowAddSheet(false);
  };

  const statusConfigs: Record<string, { bg: string; color: string; label: string }> = {
    active: { bg: '#ECFDF5', color: '#059669', label: 'ACTIVE' },
    under_offer: { bg: '#FFF7ED', color: '#D97706', label: 'UNDER OFFER' },
    purchased: { bg: '#F3E8FF', color: '#7C3AED', label: 'PURCHASED' },
    inactive: { bg: '#F3F4F6', color: '#6B7280', label: 'INACTIVE' },
  };

  return (
    <AgentShell agentName={agent?.displayName?.split(' ')[0]} urgentCount={0}>
      <div style={{ padding: '8px 24px 100px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0D0D12', letterSpacing: '-0.04em' }}>Contacts</h1>
          <button onClick={() => setShowAddSheet(true)} className="agent-tappable" style={{
            padding: '8px 16px', borderRadius: 12, border: 'none',
            background: 'linear-gradient(135deg, #C49B2A, #E8C84A)',
            color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(196,155,42,0.3)',
          }}>
            + Add contact
          </button>
        </div>

        {loading ? (
          <div>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ height: 90, background: '#f3f4f6', borderRadius: 18, marginBottom: 12, animation: 'pulse 1.5s infinite' }} />
            ))}
          </div>
        ) : contacts.length === 0 ? (
          <div style={{
            background: '#FFFFFF', borderRadius: 18, padding: '32px 18px', textAlign: 'center',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.04)',
          }}>
            <p style={{ color: '#A0A8B0', fontSize: 13, marginBottom: 12 }}>No contacts yet</p>
            <button onClick={() => setShowAddSheet(true)} style={{
              fontSize: 13, fontWeight: 600, color: '#C49B2A', background: 'none', border: 'none', cursor: 'pointer',
            }}>
              Add your first contact &rarr;
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {contacts.map(contact => {
              const sc = statusConfigs[contact.status] || statusConfigs.active;
              const initials = contact.name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();

              return (
                <div key={contact.id} style={{
                  background: '#FFFFFF', borderRadius: 18, padding: '14px 18px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.04)',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  {/* Avatar */}
                  <div style={{
                    width: 38, height: 38, borderRadius: 12, flexShrink: 0,
                    background: 'linear-gradient(135deg, #FFFBEB, #FEF3C7)',
                    border: '1px solid rgba(212,175,55,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ color: '#92400E', fontSize: 12, fontWeight: 700 }}>{initials}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#0D0D12' }}>{contact.name}</span>
                      <span style={{
                        background: sc.bg, color: sc.color,
                        padding: '1px 6px', borderRadius: 8, fontSize: 8, fontWeight: 700, letterSpacing: '0.05em',
                      }}>
                        {sc.label}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: '#A0A8B0', margin: 0 }}>
                      {contact.budgetMin && contact.budgetMax
                        ? `\u20AC${(contact.budgetMin / 1000).toFixed(0)}k\u2013\u20AC${(contact.budgetMax / 1000).toFixed(0)}k`
                        : 'No budget set'}
                      {contact.minBedrooms ? ` · ${contact.minBedrooms} bed` : ''}
                    </p>
                    {contact.preferredArea && (
                      <p style={{ fontSize: 11, color: '#B0B8C4', margin: '2px 0 0' }}>{contact.preferredArea}</p>
                    )}
                    {contact.hasMortgageApproval && contact.mortgageExpiryDate && (
                      <p style={{ fontSize: 11, color: '#059669', margin: '2px 0 0' }}>
                        Has mortgage approval (exp. {new Date(contact.mortgageExpiryDate).toLocaleDateString('en-IE', { month: 'short', year: 'numeric' })})
                      </p>
                    )}
                    {contact.lastContactedAt && (
                      <p style={{ fontSize: 11, color: '#C0C8D4', margin: '2px 0 0' }}>
                        Last contacted: {new Date(contact.lastContactedAt).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showAddSheet && agent && (
        <AddContactSheet
          agent={agent}
          onClose={() => setShowAddSheet(false)}
          onCreated={handleContactCreated}
        />
      )}
    </AgentShell>
  );
}

function AddContactSheet({ agent, onClose, onCreated }: {
  agent: import('@/lib/agent/agentPipelineService').AgentProfile;
  onClose: () => void;
  onCreated: (contact: AgentContact) => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [minBedrooms, setMinBedrooms] = useState('');
  const [preferredArea, setPreferredArea] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const contact = await createAgentContact({
      agentId: agent.id,
      tenantId: agent.tenantId,
      name: name.trim(),
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      budgetMin: budgetMin ? parseInt(budgetMin.replace(/,/g, '')) : undefined,
      budgetMax: budgetMax ? parseInt(budgetMax.replace(/,/g, '')) : undefined,
      minBedrooms: minBedrooms ? parseInt(minBedrooms) : undefined,
      preferredArea: preferredArea.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    setSaving(false);
    if (contact) onCreated(contact);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: '28px 28px 0 0', width: '100%', maxWidth: 500, padding: '20px 24px 36px', maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ width: 40, height: 4, background: '#E0E0DC', borderRadius: 2, margin: '0 auto 16px' }} />
        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0D0D12', marginBottom: 20 }}>Add contact</h3>

        <FieldLabel>Name *</FieldLabel>
        <FieldInput value={name} onChange={setName} placeholder="Siobhan Collins" />

        <FieldLabel>Phone</FieldLabel>
        <FieldInput value={phone} onChange={setPhone} placeholder="087 234 5678" />

        <FieldLabel>Email</FieldLabel>
        <FieldInput value={email} onChange={setEmail} placeholder="siobhan@email.com" />

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <FieldLabel>Budget min</FieldLabel>
            <FieldInput value={budgetMin} onChange={setBudgetMin} placeholder="320,000" />
          </div>
          <div style={{ flex: 1 }}>
            <FieldLabel>Budget max</FieldLabel>
            <FieldInput value={budgetMax} onChange={setBudgetMax} placeholder="380,000" />
          </div>
        </div>

        <FieldLabel>Min bedrooms</FieldLabel>
        <FieldInput value={minBedrooms} onChange={setMinBedrooms} placeholder="3" />

        <FieldLabel>Preferred area</FieldLabel>
        <FieldInput value={preferredArea} onChange={setPreferredArea} placeholder="Bishopstown / Wilton area" />

        <FieldLabel>Notes</FieldLabel>
        <textarea
          value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Any additional notes..."
          rows={3}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', fontSize: 13, marginBottom: 16, boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none', resize: 'vertical' }}
        />

        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={onClose} className="agent-tappable" style={{
            flex: 1, padding: '13px 0', borderRadius: 14, border: '1px solid rgba(0,0,0,0.08)',
            background: '#fff', fontSize: 13, fontWeight: 600, color: '#6B7280', cursor: 'pointer',
          }}>Cancel</button>
          <button onClick={handleSave} disabled={!name.trim() || saving} className="agent-tappable" style={{
            flex: 1, padding: '13px 0', borderRadius: 14, border: 'none',
            background: name.trim() ? '#0D0D12' : 'rgba(0,0,0,0.1)',
            fontSize: 13, fontWeight: 600, color: '#fff', cursor: name.trim() ? 'pointer' : 'default',
            opacity: saving ? 0.6 : 1,
          }}>
            {saving ? 'Saving...' : 'Add contact'}
          </button>
        </div>
      </div>
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
