'use client';

import { useState } from 'react';
import { useAgent } from '@/lib/agent/AgentContext';
import AgentShell from '../_components/AgentShell';
import StatusBadge from '../_components/StatusBadge';
import { X, Check, Clock, ChevronDown } from 'lucide-react';

/* Demo viewing data */
interface Viewing {
  id: string;
  time: string;
  buyerName: string;
  schemeName: string;
  unit: string;
  status: 'confirmed' | 'pending';
  note?: string;
}

const INITIAL_VIEWINGS: Viewing[] = [
  { id: '1', time: '10:00', buyerName: 'Sarah & Michael Kelly', schemeName: 'Riverside Gardens', unit: 'Unit 12', status: 'confirmed', note: 'Second viewing — very interested in 4-bed' },
  { id: '2', time: '11:30', buyerName: 'David Chen', schemeName: 'Meadow View', unit: 'Unit 8', status: 'confirmed' },
  { id: '3', time: '14:00', buyerName: 'Aoife Murphy & James Ryan', schemeName: 'Oak Hill Estate', unit: 'Unit 22', status: 'pending', note: 'First-time buyers, mortgage pre-approved' },
  { id: '4', time: '15:30', buyerName: 'Priya Nair', schemeName: 'Harbour View Apartments', unit: 'Unit 3', status: 'confirmed' },
  { id: '5', time: '16:30', buyerName: 'Tom & Lisa Walsh', schemeName: 'Willow Brook', unit: 'Unit 15', status: 'pending' },
];

