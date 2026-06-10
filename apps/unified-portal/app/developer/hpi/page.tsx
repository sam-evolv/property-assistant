'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';

// =============================================================================
// Design Tokens - OpenHouse Brand (matching the rest of /developer exactly)
// =============================================================================

const tokens = {
  gold: '#D4AF37',
  goldLight: '#F5D874',
  dark: '#1a1a1a',
  cream: '#fafaf8',
  warmGray: '#f7f6f3',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  success: '#22c55e',
  amber: '#d97706',
  danger: '#ef4444',
};

const CATEGORY_LABELS: Record<string, string> = {
  EN: 'Environment',
  HW: 'Health & Wellbeing',
  EC: 'Economic',
  QA: 'Quality Assurance',
  SL: 'Sustainable Location',
};
const CATEGORY_ORDER = ['EN', 'HW', 'EC', 'QA', 'SL'];

// =============================================================================
// Types
// =============================================================================

interface HpiUnit {
  id: string;
  unit_number: string | null;
  address_line_1: string | null;
  purchaser_name: string | null;
  guide_issued: boolean;
  demo_completed: boolean;
  aftercare_activated: boolean;
  systems_documented: number;
  qa8_ready: boolean;
}

interface SchemeHpi {
  readinessPct: number;
  projectedTier: string; // label, e.g. "Certified (indicative)"
  mandatoryMet: boolean;
  gapCount: number;
}

interface HpiDevelopment {
  id: string;
  name: string;
  total_units: number;
  qa8_ready: number;
  guide_issued: number;
  demo_completed: number;
  aftercare_activated: number;
  units: HpiUnit[];
  hpi: SchemeHpi | null;
}

interface PortfolioRoi {
  evidenceItemsTracked: number;
  autoCapturedPct: number;
  spreadsheetsReplaced: number;
  assessorHoursSaved: number;
  disclaimer: string;
}

type IndicatorStatus = 'ready' | 'partial' | 'missing' | 'expiring';

interface GapItem {
  indicatorId: string;
  code: string;
  category: string;
  scope: string;
  unitId?: string;
  unitLabel?: string;
  responsibleParty: string;
  status: IndicatorStatus;
  detail: string;
}

interface IndicatorMatrixRow {
  indicatorId: string;
  code: string;
  category: string;
  label: string;
  scope: string;
  ready: number;
  total: number;
  responsibleParty: string;
}

interface SchemeDetail {
  development: { id: string; name: string; address: string | null; total_units: number };
  evaluation: {
    readinessPct: number;
    projectedTier: string;
    projectedTierLabel: string;
    mandatoryMet: boolean;
    itemsToNextTier: number | null;
    categoryBreakdown: Record<string, { pct: number; ready: number; total: number }>;
    indicatorMatrix: IndicatorMatrixRow[];
    gaps: GapItem[];
    perUnitQa8: HpiUnit[];
  };
  roi: { evidenceItemsTracked: number; autoCapturedPct: number; spreadsheetsReplaced: number; assessorHoursSaved: number };
  disclaimer: string;
}

// =============================================================================
// Icons
// =============================================================================

const HomeIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1V10" />
  </svg>
);
const BadgeIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);
const GaugeIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);
const AlertIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 00-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
  </svg>
);
const DownloadIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);
const MailIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);
const ChevronDownIcon = ({ open }: { open: boolean }) => (
  <svg className="w-4 h-4 transition-transform duration-200" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);
const CheckIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
  </svg>
);
const InfoIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

// =============================================================================
// Small components
// =============================================================================

function StatCard({ icon, iconBg, iconColor, label, value, subtitle }: {
  icon: React.ReactNode; iconBg: string; iconColor: string; label: string; value: number | string; subtitle?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 transition-all duration-200 hover:shadow-lg hover:border-gray-200">
      <div className="mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: iconBg, color: iconColor }}>
          {icon}
        </div>
      </div>
      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">{label}</p>
      <p className="text-3xl font-bold mt-1" style={{ color: tokens.dark }}>{value}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-3">{subtitle}</p>}
    </div>
  );
}

