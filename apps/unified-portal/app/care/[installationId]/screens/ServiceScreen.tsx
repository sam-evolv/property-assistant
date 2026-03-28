'use client';

import { useEffect, useState, useMemo } from 'react';
import { useCareApp } from '../care-app-provider';
import {
  Shield,
  Check,
  CheckCircle,
  Clock,
  ChevronRight,
  User,
  Building2,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
} from 'lucide-react';

/* ── Types ── */
interface ServiceRecord {
  id: string;
  service_date: string;
  service_type: string;
  engineer_name: string;
  engineer_company?: string;
  outcome: string;
  warranty_validated: boolean;
  notes?: string;
}

interface BookingSlot {
  id: string;
  date: string;
  time: string;
  label: string;
}

/* ── Helpers ── */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatMonthYear(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IE', {
    month: 'long',
    year: 'numeric',
  });
}

function weeksUntil(iso: string): number {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.round(diff / (1000 * 60 * 60 * 24 * 7));
}

function generateMockSlots(): BookingSlot[] {
  const slots: BookingSlot[] = [];
  const now = new Date();
  const offsets = [3, 5, 7, 9];
  const times = ['09:00', '11:30', '14:00', '10:00'];
  for (let i = 0; i < 4; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + offsets[i]);
    if (d.getDay() === 0) d.setDate(d.getDate() + 1);
    if (d.getDay() === 6) d.setDate(d.getDate() + 2);
    const dateStr = d.toISOString().split('T')[0];
    slots.push({
      id: `slot-${i}`,
      date: dateStr,
      time: times[i],
      label: d.toLocaleDateString('en-IE', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      }),
    });
  }
  return slots;
}

