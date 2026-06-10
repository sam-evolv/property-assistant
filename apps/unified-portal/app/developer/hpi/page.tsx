'use client';

import { useState, useEffect, useMemo } from 'react';

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

// =============================================================================
// Types (shape of /api/developer/hpi/summary)
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

interface HpiDevelopment {
  id: string;
  name: string;
  total_units: number;
  qa8_ready: number;
  guide_issued: number;
  demo_completed: number;
  aftercare_activated: number;
  units: HpiUnit[];
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

const BookIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

const PresentationIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const HeartIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
  </svg>
);

const DownloadIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const ChevronDownIcon = ({ open }: { open: boolean }) => (
  <svg
    className="w-4 h-4 transition-transform duration-200"
    style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
  </svg>
);

// =============================================================================
// Small components
// =============================================================================

function StatCard({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  subtitle,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  value: number | string;
  subtitle?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 transition-all duration-200 hover:shadow-lg hover:border-gray-200">
      <div className="mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: iconBg, color: iconColor }}
        >
          {icon}
        </div>
      </div>
      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">{label}</p>
      <p className="text-3xl font-bold mt-1" style={{ color: tokens.dark }}>{value}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-3">{subtitle}</p>}
    </div>
  );
}

function EvidenceTick({ on }: { on: boolean }) {
  return on ? (
    <span
      className="inline-flex items-center justify-center w-6 h-6 rounded-full"
      style={{ backgroundColor: '#dcfce7', color: '#16a34a' }}
    >
      <CheckIcon />
    </span>
  ) : (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-300 text-xs font-bold">
      –
    </span>
  );
}

function ReadyBadge({ ready }: { ready: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={
        ready
          ? { backgroundColor: '#dcfce7', color: '#15803d' }
          : { backgroundColor: '#fef3c7', color: tokens.amber }
      }
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: ready ? '#16a34a' : tokens.amber }}
      />
      {ready ? 'Ready' : 'In progress'}
    </span>
  );
}

// =============================================================================
// Page
// =============================================================================

