'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Users } from 'lucide-react';
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
            <EmptyState />
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

function EmptyState() {
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
          maxWidth: 260,
          lineHeight: 1.5,
        }}
      >
        Voice-log a viewing and they&apos;ll appear here.
      </p>
    </div>
  );
}
