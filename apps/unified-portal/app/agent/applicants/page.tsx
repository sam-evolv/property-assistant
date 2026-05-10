'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Users, Plus, X, Loader2 } from 'lucide-react';
import AgentShell from '../_components/AgentShell';
import { useAgent } from '@/lib/agent/AgentContext';
import {
  applicationStatusLabel,
  type ApplicantListItem,
} from '@/lib/agent-intelligence/applicants';
import { relativeTimestamp } from '@/lib/agent-intelligence/drafts';

type FilterKey = 'all' | 'preferred' | 'invited' | 'applied' | 'approved';

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'preferred', label: 'Preferred' },
  { key: 'invited', label: 'Invited' },
  { key: 'applied', label: 'Applied' },
  { key: 'approved', label: 'Approved' },
];

export default function ApplicantsListPage() {
  const { agent, alerts } = useAgent();
  const [items, setItems] = useState<ApplicantListItem[]>([]);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [loading, setLoading] = useState(true);
  const [pullOffset, setPullOffset] = useState(0);
  const pullStartY = useRef<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async (next: FilterKey) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/agent/applicants?filter=${next}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.applicants || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(filter); }, [filter, load]);

  const handlePullStart = (e: React.TouchEvent) => {
    const target = e.currentTarget as HTMLDivElement;
    if (target.scrollTop > 0) return;
    pullStartY.current = e.touches[0].clientY;
  };
  const handlePullMove = (e: React.TouchEvent) => {
    if (pullStartY.current == null) return;
    const delta = e.touches[0].clientY - pullStartY.current;
    if (delta > 0) setPullOffset(Math.min(80, delta));
  };
  const handlePullEnd = async () => {
    if (pullOffset > 60) await load(filter);
    pullStartY.current = null;
    setPullOffset(0);
  };

  return (
    <AgentShell agentName={agent?.displayName?.split(' ')[0] || 'Agent'} urgentCount={alerts?.length || 0}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
        }}
      >
        <header
          style={{
            padding: '16px 20px 12px',
            borderBottom: '0.5px solid rgba(0,0,0,0.05)',
            background: 'rgba(250,250,248,0.95)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1
                style={{
                  margin: 0,
                  fontSize: 20,
                  fontWeight: 700,
                  letterSpacing: '-0.03em',
                  color: '#0D0D12',
                }}
              >
                Applicants
              </h1>
              <p
                style={{
                  margin: '4px 0 0',
                  fontSize: 12.5,
                  color: '#9CA3AF',
                  letterSpacing: '0.005em',
                }}
              >
                Everyone who viewed, enquired, or applied. Flagged ones first.
              </p>
            </div>
            <button
              type="button"
              data-testid="applicants-add-button"
              onClick={() => setAddOpen(true)}
              aria-label="Add applicant"
              className="agent-tappable"
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                border: 'none',
                background: 'linear-gradient(180deg, #D4AF37 0%, #C49B2A 100%)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <Plus size={18} strokeWidth={2.25} />
            </button>
          </div>

          {/* Filter tabs */}
          <div
            data-testid="applicants-filter-tabs"
            style={{
              marginTop: 14,
              display: 'flex',
              gap: 6,
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',
            }}
            className="[&::-webkit-scrollbar]:hidden"
          >
            {FILTERS.map((f) => (
              <button
                key={f.key}
                data-testid={`applicants-filter-${f.key}`}
                onClick={() => setFilter(f.key)}
                className="agent-tappable"
                style={{
                  padding: '6px 14px',
                  borderRadius: 999,
                  border: filter === f.key ? '0.5px solid #C49B2A' : '0.5px solid rgba(0,0,0,0.08)',
                  background: filter === f.key ? 'rgba(196,155,42,0.12)' : '#FFFFFF',
                  color: filter === f.key ? '#8A6E1F' : '#6B7280',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </header>

        <div
          onTouchStart={handlePullStart}
          onTouchMove={handlePullMove}
          onTouchEnd={handlePullEnd}
          style={{
            flex: 1,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {pullOffset > 0 && (
            <div
              style={{
                textAlign: 'center',
                fontSize: 11,
                color: '#9CA3AF',
                padding: `${pullOffset / 2}px 0`,
              }}
            >
              {pullOffset > 60 ? 'Release to refresh' : 'Pull to refresh'}
            </div>
          )}

          {loading && items.length === 0 ? (
            <p style={{ padding: 48, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
              Loading applicants...
            </p>
          ) : items.length === 0 ? (
            <EmptyState onAdd={() => setAddOpen(true)} />
          ) : (
            <div
              data-testid="applicants-list"
              style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '16px 16px 32px' }}
            >
              {items.map((item) => (
                <ApplicantRow key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </div>
      {addOpen && (
        <ManualAddSheet
          onClose={() => setAddOpen(false)}
          onSaved={() => {
            setAddOpen(false);
            load(filter);
          }}
        />
      )}
    </AgentShell>
  );
}

function ApplicantRow({ item }: { item: ApplicantListItem }) {
  const secondary = item.phone || item.email || 'No contact on file';
  const statusLabel = applicationStatusLabel(item.latestStatus);
  const propertyCopy =
    item.linkedPropertyCount === 0
      ? 'No properties linked'
      : item.linkedPropertyCount === 1
        ? '1 property'
        : `${item.linkedPropertyCount} properties`;

  return (
    <Link
      href={`/agent/applicants/${item.id}`}
      data-testid={`applicants-row-${item.id}`}
      className="agent-tappable"
      style={{
        display: 'block',
        background: '#FFFFFF',
        border: '0.5px solid rgba(0,0,0,0.06)',
        borderRadius: 14,
        padding: '14px 16px',
        textDecoration: 'none',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 4,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: '#0D0D12',
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {item.fullName}
          </span>
          {item.preferredCount > 0 && (
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#8A6E1F',
                background: 'rgba(196,155,42,0.12)',
                border: '0.5px solid rgba(196,155,42,0.35)',
                padding: '2px 7px',
                borderRadius: 999,
              }}
            >
              Preferred
            </span>
          )}
        </div>
        <span style={{ fontSize: 11, color: '#9CA3AF', flexShrink: 0 }}>
          {relativeTimestamp(item.lastActivityAt)}
        </span>
      </div>
      <div style={{ fontSize: 12.5, color: '#6B7280', marginBottom: 6 }}>{secondary}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 11.5, color: '#9CA3AF' }}>{propertyCopy}</span>
        <StatusPill status={item.latestStatus} label={statusLabel} />
      </div>
    </Link>
  );
}

function StatusPill({ status, label }: { status: string | null; label: string }) {
  const palette = pillPalette(status);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 10px',
        borderRadius: 999,
        background: palette.bg,
        color: palette.color,
        fontSize: 10.5,
        fontWeight: 600,
        letterSpacing: '0.02em',
      }}
    >
      {label}
    </span>
  );
}

function pillPalette(status: string | null): { bg: string; color: string } {
  switch (status) {
    case 'approved':
    case 'offer_accepted':
      return { bg: 'rgba(5,150,105,0.12)', color: '#047857' };
    case 'received':
    case 'referencing':
      return { bg: 'rgba(196,155,42,0.14)', color: '#8A6E1F' };
    case 'invited':
      return { bg: 'rgba(13,13,18,0.08)', color: '#374151' };
    case 'rejected':
    case 'withdrawn':
      return { bg: 'rgba(220,38,38,0.08)', color: '#B91C1C' };
    default:
      return { bg: 'rgba(0,0,0,0.04)', color: '#9CA3AF' };
  }
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div
      data-testid="applicants-empty-state"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '72px 32px',
        gap: 10,
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 20,
          background: 'rgba(196,155,42,0.08)',
          color: '#C49B2A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 8,
        }}
      >
        <Users size={28} />
      </div>
      <p style={{ fontSize: 15, fontWeight: 600, color: '#0D0D12', margin: 0 }}>
        No applicants yet
      </p>
      <p
        style={{
          fontSize: 12.5,
          color: '#9CA3AF',
          margin: 0,
          textAlign: 'center',
          maxWidth: 280,
          lineHeight: 1.5,
        }}
      >
        Add them from the Intelligence chat or tap the + button.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="agent-tappable"
        style={{
          marginTop: 8,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '10px 14px',
          background: 'linear-gradient(180deg, #D4AF37 0%, #C49B2A 100%)',
          border: 'none',
          borderRadius: 999,
          fontSize: 13,
          fontWeight: 600,
          color: '#FFFFFF',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <Plus size={14} strokeWidth={2.25} />
        Add an applicant
      </button>
    </div>
  );
}

function ManualAddSheet({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const trimmed = fullName.trim();
    if (trimmed.length === 0) {
      setError('Add a full name to save.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/agent-intelligence/confirm-applicants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          candidates: [{
            full_name: trimmed,
            email: email.trim() || null,
            phone: phone.trim() || null,
            notes: notes.trim() || null,
            source: 'other',
            classification: 'new',
          }],
          selected_indices: [0],
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Couldn't add applicant");
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add applicant");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add applicant"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(13,13,18,0.45)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#FFFFFF',
          width: '100%',
          maxWidth: 520,
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          padding: '20px 20px 24px',
          boxShadow: '0 -4px 32px rgba(0,0,0,0.18)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0D0D12', letterSpacing: '-0.02em' }}>
            Add an applicant
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="agent-tappable"
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              background: 'transparent',
              border: 'none',
              color: '#6B7280',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>
        <ManualField label="Full name" required value={fullName} onChange={setFullName} placeholder="Jack Murphy" autoFocus />
        <ManualField label="Email" type="email" value={email} onChange={setEmail} placeholder="jack@example.ie" />
        <ManualField label="Phone" type="tel" value={phone} onChange={setPhone} placeholder="087 123 4567" />
        <ManualField label="Notes" value={notes} onChange={setNotes} placeholder="Anything to remember about them" multiline />
        {error && (
          <p style={{ margin: 0, fontSize: 12.5, color: '#B91C1C' }}>{error}</p>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="agent-tappable"
            style={{
              flex: 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '12px 16px',
              background: 'linear-gradient(180deg, #D4AF37 0%, #C49B2A 100%)',
              border: 'none',
              borderRadius: 999,
              fontSize: 13.5,
              fontWeight: 600,
              color: '#FFFFFF',
              cursor: saving ? 'progress' : 'pointer',
              fontFamily: 'inherit',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            {saving ? 'Saving' : 'Save applicant'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="agent-tappable"
            style={{
              padding: '12px 16px',
              background: 'transparent',
              border: 'none',
              fontSize: 13.5,
              fontWeight: 500,
              color: '#6B7280',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function ManualField({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = 'text',
  multiline,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: 'text' | 'email' | 'tel';
  multiline?: boolean;
  autoFocus?: boolean;
}) {
  const inputStyle: React.CSSProperties = {
    padding: '10px 12px',
    fontSize: 14,
    border: '0.5px solid rgba(0,0,0,0.16)',
    borderRadius: 10,
    background: '#FFFFFF',
    color: '#0D0D12',
    fontFamily: 'inherit',
    width: '100%',
  };
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11.5, fontWeight: 600, color: '#6B7280' }}>
        {label}
        {required ? <span style={{ color: '#B91C1C', marginLeft: 3 }}>*</span> : null}
      </span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical', minHeight: 64 }}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          style={inputStyle}
        />
      )}
    </label>
  );
}