function RoiPill({ value, label, hint }: { value: string; label: string; hint: string }) {
  return (
    <div
      className="rounded-2xl border p-4 flex flex-col justify-between"
      style={{ borderColor: `${tokens.gold}33`, background: `linear-gradient(135deg, ${tokens.gold}0d, #ffffff)` }}
      title={hint}
    >
      <div className="flex items-center justify-between">
        <span className="text-2xl font-bold" style={{ color: tokens.dark }}>{value}</span>
        <span style={{ color: tokens.gold }}><InfoIcon /></span>
      </div>
      <span className="text-xs text-gray-600 mt-2 leading-snug">{label}</span>
    </div>
  );
}

function tierColor(label: string): { bg: string; fg: string } {
  if (/gold/i.test(label)) return { bg: '#fef3c7', fg: '#b45309' };
  if (/silver/i.test(label)) return { bg: '#f1f5f9', fg: '#475569' };
  if (/certified/i.test(label) && !/below|approaching/i.test(label)) return { bg: '#dcfce7', fg: '#15803d' };
  return { bg: '#fef3c7', fg: tokens.amber }; // below / approaching
}

function TierChip({ label, title }: { label: string; title?: string }) {
  const c = tierColor(label);
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap" style={{ backgroundColor: c.bg, color: c.fg }} title={title}>
      <BadgeIcon />
      {label}
    </span>
  );
}

function StatusPill({ status }: { status: IndicatorStatus }) {
  const map: Record<IndicatorStatus, { bg: string; fg: string; text: string }> = {
    ready: { bg: '#dcfce7', fg: '#15803d', text: 'Ready' },
    partial: { bg: '#dbeafe', fg: '#1d4ed8', text: 'In progress' },
    expiring: { bg: '#fef3c7', fg: tokens.amber, text: 'Renew' },
    missing: { bg: '#fee2e2', fg: '#b91c1c', text: 'Missing' },
  };
  const c = map[status];
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: c.bg, color: c.fg }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.fg }} />
      {c.text}
    </span>
  );
}

function EvidenceTick({ on }: { on: boolean }) {
  return on ? (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full" style={{ backgroundColor: '#dcfce7', color: '#16a34a' }}><CheckIcon /></span>
  ) : (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-300 text-xs font-bold">–</span>
  );
}

function CoverageCell({ ready, total }: { ready: number; total: number }) {
  const pct = total > 0 ? Math.round((ready / total) * 100) : 0;
  const color = pct === 100 ? tokens.success : pct > 0 ? tokens.gold : '#d1d5db';
  return (
    <div className="flex items-center gap-2 justify-end">
      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-semibold text-gray-500 w-9 text-right">{ready}/{total}</span>
    </div>
  );
}

