'use client';

import { useState, useCallback, useEffect } from 'react';
import { BottomSheet } from './BottomSheet';
import { TimelineSheet } from './sheets/TimelineSheet';
import { DocsSheet } from './sheets/DocsSheet';
import { FAQSheet } from './sheets/FAQSheet';
import { ContactSheet } from './sheets/ContactSheet';
import { CalendarSheet } from './sheets/CalendarSheet';
import { SettingsSheet } from './sheets/SettingsSheet';
import { MILESTONE_ORDER, MILESTONE_LABELS, type UnitPreHandoverData, type SheetType, type Document, type ContactInfo, type FAQ, type MilestoneDates } from './types';

// =============================================================================
// Icons
// =============================================================================

const HouseIcon = () => (
  <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 3L4 9v12h5v-7h6v7h5V9l-8-6z" />
  </svg>
);

const SettingsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const ClockIcon = () => (
  <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const DocsIcon = () => (
  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const FAQIcon = () => (
  <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ContactIcon = () => (
  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
  </svg>
);

const HomeNavIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const ClipboardIcon = () => (
  <svg className="w-5 h-5 text-brand-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
);

const HandoverHomeIcon = () => (
  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

// =============================================================================
// Helper Functions
// =============================================================================

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatMonth(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

// =============================================================================
// Main Component
// =============================================================================

interface PreHandoverPortalProps {
  // Can pass a full unit object OR individual props
  unit?: UnitPreHandoverData;
  // Individual props (used when unit is not provided)
  unitId?: string;
  propertyName?: string;
  propertyType?: string;
  houseType?: string;
  purchaserName?: string;
  developmentName?: string;
  developmentLogoUrl?: string | null;
  handoverComplete?: boolean;
  currentMilestone?: string;
  milestoneDates?: MilestoneDates;
  estSnaggingDate?: string | null;
  estHandoverDate?: string | null;
  documents?: Document[];
  contacts?: ContactInfo;
  faqs?: FAQ[];
}

export function PreHandoverPortal(props: PreHandoverPortalProps) {
  const [activeSheet, setActiveSheet] = useState<SheetType>(null);
  const [loadedDocuments, setLoadedDocuments] = useState<Document[]>([]);

  // Build unit data from either full unit object or individual props
  const unit: UnitPreHandoverData = props.unit || {
    unitId: props.unitId || '',
    propertyName: props.propertyName || '',
    propertyType: props.propertyType || '',
    houseType: props.houseType || 'House',
    handoverComplete: props.handoverComplete || false,
    currentMilestone: props.currentMilestone || 'sale_agreed',
    milestoneDates: props.milestoneDates || {},
    estSnaggingDate: props.estSnaggingDate || null,
    estHandoverDate: props.estHandoverDate || null,
    documents: props.documents || loadedDocuments,
    contacts: props.contacts || {},
    faqs: props.faqs || [],
  };

  // Fetch documents if not provided
  useEffect(() => {
    if (!props.unit && (!props.documents || props.documents.length === 0) && props.unitId) {
      fetch(`/api/units/${props.unitId}/prehandover`)
        .then(res => res.json())
        .then(data => {
          if (data.documents) {
            setLoadedDocuments(data.documents);
          }
        })
        .catch(err => console.error('Failed to load documents:', err));
    }
  }, [props.unitId, props.unit, props.documents]);

  // Update documents in unit if loaded
  const effectiveDocuments = props.documents && props.documents.length > 0
    ? props.documents
    : loadedDocuments;

  const openSheet = useCallback((sheet: SheetType) => setActiveSheet(sheet), []);
  const closeSheet = useCallback(() => setActiveSheet(null), []);

  // Calculate progress
  const milestoneIndex = MILESTONE_ORDER.indexOf(unit.currentMilestone as typeof MILESTONE_ORDER[number]);
  const completedCount = milestoneIndex >= 0 ? milestoneIndex + 1 : 0;
  const progressPercent = Math.round((completedCount / MILESTONE_ORDER.length) * 100);
  const currentMilestoneLabel = MILESTONE_LABELS[unit.currentMilestone] || 'Unknown';

  // Estimated date for current milestone
  const estDate = unit.currentMilestone === 'snagging'
    ? unit.estSnaggingDate
    : unit.currentMilestone === 'handover'
    ? unit.estHandoverDate
    : null;

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&display=swap');

        :root {
          --brand-gold: #C9A227;
          --brand-gold-light: #E8D48A;
          --brand-cream: #FAF8F3;
          --brand-warm: #F5F1EA;
          --brand-dark: #1C1917;
          --brand-muted: #78716C;
        }

        .font-serif { font-family: 'Instrument Serif', Georgia, serif; }

        @keyframes fade-up {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes pulse-gold {
          0%, 100% { box-shadow: 0 0 0 0 rgba(201, 162, 39, 0.4); }
          50% { box-shadow: 0 0 0 8px rgba(201, 162, 39, 0); }
        }

        .fade-up { animation: fade-up 0.6s ease-out forwards; }
        .delay-1 { animation-delay: 0.1s; opacity: 0; }
        .delay-2 { animation-delay: 0.2s; opacity: 0; }
        .animate-pulse-gold { animation: pulse-gold 2.5s ease-in-out infinite; }

        .card {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.8);
          box-shadow: 0 1px 2px rgba(0,0,0,0.02), 0 4px 16px rgba(0,0,0,0.04);
        }

        .card-hover { transition: all 0.3s ease; }
        .card-hover:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.06); }

        .progress-track { background: linear-gradient(90deg, #E8E4DC 0%, #DDD8CE 100%); }
        .progress-fill { background: linear-gradient(90deg, var(--brand-gold) 0%, var(--brand-gold-light) 100%); box-shadow: 0 2px 8px rgba(201,162,39,0.3); }

        .status-badge {
          background: linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(16,185,129,0.05) 100%);
          border: 1px solid rgba(16,185,129,0.2);
        }

        .icon-ring {
          background: linear-gradient(135deg, rgba(201,162,39,0.15) 0%, rgba(201,162,39,0.05) 100%);
          border: 1px solid rgba(201,162,39,0.2);
        }

        .pattern-bg {
          background-image: radial-gradient(circle at 1px 1px, rgba(201,162,39,0.08) 1px, transparent 0);
          background-size: 24px 24px;
        }

        .nav-item { transition: all 0.2s ease; }
        .nav-item.active { color: var(--brand-gold); }

        .text-brand-gold { color: var(--brand-gold); }
        .text-brand-dark { color: var(--brand-dark); }
        .text-brand-muted { color: var(--brand-muted); }
        .bg-brand-gold { background-color: var(--brand-gold); }
      `}</style>

      <div
        className="min-h-screen flex flex-col"
        style={{
          background: 'linear-gradient(180deg, #FAF8F3 0%, #F5F1EA 100%)',
          fontFamily: "'DM Sans', -apple-system, sans-serif",
        }}
      >
        {/* Pattern Background */}
        <div className="pattern-bg fixed inset-0 pointer-events-none" />

        {/* Header */}
        <header className="relative z-10 flex items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs text-brand-muted">{getGreeting()}</p>
            <h1 className="text-lg font-semibold text-brand-dark">My Home</h1>
          </div>
          <button
            onClick={() => openSheet('settings')}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/60 border border-white/80 text-brand-muted hover:bg-white transition-colors"
          >
            <SettingsIcon />
          </button>
        </header>

        {/* Main Content */}
        <main className="relative z-10 flex-1 flex flex-col items-center px-6 pt-4 pb-8">
          {/* Property Card */}
          <div className="w-full max-w-sm fade-up">
            <div className="card rounded-3xl p-6 text-center">
              {/* House Icon */}
              <div className="w-20 h-20 mx-auto mb-5 rounded-full icon-ring flex items-center justify-center">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand-gold to-amber-600 flex items-center justify-center shadow-lg shadow-amber-900/20">
                  <HouseIcon />
                </div>
              </div>

              {/* Property Info */}
              <h1 className="font-serif text-2xl text-brand-dark">{unit.propertyName}</h1>
              <p className="text-brand-muted text-sm mt-1.5">
                {unit.propertyType} · {unit.houseType}
              </p>

              {/* Status Badge */}
              <div className="mt-5 inline-flex items-center gap-2.5 px-4 py-2.5 status-badge rounded-full">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <span className="text-sm font-medium text-emerald-700">
                  On Track · Est. {formatMonth(unit.estHandoverDate)}
                </span>
              </div>

              <div className="my-6 h-px bg-gradient-to-r from-transparent via-stone-200 to-transparent" />

              {/* Progress Section */}
              <div className="text-left">
                <div className="flex items-baseline justify-between mb-3">
                  <span className="text-xs font-medium text-brand-muted uppercase tracking-wider">
                    Your Progress
                  </span>
                  <span className="text-sm font-semibold text-brand-gold">{progressPercent}%</span>
                </div>
                <div className="h-2.5 rounded-full progress-track overflow-hidden">
                  <div
                    className="h-full rounded-full progress-fill transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="mt-4 flex items-center justify-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-brand-gold animate-pulse-gold" />
                  <span className="text-sm text-brand-dark">
                    <span className="font-semibold">{currentMilestoneLabel}</span>
                    {estDate && (
                      <span className="text-brand-muted"> · Est. {formatShortDate(estDate)}</span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Cards */}
          <div className="w-full max-w-sm mt-5 grid grid-cols-4 gap-2 fade-up delay-1">
            <button onClick={() => openSheet('timeline')} className="card card-hover rounded-2xl p-3 text-center">
              <div className="w-10 h-10 mx-auto rounded-xl bg-gradient-to-br from-violet-100 to-violet-50 flex items-center justify-center mb-2">
                <ClockIcon />
              </div>
              <span className="text-[11px] font-medium text-brand-dark">Timeline</span>
            </button>
            <button onClick={() => openSheet('docs')} className="card card-hover rounded-2xl p-3 text-center">
              <div className="w-10 h-10 mx-auto rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center mb-2">
                <DocsIcon />
              </div>
              <span className="text-[11px] font-medium text-brand-dark">Docs</span>
            </button>
            <button onClick={() => openSheet('faq')} className="card card-hover rounded-2xl p-3 text-center">
              <div className="w-10 h-10 mx-auto rounded-xl bg-gradient-to-br from-amber-100 to-amber-50 flex items-center justify-center mb-2">
                <FAQIcon />
              </div>
              <span className="text-[11px] font-medium text-brand-dark">FAQ</span>
            </button>
            <button onClick={() => openSheet('contact')} className="card card-hover rounded-2xl p-3 text-center">
              <div className="w-10 h-10 mx-auto rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-50 flex items-center justify-center mb-2">
                <ContactIcon />
              </div>
              <span className="text-[11px] font-medium text-brand-dark">Contact</span>
            </button>
          </div>

          {/* Key Dates Card */}
          <div className="w-full max-w-sm mt-5 fade-up delay-2">
            <div className="card rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-brand-muted uppercase tracking-wider">
                  Key Dates
                </span>
                <button
                  onClick={() => openSheet('calendar')}
                  className="text-xs font-medium text-brand-gold hover:underline"
                >
                  Add to Calendar
                </button>
              </div>
              <div className="space-y-3">
                {unit.estSnaggingDate && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-gold/10 flex items-center justify-center">
                      <ClipboardIcon />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-brand-dark">Snagging Inspection</p>
                      <p className="text-xs text-brand-muted">Est. {formatShortDate(unit.estSnaggingDate)}</p>
                    </div>
                  </div>
                )}
                {unit.estHandoverDate && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                      <HandoverHomeIcon />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-brand-dark">Handover</p>
                      <p className="text-xs text-brand-muted">Est. {formatMonth(unit.estHandoverDate)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>

        {/* Bottom Nav */}
        <nav className="relative z-10 bg-white/80 backdrop-blur-xl border-t border-stone-100 px-6 py-4">
          <div className="flex items-center justify-around max-w-sm mx-auto">
            <button className="nav-item active flex flex-col items-center gap-1.5">
              <HomeNavIcon />
              <span className="text-[10px] font-semibold uppercase tracking-wide">Home</span>
            </button>
            <button
              onClick={() => openSheet('docs')}
              className="nav-item text-brand-muted flex flex-col items-center gap-1.5"
            >
              <DocsIcon />
              <span className="text-[10px] font-medium uppercase tracking-wide">Docs</span>
            </button>
            <button
              onClick={() => openSheet('faq')}
              className="nav-item text-brand-muted flex flex-col items-center gap-1.5"
            >
              <FAQIcon />
              <span className="text-[10px] font-medium uppercase tracking-wide">FAQ</span>
            </button>
          </div>
        </nav>

        {/* Bottom Sheets */}
        <BottomSheet isOpen={activeSheet === 'timeline'} onClose={closeSheet}>
          <TimelineSheet unit={unit} />
        </BottomSheet>

        <BottomSheet isOpen={activeSheet === 'docs'} onClose={closeSheet}>
          <DocsSheet documents={effectiveDocuments} />
        </BottomSheet>

        <BottomSheet isOpen={activeSheet === 'faq'} onClose={closeSheet} maxHeight="80vh">
          <FAQSheet faqs={unit.faqs} />
        </BottomSheet>

        <BottomSheet isOpen={activeSheet === 'contact'} onClose={closeSheet}>
          <ContactSheet contacts={unit.contacts} />
        </BottomSheet>

        <BottomSheet isOpen={activeSheet === 'calendar'} onClose={closeSheet}>
          <CalendarSheet unit={unit} onClose={closeSheet} />
        </BottomSheet>

        <BottomSheet isOpen={activeSheet === 'settings'} onClose={closeSheet}>
          <SettingsSheet />
        </BottomSheet>
      </div>
    </>
  );
}
