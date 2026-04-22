'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Briefcase,
  CalendarCheck,
  Cigarette,
  Dog,
  Euro,
  Home as HomeIcon,
  Mail,
  Phone,
  Shield,
  Send as SendIcon,
  Sparkles,
  Users,
} from 'lucide-react';
import AgentShell from '../../_components/AgentShell';
import { useAgent } from '@/lib/agent/AgentContext';
import {
  amlLabel,
  applicationStatusLabel,
  employmentLabel,
  formatCurrency,
  referencesLabel,
  type ApplicantDetail,
} from '@/lib/agent-intelligence/applicants';
import { relativeTimestamp } from '@/lib/agent-intelligence/drafts';

export default function ApplicantDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { agent, alerts } = useAgent();
  const [applicant, setApplicant] = useState<ApplicantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/agent/applicants/${params.id}`, { cache: 'no-store' });
      if (res.status === 404) { setNotFound(true); return; }
      if (!res.ok) return;
      const data = await res.json();
      setApplicant(data.applicant);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => { load(); }, [load]);

  const handleInvite = () => {
    if (!applicant) return;
    const intent = `draft_application_invitation:${applicant.id}`;
    router.push(`/agent/intelligence?intent=${encodeURIComponent(intent)}&prompt=${encodeURIComponent(
      `Invite ${applicant.fullName} to apply.`
    )}`);
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
            padding: '12px 16px',
            borderBottom: '0.5px solid rgba(0,0,0,0.05)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Link
            href="/agent/applicants"
            aria-label="Back"
            className="agent-tappable"
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0D0D12',
              textDecoration: 'none',
            }}
          >
            <ArrowLeft size={18} />
          </Link>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: '#0D0D12',
                letterSpacing: '-0.02em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {applicant?.fullName || 'Applicant'}
            </div>
            {applicant && (
              <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 2 }}>
                Source: {sourceLabel(applicant.source)}
              </div>
            )}
          </div>
        </header>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            padding: '16px 16px 32px',
          }}
        >
          {loading && !applicant && (
            <p style={{ padding: 48, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
              Loading applicant...
            </p>
          )}
          {notFound && (
            <p style={{ padding: 48, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
              Applicant not found. They may have been deleted.
            </p>
          )}
          {applicant && (
            <>
              <ContactCard applicant={applicant} />
              <SignalsSection applicant={applicant} />
              <ViewingsList applicant={applicant} />
              <ApplicationsList applicant={applicant} />
              <CtaRow applicant={applicant} onInvite={handleInvite} />
            </>
          )}
        </div>
      </div>
    </AgentShell>
  );
}

function ContactCard({ applicant }: { applicant: ApplicantDetail }) {
  return (
    <section
      style={{
        background: '#FFFFFF',
        borderRadius: 14,
        border: '0.5px solid rgba(0,0,0,0.06)',
        padding: '14px 16px',
        marginBottom: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <ContactLine icon={<Mail size={13} />} label={applicant.email || 'No email on file'} />
      <ContactLine icon={<Phone size={13} />} label={applicant.phone || 'No phone on file'} />
      {applicant.currentAddress && (
        <ContactLine icon={<HomeIcon size={13} />} label={applicant.currentAddress} />
      )}
      {applicant.latestStatus && (
        <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>
          Latest status: <strong style={{ color: '#0D0D12' }}>{applicationStatusLabel(applicant.latestStatus)}</strong>
          <span style={{ color: '#9CA3AF', marginLeft: 6 }}>
            {relativeTimestamp(applicant.lastActivityAt)}
          </span>
        </div>
      )}
    </section>
  );
}

function ContactLine({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151' }}>
      <span style={{ color: '#9CA3AF' }}>{icon}</span>
      <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {label}
      </span>
    </div>
  );
}

function SignalsSection({ applicant }: { applicant: ApplicantDetail }) {
  const s = applicant.signals;
  const incomeCopy =
    s.annualIncome != null
      ? `${formatCurrency(s.annualIncome)} per year${
          s.incomeToRentRatio ? ` · ${s.incomeToRentRatio.toFixed(1)}x annual rent` : ''
        }`
      : 'Not captured yet';
  const householdPieces: string[] = [];
  if (s.householdSize != null) householdPieces.push(`${s.householdSize} people`);
  if (s.hasPets === true) householdPieces.push(s.petDetails ? `pets (${s.petDetails})` : 'pets');
  if (s.hasPets === false) householdPieces.push('no pets');
  if (s.smoker === true) householdPieces.push('smoker');
  if (s.smoker === false) householdPieces.push('non-smoker');

  return (
    <section
      data-testid="applicant-signals"
      style={{
        background: '#FFFFFF',
        borderRadius: 14,
        border: '0.5px solid rgba(0,0,0,0.06)',
        padding: '14px 16px',
        marginBottom: 14,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 12,
          fontSize: 11,
          fontWeight: 600,
          color: '#8A6E1F',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        <Sparkles size={12} />
        Signals at a glance
      </div>
      <SignalRow
        icon={<Briefcase size={14} />}
        label="Employment"
        value={`${employmentLabel(s.employmentStatus)}${s.employer ? ` · ${s.employer}` : ''}`}
      />
      <SignalRow icon={<Euro size={14} />} label="Income" value={incomeCopy} />
      <SignalRow
        icon={<Users size={14} />}
        label="Household"
        value={householdPieces.length ? householdPieces.join(' · ') : 'Not captured yet'}
      />
      <SignalRow
        icon={<Dog size={14} />}
        label="Pets"
        value={
          s.hasPets === true
            ? (s.petDetails || 'Yes')
            : s.hasPets === false
              ? 'None'
              : 'Not captured'
        }
      />
      <SignalRow
        icon={<Cigarette size={14} />}
        label="Smoker"
        value={s.smoker == null ? 'Not captured' : s.smoker ? 'Yes' : 'No'}
      />
      <SignalRow
        icon={<Shield size={14} />}
        label="References"
        value={referencesLabel(s.referencesStatus)}
      />
      <SignalRow
        icon={<Shield size={14} />}
        label="AML"
        value={amlLabel(s.amlStatus)}
      />
    </section>
  );
}

function SignalRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontSize: 13,
        padding: '8px 0',
        borderBottom: '0.5px solid rgba(0,0,0,0.04)',
      }}
    >
      <span style={{ width: 18, color: '#9CA3AF', display: 'flex' }}>{icon}</span>
      <span style={{ width: 96, color: '#9CA3AF', fontSize: 11.5 }}>{label}</span>
      <span style={{ flex: 1, color: '#0D0D12', fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function ViewingsList({ applicant }: { applicant: ApplicantDetail }) {
  if (applicant.viewings.length === 0) return null;
  return (
    <section style={{ marginBottom: 14 }}>
      <h2 style={sectionHeading}>
        <CalendarCheck size={12} /> Viewings
      </h2>
      <div style={listStyle}>
        {applicant.viewings.map((v) => (
          <div key={v.id} style={listRowStyle}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0D0D12' }}>
                {v.propertyAddress || 'Unknown property'}
              </div>
              <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 2 }}>
                {relativeTimestamp(v.viewingDate)}
                {v.interestLevel ? ` · ${v.interestLevel} interest` : ''}
              </div>
            </div>
            {v.wasPreferred && (
              <span style={preferredPill}>Preferred</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function ApplicationsList({ applicant }: { applicant: ApplicantDetail }) {
  if (applicant.applications.length === 0) return null;
  return (
    <section style={{ marginBottom: 14 }}>
      <h2 style={sectionHeading}>
        <Shield size={12} /> Applications
      </h2>
      <div style={listStyle}>
        {applicant.applications.map((a) => (
          <div key={a.id} style={listRowStyle}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0D0D12' }}>
                {a.propertyAddress || 'Unknown property'}
              </div>
              <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 2 }}>
                {relativeTimestamp(a.applicationDate)}
                {a.rentPcm ? ` · ${formatCurrency(a.rentPcm)} pcm` : ''}
              </div>
            </div>
            <span style={applicationStatusPill(a.status)}>
              {applicationStatusLabel(a.status)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function CtaRow({ applicant, onInvite }: { applicant: ApplicantDetail; onInvite: () => void }) {
  return (
    <section style={{ display: 'flex', gap: 10 }}>
      <button
        data-testid="applicant-invite-cta"
        onClick={onInvite}
        className="agent-tappable"
        style={{
          flex: 1,
          padding: '12px 14px',
          background: 'linear-gradient(135deg, #C49B2A, #E8C84A)',
          color: '#fff',
          border: 'none',
          borderRadius: 12,
          fontSize: 13.5,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          boxShadow: '0 2px 6px rgba(196,155,42,0.25)',
        }}
      >
        <SendIcon size={14} />
        Draft application invitation
      </button>
      <Link
        href={`/agent/applicants/${applicant.id}/edit`}
        className="agent-tappable"
        style={{
          padding: '12px 18px',
          background: 'transparent',
          border: '0.5px solid rgba(0,0,0,0.12)',
          borderRadius: 12,
          fontSize: 13,
          fontWeight: 500,
          color: '#6B7280',
          cursor: 'pointer',
          fontFamily: 'inherit',
          textDecoration: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        Edit
      </Link>
    </section>
  );
}

const sectionHeading: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: '#9CA3AF',
  margin: '0 0 8px 4px',
};

const listStyle: React.CSSProperties = {
  background: '#FFFFFF',
  borderRadius: 14,
  border: '0.5px solid rgba(0,0,0,0.06)',
  overflow: 'hidden',
};

const listRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '12px 14px',
  borderBottom: '0.5px solid rgba(0,0,0,0.04)',
};

const preferredPill: React.CSSProperties = {
  fontSize: 9.5,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: '#8A6E1F',
  background: 'rgba(196,155,42,0.12)',
  border: '0.5px solid rgba(196,155,42,0.35)',
  padding: '2px 7px',
  borderRadius: 999,
};

function applicationStatusPill(status: string): React.CSSProperties {
  const palette = {
    invited: { bg: 'rgba(13,13,18,0.08)', color: '#374151' },
    received: { bg: 'rgba(196,155,42,0.14)', color: '#8A6E1F' },
    referencing: { bg: 'rgba(196,155,42,0.14)', color: '#8A6E1F' },
    approved: { bg: 'rgba(5,150,105,0.12)', color: '#047857' },
    offer_accepted: { bg: 'rgba(5,150,105,0.12)', color: '#047857' },
    rejected: { bg: 'rgba(220,38,38,0.08)', color: '#B91C1C' },
    withdrawn: { bg: 'rgba(220,38,38,0.08)', color: '#B91C1C' },
  } as const;
  const c = (palette as any)[status] || { bg: 'rgba(0,0,0,0.04)', color: '#9CA3AF' };
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 10px',
    borderRadius: 999,
    background: c.bg,
    color: c.color,
    fontSize: 10.5,
    fontWeight: 600,
    letterSpacing: '0.02em',
  };
}

function sourceLabel(s: string): string {
  const map: Record<string, string> = {
    daft: 'Daft',
    myhome: 'MyHome',
    rent_ie: 'Rent.ie',
    facebook: 'Facebook',
    walk_in: 'Walk-in',
    word_of_mouth: 'Word of mouth',
    other: 'Other',
    unknown: 'Not recorded',
  };
  return map[s] || s;
}