function CategoryBar({ cat, pct, ready, total }: { cat: string; pct: number; ready: number; total: number }) {
  const color = pct >= 88 ? tokens.success : pct >= 50 ? tokens.gold : tokens.amber;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold" style={{ color: tokens.dark }}>{CATEGORY_LABELS[cat] ?? cat}</span>
        <span className="text-xs text-gray-400">{ready}/{total} · {pct}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

// =============================================================================
// Page
// =============================================================================

export default function DeveloperHpiPage() {
  const [developments, setDevelopments] = useState<HpiDevelopment[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioRoi | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, SchemeDetail | 'loading' | 'error'>>({});
  const [draftModal, setDraftModal] = useState<{ subject: string; body: string; mailto: string; party: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/developer/hpi/summary')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else {
          const list: HpiDevelopment[] = d.developments ?? [];
          list.sort(
            (a, b) =>
              (b.hpi?.readinessPct ?? -1) - (a.hpi?.readinessPct ?? -1) ||
              b.qa8_ready - a.qa8_ready ||
              b.total_units - a.total_units ||
              a.name.localeCompare(b.name)
          );
          setDevelopments(list);
          setPortfolio(d.portfolio ?? null);
        }
      })
      .catch(() => setError('Failed to load HPI readiness'))
      .finally(() => setLoading(false));
  }, []);

  const totals = useMemo(() => {
    let units = 0, qa8 = 0, gaps = 0, weightedReadiness = 0, readinessUnits = 0;
    for (const d of developments) {
      units += d.total_units;
      qa8 += d.qa8_ready;
      if (d.hpi) {
        gaps += d.hpi.gapCount;
        weightedReadiness += d.hpi.readinessPct * d.total_units;
        readinessUnits += d.total_units;
      }
    }
    return {
      units,
      qa8,
      gaps,
      avgReadiness: readinessUnits > 0 ? Math.round(weightedReadiness / readinessUnits) : 0,
    };
  }, [developments]);

  const toggle = useCallback((id: string) => {
    setExpanded((cur) => (cur === id ? null : id));
    setDetails((cur) => {
      if (cur[id]) return cur;
      // lazy-load the deep scheme view on first open
      fetch(`/api/developer/hpi/scheme/${id}`)
        .then((r) => r.json())
        .then((data) => {
          setDetails((d2) => ({ ...d2, [id]: data.error ? 'error' : (data as SchemeDetail) }));
        })
        .catch(() => setDetails((d2) => ({ ...d2, [id]: 'error' })));
      return { ...cur, [id]: 'loading' };
    });
  }, []);

  const draftRequest = useCallback(async (devId: string, party: string) => {
    try {
      const res = await fetch(`/api/developer/hpi/scheme/${devId}/draft-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responsibleParty: party }),
      });
      const data = await res.json();
      if (data.error) return;
      setCopied(false);
      setDraftModal({ subject: data.subject, body: data.body, mailto: data.mailto, party });
    } catch {
      /* ignore */
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center" style={{ backgroundColor: tokens.cream }}>
        <div className="text-center">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin mx-auto" style={{ borderColor: tokens.gold, borderTopColor: 'transparent' }} />
          <p className="text-sm text-gray-500 mt-3">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-full flex items-center justify-center" style={{ backgroundColor: tokens.cream }}>
        <div className="text-center">
          <p className="text-sm text-red-500 mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2 text-sm font-medium rounded-xl" style={{ backgroundColor: tokens.gold, color: tokens.dark }}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full" style={{ backgroundColor: tokens.cream }}>
      <div className="p-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: tokens.dark }}>HPI Readiness</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Whole-scheme Home Performance Index evidence — what's assembled, what's missing, and who to chase. {' '}
            <span className="text-gray-400">Readiness is indicative, not an official IGBC assessment.</span>
          </p>
        </div>

        {/* ROI / value strip */}
        {portfolio && (
          <div className="grid grid-cols-4 gap-5 mb-6">
            <RoiPill value={String(portfolio.evidenceItemsTracked)} label="Evidence items tracked across your portfolio" hint="Every HPI evidence item OpenHouse is tracking (handover events, issued guides, commissioned systems, and uploaded certificates that aren't missing)." />
            <RoiPill value={`${portfolio.autoCapturedPct}%`} label="Auto-captured by OpenHouse" hint="Share of tracked evidence captured automatically (handover demos, Home User Guides, system commissioning) versus manual document uploads." />
            <RoiPill value={String(portfolio.spreadsheetsReplaced)} label="Evidence trackers replaced" hint="One evidence-tracking spreadsheet replaced per scheme now tracked in OpenHouse." />
            <RoiPill value={`${portfolio.assessorHoursSaved}h`} label="Assessor review hours saved" hint="Estimated at ~3.5 minutes saved per pre-assembled evidence item versus assembling a pack by hand." />
          </div>
        )}

        {/* Portfolio scorecards */}
        <div className="grid grid-cols-4 gap-5 mb-8">
          <StatCard icon={<HomeIcon />} iconBg="#fef3c7" iconColor={tokens.gold} label="Total Homes" value={totals.units} />
          <StatCard icon={<GaugeIcon />} iconBg="#dcfce7" iconColor="#16a34a" label="Avg HPI Readiness" value={`${totals.avgReadiness}%`} subtitle="Weighted across schemes" />
          <StatCard icon={<BadgeIcon />} iconBg="#dbeafe" iconColor="#2563eb" label="QA 8.0 Ready" value={totals.qa8} subtitle="Guide issued + demo logged" />
          <StatCard icon={<AlertIcon />} iconBg="#fee2e2" iconColor="#dc2626" label="Open Evidence Gaps" value={totals.gaps} subtitle={totals.gaps > 0 ? 'Across all schemes' : 'All clear'} />
        </div>

        {/* Schemes Card */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold" style={{ color: tokens.dark }}>All Schemes</h2>
              <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">{developments.length} scheme{developments.length !== 1 ? 's' : ''}</span>
            </div>
            <p className="text-xs text-gray-400">Tap a scheme for its full evidence breakdown</p>
          </div>

          {developments.length === 0 ? (
            <div className="px-6 py-16 text-center"><p className="text-sm text-gray-500">No developments found.</p></div>
          ) : (
            <div>
              {developments.map((d) => {
                const isOpen = expanded === d.id;
                const pct = d.hpi?.readinessPct ?? 0;
                const tierLabel = d.hpi?.projectedTier ?? '—';
                const barColor = pct >= 88 ? tokens.success : pct >= 60 ? tokens.gold : tokens.amber;
                const detail = details[d.id];
                return (
                  <div key={d.id} className="border-b border-gray-50 last:border-b-0">
                    {/* Scheme row */}
                    <div
                      onClick={() => toggle(d.id)}
                      className="px-6 py-4 cursor-pointer transition-colors hover:bg-gray-50/50 grid items-center gap-4"
                      style={{ gridTemplateColumns: 'minmax(200px, 1.3fr) 1.7fr 150px 96px 150px 24px' }}
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#fef3c7', color: tokens.gold }}><BadgeIcon /></div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: tokens.dark }}>{d.name}</p>
                          <p className="text-xs text-gray-500">{d.total_units} home{d.total_units !== 1 ? 's' : ''}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                        </div>
                        <span className="text-sm font-bold w-12 text-right" style={{ color: tokens.dark }}>{pct}%</span>
                      </div>

                      <div className="flex justify-center">{d.hpi ? <TierChip label={tierLabel} /> : <span className="text-xs text-gray-400">—</span>}</div>

                      <div className="flex justify-center">
                        {d.hpi && d.hpi.gapCount > 0 ? (
                          <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-full text-xs font-bold text-white" style={{ backgroundColor: tokens.danger }}>{d.hpi.gapCount}</span>
                        ) : (
                          <span className="text-xs font-semibold" style={{ color: tokens.success }}>Clear</span>
                        )}
                      </div>

                      <div className="flex justify-end">
                        <a
                          href={`/api/dev-app/developments/${d.id}/evidence-pack`}
                          download
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border transition-all hover:shadow-md"
                          style={{ borderColor: '#e5e7eb', color: tokens.dark, backgroundColor: 'white' }}
                          title="Download the HPI evidence pack (PDFs + manifest) for this scheme"
                        >
                          <span style={{ color: tokens.gold }}><DownloadIcon /></span>
                          Evidence pack
                        </a>
                      </div>

                      <div className="flex justify-end text-gray-400"><ChevronDownIcon open={isOpen} /></div>
                    </div>

                    {/* Deep panel */}
                    {isOpen && (
                      <div className="px-6 pb-6">
                        {detail === 'loading' || detail === undefined ? (
                          <div className="py-10 text-center text-sm text-gray-400">Loading evidence…</div>
                        ) : detail === 'error' ? (
                          <div className="py-10 text-center text-sm text-red-500">Could not load this scheme's evidence.</div>
                        ) : (
                          <SchemePanel detail={detail} devId={d.id} onDraft={(party) => draftRequest(d.id, party)} />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 mt-4">
          HPI readiness reflects the evidence OpenHouse holds for each home (certificates, commissioning, handover and aftercare).
          The projected level is an indicative evidence-readiness signal — the official certification outcome is determined by an HPI assessor.
        </p>
      </div>

      {/* Draft-request modal */}
      {draftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setDraftModal(null)}>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold" style={{ color: tokens.dark }}>Request evidence — {draftModal.party}</h3>
            <p className="text-xs text-gray-500 mt-1">{draftModal.subject}</p>
            <textarea
              readOnly
              value={draftModal.body}
              className="w-full mt-4 h-56 text-sm text-gray-700 rounded-xl border border-gray-200 p-3 resize-none focus:outline-none"
              style={{ backgroundColor: tokens.warmGray }}
            />
            <div className="flex items-center justify-end gap-3 mt-4">
              <button
                onClick={() => { navigator.clipboard?.writeText(draftModal.body); setCopied(true); }}
                className="px-4 py-2 text-sm font-semibold rounded-xl border"
                style={{ borderColor: '#e5e7eb', color: tokens.dark }}
              >
                {copied ? 'Copied' : 'Copy text'}
              </button>
              <a
                href={draftModal.mailto}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl"
                style={{ backgroundColor: tokens.gold, color: tokens.dark }}
              >
                <MailIcon /> Open email
              </a>
              <button onClick={() => setDraftModal(null)} className="px-4 py-2 text-sm font-medium text-gray-500">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Scheme deep panel
// =============================================================================

function SchemePanel({ detail, devId, onDraft }: { detail: SchemeDetail; devId: string; onDraft: (party: string) => void }) {
  const ev = detail.evaluation;
  const [openParties, setOpenParties] = useState<Set<string>>(new Set());

  // Group gaps by responsible party
  const byParty = useMemo(() => {
    const map: Record<string, GapItem[]> = {};
    for (const g of ev.gaps) (map[g.responsibleParty] ||= []).push(g);
    return Object.entries(map).sort((a, b) => b[1].length - a[1].length);
  }, [ev.gaps]);

  const toggleParty = (p: string) =>
    setOpenParties((prev) => {
      const next = new Set(prev);
      next.has(p) ? next.delete(p) : next.add(p);
      return next;
    });

  return (
    <div className="space-y-6 pt-1">
      {/* Tier + next-tier line */}
      <div className="flex flex-wrap items-center gap-3">
        <TierChip label={ev.projectedTierLabel} title={detail.disclaimer} />
        <span className="text-sm font-bold" style={{ color: tokens.dark }}>{ev.readinessPct}% evidence-ready</span>
        {ev.itemsToNextTier != null && ev.itemsToNextTier > 0 && (
          <span className="text-xs text-gray-500">· {ev.itemsToNextTier} item{ev.itemsToNextTier !== 1 ? 's' : ''} to the next level</span>
        )}
        {!ev.mandatoryMet && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: '#fef3c7', color: tokens.amber }}>
            Mandatory minimums not yet met on every home
          </span>
        )}
      </div>

      {/* Category breakdown */}
      <div className="grid grid-cols-5 gap-5">
        {CATEGORY_ORDER.map((cat) => {
          const cb = ev.categoryBreakdown[cat];
          if (!cb) return null;
          return <CategoryBar key={cat} cat={cat} pct={cb.pct} ready={cb.ready} total={cb.total} />;
        })}
      </div>

      {/* Indicator grid */}
      <div className="rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-2.5 border-b border-gray-100" style={{ backgroundColor: `${tokens.warmGray}80` }}>
          <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Evidence indicators</span>
        </div>
        <table className="w-full">
          <tbody>
            {ev.indicatorMatrix.map((m) => (
              <tr key={m.indicatorId} className="border-t border-gray-50 first:border-t-0">
                <td className="px-5 py-3">
                  <p className="text-sm font-medium" style={{ color: tokens.dark }}>{m.label}</p>
                  <p className="text-xs text-gray-400">{m.code} · {CATEGORY_LABELS[m.category] ?? m.category}</p>
                </td>
                <td className="px-5 py-3 text-sm text-gray-500">{m.responsibleParty}</td>
                <td className="px-5 py-3 w-44"><CoverageCell ready={m.ready} total={m.total} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Gap report by responsible party */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold" style={{ color: tokens.dark }}>
            What's outstanding {ev.gaps.length > 0 && <span className="text-gray-400 font-normal">· {ev.gaps.length} item{ev.gaps.length !== 1 ? 's' : ''}</span>}
          </h4>
          {ev.gaps.length > 0 && (
            <a
              href={`/api/developer/hpi/scheme/${devId}/chase-list`}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-xl border"
              style={{ borderColor: '#e5e7eb', color: tokens.dark }}
              title="Download the full chase-list as CSV"
            >
              <DownloadIcon /> Export chase-list
            </a>
          )}
        </div>

        {ev.gaps.length === 0 ? (
          <div className="rounded-xl border border-gray-100 px-5 py-6 text-center text-sm" style={{ color: tokens.success }}>
            All tracked evidence is in place for this scheme.
          </div>
        ) : (
          <div className="space-y-2">
            {byParty.map(([party, gaps]) => {
              const open = openParties.has(party);
              return (
                <div key={party} className="rounded-xl border border-gray-100 overflow-hidden">
                  <div className="px-5 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50/50" onClick={() => toggleParty(party)}>
                    <div className="flex items-center gap-3">
                      <ChevronDownIcon open={open} />
                      <span className="text-sm font-semibold" style={{ color: tokens.dark }}>{party}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{gaps.length}</span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDraft(party); }}
                      className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-xl"
                      style={{ backgroundColor: tokens.gold, color: tokens.dark }}
                    >
                      <MailIcon /> Draft request
                    </button>
                  </div>
                  {open && (
                    <div className="border-t border-gray-50">
                      {gaps.map((g, i) => (
                        <div key={`${g.indicatorId}-${g.unitId ?? 'scheme'}-${i}`} className="px-5 py-2.5 flex items-center justify-between border-t border-gray-50 first:border-t-0">
                          <div className="min-w-0">
                            <p className="text-sm" style={{ color: tokens.dark }}>
                              <span className="font-medium">{g.unitLabel ?? 'Scheme'}</span>
                              <span className="text-gray-400"> · {g.detail}</span>
                            </p>
                          </div>
                          <StatusPill status={g.status} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Per-home QA 8.0 evidence */}
      <div>
        <h4 className="text-sm font-semibold mb-3" style={{ color: tokens.dark }}>Per-home QA 8.0 evidence</h4>
        <div className="rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: `${tokens.warmGray}80` }}>
                <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Home</th>
                <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Purchaser</th>
                <th className="px-5 py-2.5 text-center text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Guide</th>
                <th className="px-5 py-2.5 text-center text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Demo</th>
                <th className="px-5 py-2.5 text-center text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Aftercare</th>
                <th className="px-5 py-2.5 text-center text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Systems</th>
              </tr>
            </thead>
            <tbody>
              {ev.perUnitQa8.map((u) => (
                <tr key={u.id} className="border-t border-gray-50">
                  <td className="px-5 py-3">
                    <p className="text-sm font-medium" style={{ color: tokens.dark }}>{u.unit_number ? `Unit ${u.unit_number}` : u.address_line_1 || 'Unit'}</p>
                  </td>
                  <td className="px-5 py-3"><span className="text-sm text-gray-600">{u.purchaser_name || '—'}</span></td>
                  <td className="px-5 py-3 text-center"><EvidenceTick on={u.guide_issued} /></td>
                  <td className="px-5 py-3 text-center"><EvidenceTick on={u.demo_completed} /></td>
                  <td className="px-5 py-3 text-center"><EvidenceTick on={u.aftercare_activated} /></td>
                  <td className="px-5 py-3 text-center"><span className="text-sm font-medium text-gray-600">{u.systems_documented}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
