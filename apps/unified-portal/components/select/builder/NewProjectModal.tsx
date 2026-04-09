'use client';

import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { X } from 'lucide-react';
import { colors, EASE, BUILD_STAGES, STAGE_LABELS } from '@/components/select/builder/tokens';

interface NewProjectModalProps {
  builderId: string;
  onClose: () => void;
  onCreated: (projectId: string) => void;
}

export default function NewProjectModal({ builderId, onClose, onCreated }: NewProjectModalProps) {
  const supabase = createClientComponentClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('Cork');
  const [eircode, setEircode] = useState('');
  const [homeownerName, setHomeownerName] = useState('');
  const [homeownerEmail, setHomeownerEmail] = useState('');
  const [contractPrice, setContractPrice] = useState('');
  const [targetHandoverDate, setTargetHandoverDate] = useState('');
  const [buildStage, setBuildStage] = useState('planning');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!addressLine1.trim()) {
      setError('Address is required.');
      return;
    }
    if (!homeownerName.trim()) {
      setError('Homeowner name is required.');
      return;
    }

    setSaving(true);
    setError('');

    const address = [addressLine1, city].filter(Boolean).join(', ');

    const { data, error: insertError } = await supabase
      .from('select_builder_projects')
      .insert({
        builder_id: builderId,
        address,
        address_line_1: addressLine1.trim(),
        city: city.trim() || 'Cork',
        eircode: eircode.trim() || null,
        homeowner_name: homeownerName.trim(),
        homeowner_email: homeownerEmail.trim() || null,
        contract_price: contractPrice ? parseFloat(contractPrice) : null,
        target_handover_date: targetHandoverDate || null,
        build_stage: buildStage,
        status: 'active',
      })
      .select('id')
      .single();

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    if (data) {
      onCreated(data.id);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    borderRadius: 8,
    background: colors.surface2,
    border: `1px solid ${colors.border}`,
    color: colors.textPrimary,
    fontSize: 13,
    outline: 'none',
    fontFamily: 'inherit',
    transition: `border-color 200ms ${EASE}`,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: colors.textSecondary,
    marginBottom: 4,
    display: 'block',
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(4px)',
    }}
    onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: colors.surface1,
        border: `1px solid ${colors.border}`,
        borderRadius: 16,
        width: '100%',
        maxWidth: 480,
        maxHeight: '90vh',
        overflowY: 'auto',
        margin: 16,
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          borderBottom: `1px solid ${colors.border}`,
        }}>
          <span style={{
            fontSize: 15,
            fontWeight: 600,
            color: colors.textPrimary,
          }}>
            New Project
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: colors.textMuted,
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Address */}
            <div>
              <label style={labelStyle}>Address *</label>
              <input
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                placeholder="14 Innishmore Rise, Carrigaline"
                style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(212,175,55,0.4)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = colors.border; }}
              />
            </div>

            {/* City + Eircode */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>City</label>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  style={inputStyle}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(212,175,55,0.4)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = colors.border; }}
                />
              </div>
              <div>
                <label style={labelStyle}>Eircode</label>
                <input
                  value={eircode}
                  onChange={(e) => setEircode(e.target.value)}
                  placeholder="P43 XY12"
                  style={inputStyle}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(212,175,55,0.4)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = colors.border; }}
                />
              </div>
            </div>

            {/* Homeowner name */}
            <div>
              <label style={labelStyle}>Homeowner Name *</label>
              <input
                value={homeownerName}
                onChange={(e) => setHomeownerName(e.target.value)}
                placeholder="Aoife & Ciarán Murphy"
                style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(212,175,55,0.4)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = colors.border; }}
              />
            </div>

            {/* Homeowner email */}
            <div>
              <label style={labelStyle}>Homeowner Email</label>
              <input
                type="email"
                value={homeownerEmail}
                onChange={(e) => setHomeownerEmail(e.target.value)}
                placeholder="aoife@example.com"
                style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(212,175,55,0.4)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = colors.border; }}
              />
            </div>

            {/* Contract price + Target date */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Contract Price</label>
                <input
                  type="number"
                  value={contractPrice}
                  onChange={(e) => setContractPrice(e.target.value)}
                  placeholder="485000"
                  style={inputStyle}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(212,175,55,0.4)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = colors.border; }}
                />
              </div>
              <div>
                <label style={labelStyle}>Target Handover</label>
                <input
                  type="date"
                  value={targetHandoverDate}
                  onChange={(e) => setTargetHandoverDate(e.target.value)}
                  style={{ ...inputStyle, colorScheme: 'dark' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(212,175,55,0.4)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = colors.border; }}
                />
              </div>
            </div>

            {/* Build stage */}
            <div>
              <label style={labelStyle}>Initial Build Stage</label>
              <select
                value={buildStage}
                onChange={(e) => setBuildStage(e.target.value)}
                style={{ ...inputStyle, appearance: 'auto' as any }}
              >
                {BUILD_STAGES.map((s) => (
                  <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div style={{
              fontSize: 12,
              color: colors.red,
              marginTop: 12,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            style={{
              width: '100%',
              marginTop: 20,
              padding: '10px 16px',
              borderRadius: 10,
              background: colors.gold,
              color: colors.bg,
              fontWeight: 700,
              fontSize: 14,
              border: 'none',
              cursor: saving ? 'wait' : 'pointer',
              opacity: saving ? 0.7 : 1,
              transition: `all 200ms ${EASE}`,
            }}
            onMouseEnter={(e) => { if (!saving) e.currentTarget.style.filter = 'brightness(1.08)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.filter = 'brightness(1)'; }}
          >
            {saving ? 'Creating...' : 'Create Project'}
          </button>
        </form>
      </div>
    </div>
  );
}