/* ── Main Component ── */
export default function ServiceScreen() {
  const { installation, installationId } = useCareApp();
  const [records, setRecords] = useState<ServiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingMode, setBookingMode] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);

  useEffect(() => {
    fetch(`/api/care/service-records?installation_id=${installationId}`)
      .then((r) => r.json())
      .then((data) => {
        setRecords(data.records || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [installationId]);

  /* Derived values */
  const warrantyYears = installation.system_specs.panel_warranty_years ?? 10;
  const warrantyExpiry = installation.warranty_expiry;

  const lastServiceDate =
    records.length > 0 ? records[0].service_date : installation.install_date;
  const nextServiceDue = new Date(lastServiceDate);
  nextServiceDue.setFullYear(nextServiceDue.getFullYear() + 1);
  const nextServiceDueStr = nextServiceDue.toISOString().split('T')[0];

  const weeksLeft = weeksUntil(nextServiceDueStr);

  const lastValidatedDate =
    records.find((r) => r.warranty_validated)?.service_date ?? null;

  const mockSlots = useMemo(() => generateMockSlots(), []);

  const confirmedSlot = mockSlots.find((s) => s.id === selectedSlot);

  async function handleConfirmBooking() {
    if (!selectedSlot || !confirmedSlot) return;
    setBookingSubmitting(true);
    try {
      const res = await fetch('/api/care/service-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          installationId,
          requestedSlot: `${confirmedSlot.date}T${confirmedSlot.time}`,
          notes: 'Requested via Care portal',
        }),
      });
      if (res.ok) {
        setBookingConfirmed(true);
      }
    } catch {
      // silent fail for demo
    } finally {
      setBookingSubmitting(false);
    }
  }

  /* ── Render ── */
  return (
    <div className="h-full overflow-y-auto bg-[#FAFAFA]">
      <div className="max-w-lg mx-auto px-4 pt-5 pb-8 space-y-6 sm:max-w-2xl">
        {/* ── Page Title ── */}
        <div className="da-anim-in da-s1">
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">
            Service &amp; Warranty
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Keep your system covered and performing
          </p>
        </div>

        {/* ====================================================
            Section 1 — Warranty Health Card
           ==================================================== */}
        <div
          className="da-anim-in da-s2 bg-white rounded-xl border border-gray-200 shadow-sm p-5"
          style={{ borderLeft: '4px solid #D4AF37' }}
        >
          <div className="flex items-start gap-3">
            {/* Gold circle with shield — 32px */}
            <div className="w-8 h-8 rounded-full bg-[#D4AF37]/15 flex items-center justify-center flex-shrink-0">
              <Shield className="w-4 h-4 text-[#D4AF37]" />
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              <p className="font-semibold text-gray-900">
                {warrantyYears}-year warranty active
              </p>
              <p className="text-sm text-gray-500">
                Expires {formatMonthYear(warrantyExpiry)}
              </p>
              {/* Amber warning line */}
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                <span className="text-sm text-amber-700 font-medium">
                  Annual service required to stay covered
                </span>
              </div>
              {/* Last validated / next due */}
              <p className="text-sm text-gray-500">
                {lastValidatedDate
                  ? `Last validated: ${formatMonthYear(lastValidatedDate)}`
                  : 'No service validated yet'}
                {' \u00B7 '}
                Next due: {formatMonthYear(nextServiceDueStr)}
                {weeksLeft > 0
                  ? ` (${weeksLeft} week${weeksLeft !== 1 ? 's' : ''})`
                  : weeksLeft === 0
                    ? ' (this week)'
                    : ' (overdue)'}
              </p>
            </div>
          </div>
        </div>

        {/* ====================================================
            Section 2 — Service Timeline
           ==================================================== */}
        <div className="da-anim-in da-s3">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            Service Timeline
          </h2>

          {loading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm p-4"
                >
                  <div className="h-4 bg-gray-100 rounded animate-pulse w-2/3 mb-2" />
                  <div className="h-3 bg-gray-100 rounded animate-pulse w-1/2" />
                </div>
              ))}
            </div>
          ) : (
            <div className="relative pl-[18px]">
              {/* Vertical connecting line — 2px wide, #e5e7eb */}
              <div
                className="absolute left-[5px] top-3 bottom-3 w-[2px] bg-[#e5e7eb]"
                aria-hidden="true"
              />

              <div className="space-y-6">
                {/* Future entry — next service due */}
                <TimelineEntry
                  index={0}
                  isFuture
                  datePill={formatDateShort(nextServiceDueStr)}
                  heading="Annual Service (due)"
                  subline="Not yet booked"
                  onBookNow={() => setBookingMode(true)}
                />

                {/* Past service records */}
                {records.map((record, idx) => (
                  <TimelineEntry
                    key={record.id}
                    index={idx + 1}
                    isFuture={false}
                    datePill={formatDateShort(record.service_date)}
                    heading={record.service_type}
                    engineerName={record.engineer_name}
                    engineerCompany={record.engineer_company}
                    outcome={record.outcome}
                    warrantyValidated={record.warranty_validated}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ====================================================
            Section 3 — Book Service
           ==================================================== */}
        {bookingMode && !bookingConfirmed && (
          <div className="da-anim-in space-y-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setBookingMode(false);
                  setSelectedSlot(null);
                }}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-all duration-150 active:scale-[0.97]"
              >
                <ArrowLeft className="w-4 h-4 text-gray-500" />
              </button>
              <h2 className="text-base font-semibold text-gray-900">
                Book a service
              </h2>
            </div>

            <p className="text-sm text-gray-500">
              Certified Pipelife engineer &middot; Cork area &middot; Includes
              warranty validation
            </p>

            {/* Slot cards — stacked */}
            <div className="space-y-3">
              {mockSlots.map((slot) => {
                const isSelected = selectedSlot === slot.id;
                return (
                  <button
                    key={slot.id}
                    onClick={() => setSelectedSlot(slot.id)}
                    className={`
                      w-full text-left bg-white rounded-xl border shadow-sm p-4
                      transition-all duration-150 active:scale-[0.97] relative
                      ${
                        isSelected
                          ? 'border-[#D4AF37] bg-[#D4AF37]/[0.08]'
                          : 'border-gray-200 hover:-translate-y-0.5 hover:shadow-md'
                      }
                    `}
                  >
                    {/* Checkmark top-right when selected */}
                    {isSelected && (
                      <div className="absolute top-3 right-3">
                        <div className="w-5 h-5 rounded-full bg-[#D4AF37] flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isSelected
                            ? 'bg-[#D4AF37]/15'
                            : 'bg-gray-50'
                        }`}
                      >
                        <CalendarDays
                          className={`w-4 h-4 ${
                            isSelected ? 'text-[#D4AF37]' : 'text-gray-400'
                          }`}
                        />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {slot.label}
                        </p>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {slot.time} &middot; Approx. 1 hour
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Confirm button — full width gold */}
            <button
              onClick={handleConfirmBooking}
              disabled={!selectedSlot || bookingSubmitting}
              className={`
                w-full py-3 rounded-xl text-sm font-semibold text-white
                bg-[#D4AF37] transition-all duration-150 active:scale-[0.97]
                ${!selectedSlot ? 'opacity-[0.4] cursor-not-allowed' : 'hover:bg-[#C5A030]'}
              `}
            >
              {bookingSubmitting ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Clock className="w-4 h-4 animate-spin" />
                  Confirming...
                </span>
              ) : (
                'Confirm booking'
              )}
            </button>
          </div>
        )}

        {/* ====================================================
            Confirmation Card
           ==================================================== */}
        {bookingConfirmed && confirmedSlot && (
          <div
            className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-center space-y-3"
            style={{
              animation:
                'da-scaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both',
            }}
          >
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              Service booked
            </h3>
            <p className="text-sm text-gray-700">
              {formatDate(confirmedSlot.date)} at {confirmedSlot.time}
            </p>
            <p className="text-sm text-gray-500">
              Certified Pipelife engineer
            </p>
            <p className="text-sm text-gray-500">
              You&apos;ll receive a confirmation by email. We&apos;ll remind you
              48 hours before.
            </p>
            <button
              onClick={() => {
                setBookingMode(false);
                setBookingConfirmed(false);
                setSelectedSlot(null);
              }}
              className="mt-2 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all duration-150 active:scale-[0.97]"
            >
              Back to home
            </button>
          </div>
        )}

        {/* ── Footer ── */}
        <div className="text-center pt-2 pb-1">
          <p className="text-[10px] text-gray-300">Powered by OpenHouse AI</p>
        </div>
      </div>
    </div>
  );
}

/* ====================================================
   Timeline Entry Sub-component
   ==================================================== */
function TimelineEntry({
  index,
  isFuture,
  datePill,
  heading,
  engineerName,
  engineerCompany,
  subline,
  outcome,
  warrantyValidated,
  onBookNow,
}: {
  index: number;
  isFuture: boolean;
  datePill: string;
  heading: string;
  engineerName?: string;
  engineerCompany?: string;
  subline?: React.ReactNode;
  outcome?: string;
  warrantyValidated?: boolean;
  onBookNow?: () => void;
}) {
  const delay = `${index * 100}ms`;

  return (
    <div
      className="relative flex items-start gap-4 opacity-0"
      style={{
        animation: `da-fadeInUp 0.55s cubic-bezier(0.16, 1, 0.3, 1) ${delay} both`,
      }}
    >
      {/* Circle on the timeline line */}
      <div className="absolute -left-[18px] top-3 z-10 flex items-center justify-center">
        {isFuture ? (
          <div className="w-3 h-3 rounded-full border-2 border-dashed border-gray-300 bg-white" />
        ) : (
          <div className="w-3 h-3 rounded-full bg-[#D4AF37] ring-[3px] ring-[#D4AF37]/10" />
        )}
      </div>

      {/* Card area */}
      <div className="flex-1 min-w-0">
        {/* Date pill */}
        <span
          className={`
            inline-block text-xs font-medium px-2.5 py-0.5 rounded-full mb-2
            ${isFuture ? 'bg-gray-100 text-gray-500' : 'bg-[#D4AF37]/10 text-[#D4AF37]'}
          `}
        >
          {datePill}
        </span>

        {/* Content card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-2.5">
          <p className="font-semibold text-gray-900 text-sm">{heading}</p>

          {/* Engineer info for past entries */}
          {engineerName && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
              <span className="inline-flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-gray-400" />
                {engineerName}
              </span>
              {engineerCompany && (
                <span className="inline-flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-gray-400" />
                  {engineerCompany}
                </span>
              )}
            </div>
          )}

          {/* Subline for future entries */}
          {subline && !engineerName && (
            <p className="text-sm text-gray-500">{subline}</p>
          )}

          {/* Outcome with check icon if warranty validated */}
          {outcome && (
            <div className="flex items-start gap-1.5 text-sm text-gray-700">
              {warrantyValidated && (
                <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
              )}
              <span>
                {outcome}
                {warrantyValidated && (
                  <span className="text-emerald-600 font-medium">
                    {' '}&middot; Warranty validated
                  </span>
                )}
              </span>
            </div>
          )}

          {/* View report link for past entries */}
          {!isFuture && (
            <button className="inline-flex items-center gap-0.5 text-sm font-medium text-[#D4AF37] hover:text-[#C5A030] transition-all duration-150 active:scale-[0.97]">
              View report
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Book now link for future entries */}
          {isFuture && onBookNow && (
            <button
              onClick={onBookNow}
              className="inline-flex items-center gap-0.5 text-sm font-medium text-[#D4AF37] hover:text-[#C5A030] transition-all duration-150 active:scale-[0.97]"
            >
              Book now
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
