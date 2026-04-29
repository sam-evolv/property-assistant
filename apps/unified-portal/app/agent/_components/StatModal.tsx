'use client';

import { useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { StatModalType, Scheme, Buyer } from './types';

// Session 14d — second slice of the urgent drill-down. Mortgage-expiry
// alerts now render in their own section so the modal count matches the
// home stat. Shape mirrors the home page's `ExpiringMortgage` exactly.
export interface ExpiringMortgage {
  id: string;
  name: string;
  unit: string;
  schemeName: string;
  daysUntilExpiry: number;
}

interface StatModalProps {
  type: StatModalType;
  onClose: () => void;
  schemes: Scheme[];
  totalSold: number;
  totalActive: number;
  urgentBuyers: Buyer[];
  expiringMortgages: ExpiringMortgage[];
}

export default function StatModal({
  type,
  onClose,
  schemes,
  totalSold,
  totalActive,
  urgentBuyers,
  expiringMortgages,
}: StatModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!type) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
    >
      {/* Backdrop */}
      <div
        className="sheet-backdrop-enter"
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.50)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      />

      {/* Sheet */}
      <div
        className="sheet-enter"
        style={{
          position: 'relative',
          background: '#FFFFFF',
          borderRadius: '28px 28px 0 0',
          maxHeight: '88dvh',
          overflowY: 'auto',
          overflowX: 'hidden',
          scrollbarWidth: 'none',
          boxShadow: '0 -4px 32px rgba(0,0,0,0.12)',
        }}
      >
        {/* Handle */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            paddingTop: 14,
            paddingBottom: 8,
          }}
        >
          <div
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              background: '#E0E0DC',
            }}
          />
        </div>

        <div style={{ padding: '0 24px 32px' }}>
          {type === 'sold' && (
            <SoldContent schemes={schemes} totalSold={totalSold} />
          )}
          {type === 'active' && (
            <ActiveContent schemes={schemes} totalActive={totalActive} />
          )}
          {type === 'urgent' && (
            <UrgentContent urgentBuyers={urgentBuyers} expiringMortgages={expiringMortgages} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Sold drill-down ─── */
function SoldContent({
  schemes,
  totalSold,
}: {
  schemes: Scheme[];
  totalSold: number;
}) {
  const year = new Date().getFullYear();
  const totalValue = schemes.reduce(
    (sum, s) =>
      sum +
      s.buyers
        .filter((b) => b.status !== 'available')
        .reduce((acc, b) => acc + b.price, 0),
    0
  );

  return (
    <>
      <SectionLabel>Portfolio overview</SectionLabel>
      <h3
        style={{
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: '-0.04em',
          color: '#0D0D12',
          margin: '4px 0 4px',
        }}
      >
        {totalSold} units sold
      </h3>
      <p
        style={{
          fontSize: 13,
          color: '#A0A8B0',
          margin: '0 0 20px',
          letterSpacing: '0.005em',
        }}
      >
        Across {schemes.length} active schemes &middot; {year}
      </p>

      {schemes.map((s) => (
        <Link
          key={s.id}
          href={`/agent/pipeline/${s.id}`}
          className="agent-tappable"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 0',
            borderBottom: '1px solid rgba(0,0,0,0.04)',
            textDecoration: 'none',
          }}
        >
          <span
            style={{
              flex: 1,
              fontSize: 14,
              fontWeight: 500,
              color: '#0D0D12',
              letterSpacing: '-0.01em',
            }}
          >
            {s.name}
          </span>
          <span
            className="gold-text"
            style={{ fontSize: 13, fontWeight: 700, marginRight: 8 }}
          >
            {s.percentSold}%
          </span>
          <div
            style={{
              width: 48,
              height: 3,
              background: 'rgba(0,0,0,0.05)',
              borderRadius: 2,
              overflow: 'hidden',
              marginRight: 8,
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${s.percentSold}%`,
                background: 'linear-gradient(90deg, #B8960C, #E8C84A)',
                borderRadius: 2,
              }}
            />
          </div>
          <ChevronRightIcon />
        </Link>
      ))}

      {/* Total portfolio value card */}
      <div
        style={{
          marginTop: 20,
          padding: '16px 18px',
          background: 'linear-gradient(135deg, #FFFBEB, #FEF9E7)',
          border: '1px solid rgba(212,175,55,0.2)',
          borderRadius: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: '#92400E',
            letterSpacing: '0.005em',
          }}
        >
          Total portfolio value
        </span>
        <span
          style={{
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: '-0.03em',
            color: '#0D0D12',
          }}
        >
          {formatCurrency(totalValue)}
        </span>
      </div>
    </>
  );
}

/* ─── Active buyers drill-down ─── */
function ActiveContent({
  schemes,
  totalActive,
}: {
  schemes: Scheme[];
  totalActive: number;
}) {
  return (
    <>
      <SectionLabel>Live pipeline</SectionLabel>
      <h3
        style={{
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: '-0.04em',
          color: '#0D0D12',
          margin: '4px 0 20px',
        }}
      >
        {totalActive} active buyers
      </h3>

      {schemes.map((s) => {
        const active = s.buyers.filter((b) => b.status !== 'available');
        if (active.length === 0) return null;
        return (
          <div key={s.id} style={{ marginBottom: 20 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase' as const,
                color: '#A0A8B0',
                marginBottom: 8,
              }}
            >
              {s.name}
            </div>
            {active.map((b) => (
              <div
                key={b.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 0',
                  borderBottom: '1px solid rgba(0,0,0,0.04)',
                }}
              >
                {/* Avatar */}
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    background: 'linear-gradient(135deg, #FFFBEB, #FEF3C7)',
                    border: '1px solid rgba(212,175,55,0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      color: '#92400E',
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {b.initials}
                  </span>
                </div>
                <span
                  style={{
                    flex: 1,
                    fontSize: 13,
                    fontWeight: 500,
                    color: '#0D0D12',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {b.name}
                </span>
                <StatusBadgeMini status={b.status} />
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}

/* ─── Urgent / needs attention drill-down ─── */

// Session 14d — build a dynamic Intelligence prompt from the urgent
// items. Sales-side draft tools (chase_aged_contracts, draft_message)
// understand "Draft contract chase emails to: …" and "Draft mortgage
// approval extension follow-ups to: …" intents per Session 14's
// TOOL-USE MANDATE; the Intelligence page auto-fires on ?prompt=… so
// the agent lands directly in the approval drawer.
function buildChasePrompt(contracts: Buyer[], mortgages: ExpiringMortgage[]): string {
  const parts: string[] = [];
  if (contracts.length > 0) {
    const list = contracts
      .map((c) => `${c.name} at ${c.schemeName} ${c.unit} (${c.daysOverdue}d overdue)`)
      .join('; ');
    parts.push(`Draft contract chase emails to: ${list}.`);
  }
  if (mortgages.length > 0) {
    const list = mortgages
      .map((m) => `${m.name} at ${m.schemeName} ${m.unit} (mortgage approval expires in ${m.daysUntilExpiry}d)`)
      .join('; ');
    parts.push(`Draft mortgage approval extension follow-ups to: ${list}.`);
  }
  return parts.join(' ');
}

function UrgentContent({
  urgentBuyers,
  expiringMortgages,
}: {
  urgentBuyers: Buyer[];
  expiringMortgages: ExpiringMortgage[];
}) {
  const total = urgentBuyers.length + expiringMortgages.length;
  const subhead = urgentBuyers.length > 0 && expiringMortgages.length > 0
    ? 'Contracts overdue · Mortgage approvals expiring'
    : urgentBuyers.length > 0
      ? 'Contracts overdue — solicitor follow-up needed'
      : expiringMortgages.length > 0
        ? 'Mortgage approvals expiring — extension needed'
        : 'No urgent items';

  const chasePrompt = buildChasePrompt(urgentBuyers, expiringMortgages);
  const chaseHref = chasePrompt
    ? `/agent/intelligence?prompt=${encodeURIComponent(chasePrompt)}`
    : '/agent/intelligence';

  return (
    <>
      <SectionLabel>Requires action</SectionLabel>
      <h3
        style={{
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: '-0.04em',
          color: '#0D0D12',
          margin: '4px 0 4px',
        }}
      >
        {total} items flagged
      </h3>
      <p
        style={{
          fontSize: 13,
          color: '#A0A8B0',
          margin: '0 0 20px',
          letterSpacing: '0.005em',
        }}
      >
        {subhead}
      </p>

      {urgentBuyers.length > 0 && (
        <>
          <SectionLabel>Contracts overdue</SectionLabel>
          {urgentBuyers.map((b) => (
            <UrgentRow key={b.id} name={b.name} subtitle={`${b.schemeName} · ${b.unit}`} pillText={`${b.daysOverdue}d`} pillTone="red" />
          ))}
        </>
      )}

      {expiringMortgages.length > 0 && (
        <div style={{ marginTop: urgentBuyers.length > 0 ? 20 : 0 }}>
          <SectionLabel>Mortgage approvals expiring</SectionLabel>
          {expiringMortgages.map((m) => (
            <UrgentRow key={m.id} name={m.name} subtitle={`${m.schemeName} · ${m.unit}`} pillText={`${m.daysUntilExpiry}d`} pillTone="amber" />
          ))}
        </div>
      )}

      {/* CTA button */}
      <Link
        href={chaseHref}
        className="agent-tappable"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          marginTop: 24,
          padding: '14px 20px',
          background: '#0D0D12',
          borderRadius: 16,
          textDecoration: 'none',
          boxShadow:
            '0 4px 24px rgba(0,0,0,0.20), 0 1px 4px rgba(0,0,0,0.12)',
        }}
      >
        <Image
          src="/oh-logo.png"
          alt=""
          width={18}
          height={18}
          style={{ objectFit: 'contain' }}
        />
        <span
          style={{
            color: '#FFFFFF',
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '-0.01em',
          }}
        >
          Chase all with Intelligence &rarr;
        </span>
      </Link>
    </>
  );
}

function UrgentRow({
  name,
  subtitle,
  pillText,
  pillTone,
}: {
  name: string;
  subtitle: string;
  pillText: string;
  pillTone: 'red' | 'amber';
}) {
  const pillStyle = pillTone === 'red'
    ? { background: '#FEF2F2', border: '1px solid rgba(239,68,68,0.2)', color: '#DC2626' }
    : { background: '#FEF3C7', border: '1px solid rgba(217,119,6,0.25)', color: '#92400E' };
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 0',
        borderBottom: '1px solid rgba(0,0,0,0.04)',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: '#0D0D12', letterSpacing: '-0.01em' }}>{name}</div>
        <div style={{ fontSize: 11.5, color: '#A0A8B0', marginTop: 2 }}>{subtitle}</div>
      </div>
      <span
        style={{
          ...pillStyle,
          borderRadius: 20,
          padding: '3px 8px',
          fontSize: 10,
          fontWeight: 700,
          whiteSpace: 'nowrap',
        }}
      >
        {pillText}
      </span>
    </div>
  );
}

/* ─── Helpers ─── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.06em',
        textTransform: 'uppercase' as const,
        color: '#A0A8B0',
        marginBottom: 4,
      }}
    >
      {children}
    </div>
  );
}

function StatusBadgeMini({ status }: { status: string }) {
  const configs: Record<string, { bg: string; color: string; label: string }> = {
    contracts_out: { bg: '#FEF2F2', color: '#B91C1C', label: 'CONTRACTS' },
    reserved: { bg: '#EFF6FF', color: '#1D4ED8', label: 'RESERVED' },
    exchanged: { bg: '#F5F3FF', color: '#5B21B6', label: 'EXCHANGED' },
    confirmed: { bg: '#ECFDF5', color: '#065F46', label: 'CONFIRMED' },
    pending: { bg: '#FFFBEB', color: '#92400E', label: 'PENDING' },
  };
  const c = configs[status] || configs.pending;
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.05em',
        color: c.color,
        background: c.bg,
        padding: '2px 7px',
        borderRadius: 10,
      }}
    >
      {c.label}
    </span>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#C0C8D4"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9,18 15,12 9,6" />
    </svg>
  );
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) {
    return '€' + (n / 1_000_000).toFixed(1) + 'm';
  }
  return '€' + n.toLocaleString('en-IE');
}