export default function DeveloperHpiPage() {
  const [developments, setDevelopments] = useState<HpiDevelopment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch('/api/developer/hpi/summary')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else {
          const list: HpiDevelopment[] = d.developments ?? [];
          // Schemes with evidence first, then by size, then name
          list.sort(
            (a, b) =>
              b.qa8_ready - a.qa8_ready ||
              b.guide_issued - a.guide_issued ||
              b.total_units - a.total_units ||
              a.name.localeCompare(b.name)
          );
          setDevelopments(list);
        }
      })
      .catch(() => setError('Failed to load HPI readiness'))
      .finally(() => setLoading(false));
  }, []);

  const totals = useMemo(
    () =>
      developments.reduce(
        (acc, d) => ({
          units: acc.units + d.total_units,
          ready: acc.ready + d.qa8_ready,
          guides: acc.guides + d.guide_issued,
          demos: acc.demos + d.demo_completed,
          aftercare: acc.aftercare + d.aftercare_activated,
        }),
        { units: 0, ready: 0, guides: 0, demos: 0, aftercare: 0 }
      ),
    [developments]
  );

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center" style={{ backgroundColor: tokens.cream }}>
        <div className="text-center">
          <div
            className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin mx-auto"
            style={{ borderColor: tokens.gold, borderTopColor: 'transparent' }}
          />
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
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-sm font-medium rounded-xl"
            style={{ backgroundColor: tokens.gold, color: tokens.dark }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const portfolioPct = totals.units > 0 ? Math.round((totals.ready / totals.units) * 100) : 0;

  return (
    <div className="min-h-full" style={{ backgroundColor: tokens.cream }}>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold" style={{ color: tokens.dark }}>HPI Readiness</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            QA 8.0 Consumer Information &amp; Aftercare — the evidence an HPI assessor reviews at as-built stage
          </p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-5 gap-5 mb-8">
          <StatCard
            icon={<HomeIcon />}
            iconBg="#fef3c7"
            iconColor={tokens.gold}
            label="Total Homes"
            value={totals.units}
          />
          <StatCard
            icon={<BadgeIcon />}
            iconBg="#dcfce7"
            iconColor="#16a34a"
            label="QA 8.0 Ready"
            value={totals.ready}
            subtitle={`${portfolioPct}% of portfolio`}
          />
          <StatCard
            icon={<BookIcon />}
            iconBg="#fef3c7"
            iconColor={tokens.amber}
            label="Guides Issued"
            value={totals.guides}
            subtitle="Home User Guides"
          />
          <StatCard
            icon={<PresentationIcon />}
            iconBg="#dbeafe"
            iconColor="#2563eb"
            label="Demos Logged"
            value={totals.demos}
            subtitle="Handover demonstrations"
          />
          <StatCard
            icon={<HeartIcon />}
            iconBg="#fce7f3"
            iconColor="#db2777"
            label="Aftercare Active"
            value={totals.aftercare}
          />
        </div>

        {/* Schemes Card */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold" style={{ color: tokens.dark }}>All Schemes</h2>
              <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
                {developments.length} scheme{developments.length !== 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Tap a scheme to see its per-home evidence
            </p>
          </div>

          {developments.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-sm text-gray-500">No developments found.</p>
            </div>
          ) : (
            <div>
              {developments.map((d) => {
                const pct = d.total_units > 0 ? Math.round((d.qa8_ready / d.total_units) * 100) : 0;
                const isOpen = expanded.has(d.id);
                const allReady = d.total_units > 0 && d.qa8_ready === d.total_units;
                return (
                  <div key={d.id} className="border-b border-gray-50 last:border-b-0">
                    {/* Scheme row */}
                    <div
                      onClick={() => toggle(d.id)}
                      className="px-6 py-4 cursor-pointer transition-colors hover:bg-gray-50/50 grid items-center gap-4"
                      style={{ gridTemplateColumns: 'minmax(220px, 1.4fr) 2fr repeat(3, 84px) 110px 170px 28px' }}
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                          style={{ backgroundColor: '#fef3c7', color: tokens.gold }}
                        >
                          <BadgeIcon />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: tokens.dark }}>{d.name}</p>
                          <p className="text-xs text-gray-500">{d.total_units} home{d.total_units !== 1 ? 's' : ''}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, backgroundColor: allReady ? tokens.success : tokens.gold }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-gray-500 w-20 text-right">
                          {d.qa8_ready}/{d.total_units} ready
                        </span>
                      </div>

                      <div className="text-center">
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Guides</p>
                        <p className="text-sm font-semibold mt-0.5" style={{ color: tokens.dark }}>{d.guide_issued}/{d.total_units}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Demos</p>
                        <p className="text-sm font-semibold mt-0.5" style={{ color: tokens.dark }}>{d.demo_completed}/{d.total_units}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Aftercare</p>
                        <p className="text-sm font-semibold mt-0.5" style={{ color: tokens.dark }}>{d.aftercare_activated}/{d.total_units}</p>
                      </div>

                      <div className="flex justify-center">
                        <ReadyBadge ready={allReady} />
                      </div>

                      <div className="flex justify-end">
                        <a
                          href={`/api/dev-app/developments/${d.id}/evidence-pack`}
                          download
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border transition-all hover:shadow-md"
                          style={{ borderColor: '#e5e7eb', color: tokens.dark, backgroundColor: 'white' }}
                          title="Download the QA 8.0 evidence pack (PDFs + manifest) for this scheme"
                        >
                          <span style={{ color: tokens.gold }}><DownloadIcon /></span>
                          Evidence pack
                        </a>
                      </div>

                      <div className="flex justify-end text-gray-400">
                        <ChevronDownIcon open={isOpen} />
                      </div>
                    </div>

                    {/* Unit detail */}
                    {isOpen && (
                      <div className="px-6 pb-5">
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
                                <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {d.units.map((u) => (
                                <tr key={u.id} className="border-t border-gray-50">
                                  <td className="px-5 py-3">
                                    <p className="text-sm font-medium" style={{ color: tokens.dark }}>
                                      {u.unit_number ? `Unit ${u.unit_number}` : u.address_line_1 || 'Unit'}
                                    </p>
                                    {u.address_line_1 && u.unit_number && (
                                      <p className="text-xs text-gray-400">{u.address_line_1}</p>
                                    )}
                                  </td>
                                  <td className="px-5 py-3">
                                    <span className="text-sm text-gray-600">{u.purchaser_name || '—'}</span>
                                  </td>
                                  <td className="px-5 py-3 text-center"><EvidenceTick on={u.guide_issued} /></td>
                                  <td className="px-5 py-3 text-center"><EvidenceTick on={u.demo_completed} /></td>
                                  <td className="px-5 py-3 text-center"><EvidenceTick on={u.aftercare_activated} /></td>
                                  <td className="px-5 py-3 text-center">
                                    <span className="text-sm font-medium text-gray-600">{u.systems_documented}</span>
                                  </td>
                                  <td className="px-5 py-3 text-right">
                                    <ReadyBadge ready={u.qa8_ready} />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footnote */}
        <p className="text-xs text-gray-400 mt-4">
          A home is QA 8.0 ready when its Home User Guide has been issued and the handover demonstration is logged.
          The evidence pack download includes the readiness index, a per-home evidence PDF and a manifest of stored certificates.
        </p>
      </div>
    </div>
  );
}