export default function ViewingsPage() {
  const { agent, alerts, developments } = useAgent();
  const [viewings, setViewings] = useState<Viewing[]>(INITIAL_VIEWINGS);
  const [showForm, setShowForm] = useState(false);
  const [formSuccess, setFormSuccess] = useState(false);

  // Form state
  const [formBuyer, setFormBuyer] = useState('');
  const [formScheme, setFormScheme] = useState('');
  const [formUnit, setFormUnit] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formTime, setFormTime] = useState('');
  const [formNote, setFormNote] = useState('');

  const stats = {
    today: viewings.length,
    thisWeek: viewings.length + 7,
    confirmed: viewings.filter((v) => v.status === 'confirmed').length,
  };

  const schemeOptions = developments.length > 0
    ? developments.map(d => d.name)
    : ['Riverside Gardens', 'Meadow View', 'Oak Hill Estate', 'Harbour View Apartments', 'Willow Brook'];

  const handleSubmitViewing = () => {
    if (!formBuyer.trim() || !formTime.trim()) return;

    const newViewing: Viewing = {
      id: `new-${Date.now()}`,
      time: formTime,
      buyerName: formBuyer.trim(),
      schemeName: formScheme || schemeOptions[0],
      unit: formUnit || 'TBC',
      status: 'pending',
      note: formNote.trim() || undefined,
    };

    setViewings(prev => [...prev, newViewing].sort((a, b) => a.time.localeCompare(b.time)));
    setShowForm(false);
    setFormBuyer('');
    setFormScheme('');
    setFormUnit('');
    setFormDate('');
    setFormTime('');
    setFormNote('');
    setFormSuccess(true);
    setTimeout(() => setFormSuccess(false), 3000);
  };

  return (
    <AgentShell agentName={agent?.displayName?.split(' ')[0] || 'Sam'} urgentCount={alerts.length}>
      <div style={{ padding: '8px 24px 100px' }}>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: '-0.05em',
            color: '#0D0D12',
            marginBottom: 20,
          }}
        >
          Viewings
        </h1>

        {/* Summary stat strip */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
          <StatCard label="Today" value={stats.today} />
          <StatCard label="This week" value={stats.thisWeek} />
          <StatCard label="Confirmed" value={stats.confirmed} highlight />
        </div>

        {/* Section label */}
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: '#A0A8B0',
            marginBottom: 12,
          }}
        >
          Today&apos;s schedule
        </div>

        {/* Viewing rows */}
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: 18,
            overflow: 'hidden',
            boxShadow:
              '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.04)',
            marginBottom: 24,
          }}
        >
          {viewings.map((v, i) => (
            <div
              key={v.id}
              className="agent-tappable"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '14px 18px',
                borderBottom:
                  i < viewings.length - 1
                    ? '1px solid rgba(0,0,0,0.04)'
                    : 'none',
              }}
            >
              {/* Time box */}
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 15,
                  background: '#F5F5F3',
                  border: '0.5px solid rgba(0,0,0,0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontSize: 12.5,
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    color: '#0D0D12',
                  }}
                >
                  {v.time}
                </span>
              </div>

              {/* Details */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: '#0D0D12',
                    letterSpacing: '-0.01em',
                    marginBottom: 2,
                  }}
                >
                  {v.buyerName}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: '#A0A8B0',
                    letterSpacing: '0.005em',
                  }}
                >
                  {v.schemeName} &middot; {v.unit}
                </div>
                {v.note && (
                  <div
                    style={{
                      fontSize: 11,
                      color: '#C0C8D4',
                      fontStyle: 'italic',
                      marginTop: 3,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {v.note}
                  </div>
                )}
              </div>

              {/* Status badge */}
              <StatusBadge status={v.status} />
            </div>
          ))}
        </div>

        {/* Schedule viewing button */}
        <div
          className="agent-tappable"
          onClick={() => setShowForm(true)}
          style={{
            borderRadius: 16,
            border: '1.5px dashed rgba(0,0,0,0.1)',
            padding: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            cursor: 'pointer',
          }}
        >
          <svg
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#C49B2A"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span
            style={{
              color: '#A0A8B0',
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: '0.01em',
            }}
          >
            Schedule a viewing
          </span>
        </div>
      </div>

      {/* ─── Schedule Viewing Form (Bottom Sheet) ─── */}
      {showForm && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            zIndex: 200,
            display: 'flex', alignItems: 'flex-end',
          }}
          onClick={() => setShowForm(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', background: '#fff',
              borderRadius: '24px 24px 0 0',
              paddingBottom: 0,
              boxShadow: '0 -4px 32px rgba(0,0,0,0.12)',
              animation: 'slideUp 300ms cubic-bezier(.2,.8,.2,1)',
              maxHeight: '90dvh',
              overflowY: 'auto',
            }}
          >
            {/* Handle */}
            <div style={{ width: 40, height: 4, background: '#E0E0DC', borderRadius: 2, margin: '14px auto 16px' }} />

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px 16px' }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0D0D12', margin: 0, letterSpacing: '-0.03em' }}>
                Schedule Viewing
              </h2>
              <button
                onClick={() => setShowForm(false)}
                style={{
                  width: 32, height: 32, borderRadius: 10,
                  background: '#F5F5F3', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={16} color="#6B7280" />
              </button>
            </div>

            {/* Form fields */}
            <div style={{ padding: '0 24px' }}>
              <FormField label="Buyer name" required>
                <input
                  value={formBuyer}
                  onChange={(e) => setFormBuyer(e.target.value)}
                  placeholder="e.g. Sarah & Michael Kelly"
                  style={inputStyle}
                />
              </FormField>

              <FormField label="Scheme">
                <div style={{ position: 'relative' }}>
                  <select
                    value={formScheme}
                    onChange={(e) => setFormScheme(e.target.value)}
                    style={{ ...inputStyle, appearance: 'none', paddingRight: 36 }}
                  >
                    <option value="">Select scheme...</option>
                    {schemeOptions.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} color="#A0A8B0" style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                </div>
              </FormField>

              <FormField label="Unit">
                <input
                  value={formUnit}
                  onChange={(e) => setFormUnit(e.target.value)}
                  placeholder="e.g. Unit 12"
                  style={inputStyle}
                />
              </FormField>

              <div style={{ display: 'flex', gap: 12 }}>
                <FormField label="Date" style={{ flex: 1 }}>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    style={inputStyle}
                  />
                </FormField>
                <FormField label="Time" required style={{ flex: 1 }}>
                  <input
                    type="time"
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    style={inputStyle}
                  />
                </FormField>
              </div>

              <FormField label="Notes">
                <textarea
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  placeholder="Any details for this viewing..."
                  rows={3}
                  style={{ ...inputStyle, resize: 'none', minHeight: 80 }}
                />
              </FormField>

              {/* Submit */}
              <button
                onClick={handleSubmitViewing}
                disabled={!formBuyer.trim() || !formTime.trim()}
                style={{
                  width: '100%', padding: '14px', borderRadius: 14,
                  background: (!formBuyer.trim() || !formTime.trim()) ? '#E0E0E0' : '#0D0D12',
                  color: '#fff', fontSize: 14, fontWeight: 600,
                  border: 'none', cursor: (!formBuyer.trim() || !formTime.trim()) ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  marginTop: 8,
                  marginBottom: 120,
                }}
              >
                <Clock size={15} />
                Schedule Viewing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success toast */}
      {formSuccess && (
        <div style={{
          position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)',
          background: '#059669', color: '#fff', fontSize: 13, fontWeight: 600,
          padding: '10px 18px', borderRadius: 14, zIndex: 210,
          display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        }}>
          <Check size={15} />
          Viewing scheduled
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </AgentShell>
  );
}

/* ─── Form helpers ─── */

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 12,
  border: '1px solid rgba(0,0,0,0.08)',
  fontSize: 14,
  color: '#0D0D12',
  background: '#FAFAF8',
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
};

function FormField({ label, required, children, style }: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ marginBottom: 14, ...style }}>
      <label style={{
        fontSize: 12, fontWeight: 600, color: '#6B7280',
        letterSpacing: '0.01em', display: 'block', marginBottom: 6,
      }}>
        {label}{required && <span style={{ color: '#DC2626' }}> *</span>}
      </label>
      {children}
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        flex: 1,
        background: '#FFFFFF',
        borderRadius: 16,
        padding: '14px 12px',
        textAlign: 'center',
        boxShadow:
          '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.04)',
        borderTop: highlight
          ? '2px solid rgba(16,185,129,0.4)'
          : '2px solid transparent',
      }}
    >
      <div
        style={{
          fontSize: 26,
          fontWeight: 700,
          letterSpacing: '-0.05em',
          color: '#0D0D12',
          lineHeight: 1,
          marginBottom: 4,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: '#A0A8B0',
        }}
      >
        {label}
      </div>
    </div>
  );
}
