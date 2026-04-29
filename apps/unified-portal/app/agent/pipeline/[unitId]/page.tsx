'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAgent } from '@/lib/agent/AgentContext';
import AgentShell from '../../_components/AgentShell';
import {
  getUnitProfile,
  logPipelineNote,
  formatDate,
  formatDateShort,
  formatCurrency,
  daysFromNow,
  daysSince,
  getInitials,
  generateIntelligenceSummary,
  type UnitProfile,
  type PipelineNote,
} from '@/lib/agent/agentPipelineService';
import ListingDetailView from '../../_components/ListingDetailView';
import {
  ArrowLeft,
  Zap,
  AlertTriangle,
  Clock,
  Phone,
  Mail,
  MapPin,
  ChevronRight,
  Calendar,
  FileText,
  Building2,
  CreditCard,
  Send,
  Shield,
  Home as HomeIcon,
  Check,
  CircleDot,
  Circle,
} from 'lucide-react';

export default function UnitProfilePage() {
  const params = useParams();
  const unitId = params.unitId as string;
  const { pipeline, agent, loading: agentLoading } = useAgent();

  const [profile, setProfile] = useState<UnitProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // For independent agents, render the listing detail view
  if (!agentLoading && agent && agent.agentType !== 'scheme') {
    return <ListingDetailView listingId={unitId} agent={agent} />;
  }

  const loadProfile = useCallback(async () => {
    if (!pipeline.length) return;
    setLoading(true);
    const data = await getUnitProfile(unitId, pipeline);
    setProfile(data);
    setLoading(false);
  }, [unitId, pipeline]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleSubmitNote = async () => {
    if (!noteText.trim() || !profile) return;
    setSubmitting(true);
    await logPipelineNote(unitId, profile.id, noteText.trim(), 'manual');
    setNoteText('');
    setSubmitting(false);
    loadProfile();
  };

  if (loading || !profile) {
    return (
      <div
        className="flex flex-col h-dvh bg-[#FAFAF8]"
        style={{ fontFamily: 'Inter, sans-serif' }}
      >
        <div className="flex-1 p-5 space-y-4">
          <div className="h-8 w-32 bg-gray-100 rounded animate-pulse" />
          <div className="h-16 bg-gray-100 rounded-2xl animate-pulse" />
          <div className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
          <div className="h-32 bg-gray-100 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  const initials = getInitials(profile.purchaserName);
  const summary = generateIntelligenceSummary(profile);
  const solicitor = profile.solicitor;
  const mortgage = profile.mortgage;

  // Alert conditions
  const contractDays =
    profile.contractsIssuedDate && !profile.signedContractsDate
      ? daysSince(profile.contractsIssuedDate)
      : null;
  const isOverdue = contractDays !== null && contractDays > 60;
  const mortgageDays = profile.mortgageExpiryDate
    ? daysFromNow(profile.mortgageExpiryDate)
    : null;
  const isMortgageUrgent =
    mortgageDays !== null && mortgageDays <= 45 && mortgageDays > 0;

  // Session 14d — wire the dead "Follow up with Intelligence" surfaces
  // to the existing Intelligence prefill rail. Builds a unit-specific
  // prompt that auto-fires via /agent/intelligence?prompt=...
  const unitContext = `${profile.unitNumber} ${profile.developmentName}`;
  const purchaserName = profile.purchaserName || 'the buyer';
  const followUpPrompt = isOverdue
    ? `Draft a contract chase email to ${purchaserName}'s solicitor for ${unitContext} — contracts have been outstanding for ${contractDays} days.`
    : isMortgageUrgent
      ? `Draft a mortgage approval extension follow-up email to ${purchaserName} for ${unitContext} — their mortgage approval expires in ${mortgageDays} days.`
      : `Draft a follow-up email to ${purchaserName} for ${unitContext}.`;
  const followUpHref = `/agent/intelligence?prompt=${encodeURIComponent(followUpPrompt)}`;

  const statusLabel: Record<string, string> = {
    for_sale: 'For Sale',
    sale_agreed: 'Sale Agreed',
    contracts_issued: 'Contracts Out',
    signed: 'Contracts Signed',
    sold: 'Sold',
  };
  const statusClass: Record<string, string> = {
    for_sale: 'bg-gray-100 text-gray-600',
    sale_agreed: 'bg-blue-50 text-blue-700',
    contracts_issued: 'bg-amber-50 text-amber-700 border border-amber-200',
    signed: 'bg-emerald-50 text-emerald-700',
    sold: 'bg-gray-50 text-gray-400',
  };

  // Timeline stages
  const stages = [
    { label: 'Sale Agreed', date: profile.saleAgreedDate },
    { label: 'Deposit Paid', date: profile.depositDate },
    { label: 'Contracts Issued', date: profile.contractsIssuedDate },
    { label: 'Contracts Signed', date: profile.signedContractsDate },
    { label: 'Snag Date', date: profile.snagDate },
    { label: 'Est. Closing', date: profile.estimatedCloseDate },
    { label: 'Handover', date: profile.handoverDate },
    {
      label: 'Kitchen Selected',
      date: profile.kitchenSelected ? 'Yes' : null,
    },
  ];

  return (
    <AgentShell agentName={agent?.displayName?.split(' ')[0]} urgentCount={0}>
      <div style={{ padding: '16px 20px 220px' }}>
          {/* Back */}
          <Link
            href={profile?.developmentId ? `/agent/pipeline/scheme/${profile.developmentId}` : '/agent/pipeline'}
            className="flex items-center gap-1.5 text-sm text-gray-400 mb-4 transition-all active:opacity-70"
          >
            <ArrowLeft size={16} /> Back to {profile?.developmentName || 'Pipeline'}
          </Link>

          {/* Purchaser header */}
          <div className="flex items-center gap-3.5 mb-4">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, #D4AF37, #E8C84A)',
              }}
            >
              <span className="text-white font-bold text-lg">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-gray-900 tracking-tight truncate">
                {profile.purchaserName || 'Available'}
              </h1>
              <p className="text-xs text-gray-400">
                Unit {profile.unitNumber} &middot; {profile.developmentName}
              </p>
              <span
                className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${statusClass[profile.status] || ''}`}
              >
                {statusLabel[profile.status] || profile.status}
              </span>
            </div>
          </div>

          {/* AI Summary */}
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3.5 mb-3">
            <div className="flex items-center gap-2 mb-1.5">
              <Zap size={14} className="text-[#D4AF37]" />
              <span className="text-xs font-semibold text-amber-800">
                Intelligence Summary
              </span>
            </div>
            <p className="text-sm text-amber-800">{summary}</p>
          </div>

          {/* Alert banners — Session 14d: now tappable, route to the
              Intelligence page with a unit-specific draft prompt that
              auto-fires. Chevron at the trailing edge signals tappability. */}
          {isOverdue && (
            <Link
              href={followUpHref}
              className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-center gap-2.5 mb-2 no-underline agent-tappable hover:bg-red-100/50 transition-colors"
            >
              <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
              <span className="text-sm text-red-600 flex-1">
                Contracts {contractDays} days overdue: solicitor follow-up needed
              </span>
              <span className="text-red-400 text-sm" aria-hidden>›</span>
            </Link>
          )}
          {isMortgageUrgent && (
            <Link
              href={followUpHref}
              className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2.5 mb-2 no-underline agent-tappable hover:bg-amber-100/50 transition-colors"
            >
              <Clock size={16} className="text-amber-600 flex-shrink-0" />
              <span className="text-sm text-amber-700 flex-1">
                Mortgage approval expires in {mortgageDays} days
              </span>
              <span className="text-amber-500 text-sm" aria-hidden>›</span>
            </Link>
          )}

          {/* Intelligence Activity */}
          <Section title="Intelligence Activity">
            {profile.notes.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-3">
                No activity logged yet
              </p>
            ) : (
              <div className="space-y-3">
                {[...profile.notes]
                  .sort(
                    (a, b) =>
                      new Date(b.createdAt).getTime() -
                      new Date(a.createdAt).getTime()
                  )
                  .map((note) => (
                  <div key={note.id} className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-[#D4AF37]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Zap size={12} className="text-[#D4AF37]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
                          {note.noteType}
                        </span>
                        <span className="text-[10px] text-gray-300">
                          {formatDateShort(note.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mt-0.5">
                        {note.content}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Property Details */}
          <Section title="Property Details" icon={<HomeIcon size={14} className="text-gray-400" />}>
            <DetailRow label="Type" value={profile.propertySpec?.type || (profile.bedrooms ? `${profile.bedrooms}-bed` : null)} />
            <DetailRow label="Bedrooms" value={profile.bedrooms ? String(profile.bedrooms) : null} />
            {profile.propertySpec && (
              <>
                <DetailRow label="Size" value={`${profile.propertySpec.sqMetres} m\u00B2 / ${profile.propertySpec.sqFeet.toLocaleString()} sq ft`} />
                <div className="flex items-center py-1.5">
                  <span className="text-xs text-gray-400 w-24 flex-shrink-0">BER Rating</span>
                  <span className="text-sm font-semibold" style={{ color: profile.propertySpec.ber.startsWith('A') ? '#059669' : '#D97706' }}>
                    {profile.propertySpec.ber}
                  </span>
                </div>
                <DetailRow label="Floors" value={String(profile.propertySpec.floors)} />
                <DetailRow label="Orientation" value={profile.propertySpec.orientation} />
                <DetailRow label="Parking" value={profile.propertySpec.parking} />
                <DetailRow label="Heating" value={profile.propertySpec.heating} />
              </>
            )}
            <DetailRow label="Price" value={formatCurrency(profile.salePrice)} />
          </Section>

          {/* Contact Details */}
          {profile.purchaserName && (
            <Section title="Contact Details" icon={<Mail size={14} className="text-gray-400" />}>
              {profile.purchaserPhone && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs text-gray-400">Phone</span>
                  <a href={`tel:${profile.purchaserPhone}`} className="text-sm text-[#D4AF37] font-medium transition-all active:opacity-70">
                    {profile.purchaserPhone}
                  </a>
                </div>
              )}
              {profile.purchaserEmail && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs text-gray-400">Email</span>
                  <a href={`mailto:${profile.purchaserEmail}`} className="text-sm text-[#D4AF37] font-medium transition-all active:opacity-70">
                    {profile.purchaserEmail}
                  </a>
                </div>
              )}
              {profile.unitAddress && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs text-gray-400">Address</span>
                  <span className="text-sm text-gray-900">{profile.unitAddress}</span>
                </div>
              )}
            </Section>
          )}

          {/* Sales Timeline */}
          <Section title="Sales Timeline">
            <div className="space-y-2.5">
              {stages.map((s, i) => {
                const completed = s.date !== null;
                const dateDisplay =
                  s.date === 'Yes'
                    ? 'Yes'
                    : s.date
                      ? formatDate(s.date)
                      : '';
                return (
                  <div key={i} className="flex items-center gap-3">
                    {completed ? (
                      <Check
                        size={16}
                        className="text-emerald-500 flex-shrink-0"
                      />
                    ) : (
                      <Circle
                        size={16}
                        className="text-gray-200 flex-shrink-0"
                      />
                    )}
                    <span
                      className={`text-sm flex-1 ${completed ? 'text-gray-900' : 'text-gray-300'}`}
                    >
                      {s.label}
                    </span>
                    <span
                      className={`text-xs ${completed ? 'text-gray-500' : 'text-gray-200'}`}
                    >
                      {dateDisplay || '\u2014'}
                    </span>
                  </div>
                );
              })}
            </div>
          </Section>

          {/* Solicitor */}
          {solicitor && (
            <Section title="Solicitor" icon={<Shield size={14} className="text-gray-400" />}>
              <DetailRow label="Firm" value={solicitor.firm} />
              <DetailRow label="Contact" value={solicitor.contact} />
              {solicitor.phone && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs text-gray-400">Phone</span>
                  <a href={`tel:${solicitor.phone}`} className="text-sm text-[#D4AF37] font-medium transition-all active:opacity-70">
                    {solicitor.phone}
                  </a>
                </div>
              )}
              {solicitor.email && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs text-gray-400">Email</span>
                  <a href={`mailto:${solicitor.email}`} className="text-sm text-[#D4AF37] font-medium transition-all active:opacity-70">
                    {solicitor.email}
                  </a>
                </div>
              )}
            </Section>
          )}

          {/* Mortgage */}
          {mortgage && (
            <Section title="Mortgage">
              <DetailRow label="Lender" value={mortgage.lender} />
              <DetailRow
                label="Approval"
                value={formatCurrency(mortgage.approval_amount)}
              />
              <div className="flex items-center gap-2 py-1.5">
                <span className="text-xs text-gray-400 w-20 flex-shrink-0">
                  Expires
                </span>
                <span className="text-sm text-gray-900">
                  {formatDate(mortgage.expiry_date)}
                </span>
                {isMortgageUrgent && (
                  <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-medium rounded-full">
                    {mortgageDays}d remaining
                  </span>
                )}
              </div>
            </Section>
          )}

          {/* Documents — Session 6C: alternative entry point to /agent/docs
              now that Docs is off the bottom nav. Filtered to the unit's
              parent scheme so the agent lands on the relevant shelf. */}
          <Link
            href={`/agent/docs?scheme=${encodeURIComponent(profile.developmentId || '')}`}
            data-testid="unit-docs-link"
            className="agent-tappable"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '14px 16px',
              background: '#FFFFFF',
              borderRadius: 14,
              marginBottom: 12,
              textDecoration: 'none',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.04)',
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                background: 'rgba(13,13,18,0.05)',
                border: '1px solid rgba(13,13,18,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <FileText size={16} color="#6B7280" strokeWidth={1.8} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#0D0D12', letterSpacing: '-0.01em' }}>
                View documents
              </div>
              <div style={{ fontSize: 12, color: '#A0A8B0', marginTop: 2 }}>
                BER, brochures, forms for {profile.developmentName}
              </div>
            </div>
            <ChevronRight size={16} color="#B0B8C4" />
          </Link>

          {/* Note Logger */}
          <Section title="Log a note">
            <div className="space-y-2">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="e.g. Spoke with solicitor: contracts expected next week"
                className="w-full p-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-300 resize-none focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/20"
                rows={3}
              />
              <button
                onClick={handleSubmitNote}
                disabled={!noteText.trim() || submitting}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium disabled:opacity-40 transition-all duration-150 active:scale-[0.98]"
              >
                <Send size={14} />
                {submitting ? 'Saving...' : 'Submit Note'}
              </button>
            </div>
          </Section>
        </div>

      {/* Action buttons (fixed above bottom nav) */}
      <div
        className="fixed bottom-[76px] left-0 right-0 bg-[#FAFAF8] border-t border-gray-100 px-5 py-3 z-40"
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
      >
        {/* Intelligence button — Session 14d: real Link to a prefilled
            Intelligence prompt that auto-fires the appropriate draft tool. */}
        <Link
          href={followUpHref}
          className="w-full py-3 rounded-full bg-gray-900 text-white text-sm font-medium flex items-center justify-center gap-2 mb-2 transition-all duration-150 active:scale-[0.98] no-underline"
        >
          <Zap size={16} className="text-[#D4AF37]" />
          Follow up with Intelligence
        </Link>
        {/* Action row */}
        <div className="flex gap-2">
          {profile.purchaserPhone ? (
            <a
              href={`tel:${profile.purchaserPhone}`}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-center text-sm font-medium text-gray-700 flex items-center justify-center gap-1.5 transition-all duration-150 active:scale-[0.98]"
              style={{ minHeight: 44 }}
            >
              <Phone size={14} /> Call
            </a>
          ) : (
            <span
              className="flex-1 py-2.5 rounded-xl border border-gray-100 text-center text-sm font-medium text-gray-300 flex items-center justify-center gap-1.5"
              style={{ minHeight: 44 }}
            >
              <Phone size={14} /> Call
            </span>
          )}
          {profile.purchaserEmail ? (
            <a
              href={`mailto:${profile.purchaserEmail}`}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-center text-sm font-medium text-gray-700 flex items-center justify-center gap-1.5 transition-all duration-150 active:scale-[0.98]"
              style={{ minHeight: 44 }}
            >
              <Mail size={14} /> Email
            </a>
          ) : (
            <span
              className="flex-1 py-2.5 rounded-xl border border-gray-100 text-center text-sm font-medium text-gray-300 flex items-center justify-center gap-1.5"
              style={{ minHeight: 44 }}
            >
              <Mail size={14} /> Email
            </span>
          )}
          {solicitor?.phone ? (
            <a
              href={`tel:${solicitor.phone}`}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-center text-sm font-medium text-gray-700 flex items-center justify-center gap-1.5 transition-all duration-150 active:scale-[0.98]"
              style={{ minHeight: 44 }}
            >
              <Shield size={14} /> Solicitor
            </a>
          ) : (
            <span
              className="flex-1 py-2.5 rounded-xl border border-gray-100 text-center text-sm font-medium text-gray-300 flex items-center justify-center gap-1.5"
              style={{ minHeight: 44 }}
            >
              <Shield size={14} /> Solicitor
            </span>
          )}
        </div>
      </div>

    </AgentShell>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-5 mb-2">
      <div className="flex items-center gap-2 mb-2.5">
        {icon}
        <h2 className="text-[11px] font-semibold tracking-[0.06em] uppercase text-gray-400">
          {title}
        </h2>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        {children}
      </div>
    </section>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-sm text-gray-900 text-right">
        {value !== null && value !== undefined ? String(value) : '\u2014'}
      </span>
    </div>
  );
}
