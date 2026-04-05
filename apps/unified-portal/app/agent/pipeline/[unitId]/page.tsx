'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAgent } from '@/lib/agent/AgentContext';
import AgentBottomNav from '../../_components/AgentBottomNavNew';
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
  const { developmentId, agent } = useAgent();

  const [profile, setProfile] = useState<UnitProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!developmentId) return;
    setLoading(true);
    const data = await getUnitProfile(unitId, developmentId);
    setProfile(data);
    setLoading(false);
  }, [unitId, developmentId]);

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
    <div
      className="flex flex-col h-dvh bg-[#FAFAF8]"
      style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}
    >
      <main
        className="flex-1 overflow-y-auto overflow-x-hidden pb-52"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="px-5 pt-4">
          {/* Back */}
          <Link
            href="/agent/pipeline?preview=savills"
            className="flex items-center gap-1.5 text-sm text-gray-400 mb-4 transition-all active:opacity-70"
          >
            <ArrowLeft size={16} /> Back to Pipeline
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

          {/* Alert banners */}
          {isOverdue && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-center gap-2.5 mb-2">
              <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
              <span className="text-sm text-red-600">
                Contracts {contractDays} days overdue: solicitor follow-up
                needed
              </span>
            </div>
          )}
          {isMortgageUrgent && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2.5 mb-2">
              <Clock size={16} className="text-amber-600 flex-shrink-0" />
              <span className="text-sm text-amber-700">
                Mortgage approval expires in {mortgageDays} days
              </span>
            </div>
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
          <Section title="Property Details">
            <DetailRow label="Unit" value={`Unit ${profile.unitNumber}`} />
            <DetailRow
              label="Bedrooms"
              value={profile.bedrooms ? `${profile.bedrooms} bed` : null}
            />
            <DetailRow label="Price" value={formatCurrency(profile.salePrice)} />
            <DetailRow label="Address" value={profile.unitAddress} />
          </Section>

          {/* Contact Details */}
          {profile.purchaserName && (
            <Section title="Contact Details">
              {profile.purchaserPhone && (
                <a
                  href={`tel:${profile.purchaserPhone}`}
                  className="flex items-center gap-3 py-2 transition-all active:opacity-70"
                >
                  <Phone size={16} className="text-emerald-500" />
                  <span className="text-sm text-gray-900">
                    {profile.purchaserPhone}
                  </span>
                </a>
              )}
              {profile.purchaserEmail && (
                <a
                  href={`mailto:${profile.purchaserEmail}`}
                  className="flex items-center gap-3 py-2 transition-all active:opacity-70"
                >
                  <Mail size={16} className="text-emerald-500" />
                  <span className="text-sm text-gray-900">
                    {profile.purchaserEmail}
                  </span>
                </a>
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
            <Section title="Solicitor">
              <DetailRow label="Firm" value={solicitor.firm} />
              <DetailRow label="Contact" value={solicitor.contact} />
              {solicitor.phone && (
                <a
                  href={`tel:${solicitor.phone}`}
                  className="flex items-center gap-3 py-2 transition-all active:opacity-70"
                >
                  <Phone size={14} className="text-gray-400" />
                  <span className="text-sm text-gray-900">
                    {solicitor.phone}
                  </span>
                </a>
              )}
              {solicitor.email && (
                <a
                  href={`mailto:${solicitor.email}`}
                  className="flex items-center gap-3 py-2 transition-all active:opacity-70"
                >
                  <Mail size={14} className="text-gray-400" />
                  <span className="text-sm text-gray-900">
                    {solicitor.email}
                  </span>
                </a>
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
      </main>

      {/* Action buttons (fixed above bottom nav) */}
      <div
        className="fixed bottom-[76px] left-0 right-0 bg-[#FAFAF8] border-t border-gray-100 px-5 py-3 z-40"
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
      >
        {/* Intelligence button */}
        <button className="w-full py-3 rounded-full bg-gray-900 text-white text-sm font-medium flex items-center justify-center gap-2 mb-2 transition-all duration-150 active:scale-[0.98]">
          <Zap size={16} className="text-[#D4AF37]" />
          Follow up with Intelligence
        </button>
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

      <AgentBottomNav />
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-5 mb-2">
      <h2 className="text-[11px] font-semibold tracking-[0.06em] uppercase text-gray-400 mb-2.5">
        {title}
      </h2>
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
    <div className="flex items-center py-1.5">
      <span className="text-xs text-gray-400 w-20 flex-shrink-0">{label}</span>
      <span className="text-sm text-gray-900">
        {value !== null && value !== undefined ? String(value) : '\u2014'}
      </span>
    </div>
  );
}
