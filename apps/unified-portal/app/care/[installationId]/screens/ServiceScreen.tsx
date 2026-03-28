'use client';

import { useEffect, useState } from 'react';
import { useCareApp } from '../care-app-provider';
import { ShieldCheck, Calendar, Check, Clock, Wrench, ChevronRight } from 'lucide-react';

/* ── Types ── */
interface ServiceRecord {
  id: string;
  service_date: string;
  service_type: string;
  engineer_name: string;
  outcome: string;
  warranty_validated: boolean;
  notes?: string;
}

/* ── Helpers ── */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function weeksUntil(iso: string): number {
  const diff = new Date(iso).getTime() - Date.now();
  return diff / (1000 * 60 * 60 * 24 * 7);
}

type ServiceStatus = 'overdue' | 'due-soon' | 'upcoming';

function getServiceStatus(nextServiceDue: string): ServiceStatus {
  const weeks = weeksUntil(nextServiceDue);
  if (weeks < 0) return 'overdue';
  if (weeks <= 8) return 'due-soon';
  return 'upcoming';
}

function getStatusConfig(status: ServiceStatus) {
  switch (status) {
    case 'overdue':
      return {
        label: 'OVERDUE',
        pillBg: 'bg-red-100',
        pillText: 'text-red-700',
        border: 'border-red-400',
        ctaLabel: 'Book urgently',
        ctaBg: 'bg-red-600 hover:bg-red-700',
      };
    case 'due-soon':
      return {
        label: 'Due Soon',
        pillBg: 'bg-[#D4AF37]/15',
        pillText: 'text-[#D4AF37]',
        border: 'border-[#D4AF37]',
        ctaLabel: 'Book now',
        ctaBg: 'bg-[#D4AF37] hover:bg-[#C5A030]',
      };
    case 'upcoming':
      return {
        label: 'Upcoming',
        pillBg: 'bg-emerald-100',
        pillText: 'text-emerald-700',
        border: 'border-gray-200',
        ctaLabel: 'Book now',
        ctaBg: 'bg-slate-800 hover:bg-slate-900',
      };
  }
}

/* ── Main Component ── */
export default function ServiceScreen() {
  const { installation, installationId } = useCareApp();
  const [records, setRecords] = useState<ServiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);

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

  // Next service due: 1 year after the most recent service, or 1 year after install if no services
  const lastServiceDate =
    records.length > 0 ? records[0].service_date : installation.install_date;
  const nextServiceDue = new Date(lastServiceDate);
  nextServiceDue.setFullYear(nextServiceDue.getFullYear() + 1);
  const nextServiceDueStr = nextServiceDue.toISOString().split('T')[0];

  const status = getServiceStatus(nextServiceDueStr);
  const statusConfig = getStatusConfig(status);

  async function handleBookService() {
    setBookingSubmitting(true);
    try {
      const res = await fetch('/api/care/service-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          installationId,
          requestedSlot: nextServiceDueStr,
          notes: 'Requested via Care portal',
        }),
      });
      if (res.ok) {
        setBookingSuccess(true);
      }
    } catch {
      // silent fail for demo
    } finally {
      setBookingSubmitting(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-[#FAFAFA]">
      <div className="max-w-lg mx-auto px-4 pt-5 pb-8 space-y-5 sm:max-w-2xl">

        {/* ── Page Title ── */}
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Service & Warranty
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Keep your system covered and performing
          </p>
        </div>

        {/* ── Warranty Health Card ── */}
        <div className="bg-white rounded-xl border-2 border-[#D4AF37] shadow-sm p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/10 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-slate-900">
                {warrantyYears}-year warranty active until{' '}
                {formatDate(warrantyExpiry)}
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                Annual service required to stay covered
              </p>
            </div>
          </div>
        </div>

        {/* ── Next Service Card ── */}
        <div
          className={`bg-white rounded-xl border-2 ${statusConfig.border} shadow-sm p-5`}
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
              <Calendar className="w-5 h-5 text-slate-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-semibold text-slate-900">
                  Next Service Due
                </h3>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${statusConfig.pillBg} ${statusConfig.pillText}`}
                >
                  {statusConfig.label}
                </span>
              </div>
              <p className="text-sm text-slate-600 mt-1 font-medium">
                {formatDate(nextServiceDueStr)}
              </p>

              {bookingSuccess ? (
                <div className="mt-3 flex items-center gap-2 text-sm text-emerald-600 font-medium">
                  <Check className="w-4 h-4" />
                  Booking request submitted
                </div>
              ) : (
                <button
                  onClick={handleBookService}
                  disabled={bookingSubmitting}
                  className={`mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white ${statusConfig.ctaBg} transition-colors duration-200 disabled:opacity-50`}
                >
                  {bookingSubmitting ? (
                    <>
                      <Clock className="w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      {statusConfig.ctaLabel}
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Service History ── */}
        <div>
          <h3 className="text-sm sm:text-base font-semibold text-slate-900 mb-3">
            Service History
          </h3>

          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm p-4"
                >
                  <div className="h-4 bg-slate-100 rounded animate-pulse w-2/3 mb-2" />
                  <div className="h-3 bg-slate-100 rounded animate-pulse w-1/2" />
                </div>
              ))}
            </div>
          ) : records.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-center">
              <Wrench className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No service records yet</p>
              <p className="text-xs text-slate-400 mt-1">
                Records will appear here after your first annual service
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {records.map((record) => (
                <div
                  key={record.id}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Wrench className="w-4 h-4 text-slate-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">
                          {record.service_type}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {formatDate(record.service_date)} &middot;{' '}
                          {record.engineer_name}
                        </p>
                        <p className="text-xs text-slate-600 mt-1">
                          {record.outcome}
                        </p>
                      </div>
                    </div>
                    {record.warranty_validated && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 flex-shrink-0">
                        <Check className="w-3 h-3" />
                        Warranty
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="text-center pt-2 pb-1">
          <p className="text-[10px] text-slate-300">Powered by OpenHouse AI</p>
        </div>
      </div>
    </div>
  );
}
