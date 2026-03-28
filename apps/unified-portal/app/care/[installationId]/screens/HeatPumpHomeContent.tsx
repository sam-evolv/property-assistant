'use client';

import { useState, useMemo } from 'react';
import {
  Thermometer,
  Zap,
  Banknote,
  AlertTriangle,
  Calendar,
  Check,
  Circle,
  ShieldCheck,
  X,
  Leaf,
} from 'lucide-react';

/* ── Types ── */

interface SeaiGrantStatus {
  current_step:
    | 'application_submitted'
    | 'ber_complete'
    | 'installation_signed_off'
    | 'seai_in_review'
    | 'paid';
  grant_amount_eur: number;
}

interface SafetyAlert {
  id: string;
  title: string;
  body: string;
}

interface HeatPumpHomeContentProps {
  installation: any; // The full installation object from CareAppProvider
  onNavigateToProfile?: () => void;
}

/* ── SEAI Grant Steps ── */

const GRANT_STEPS = [
  { key: 'application_submitted', label: 'Application Submitted' },
  { key: 'ber_complete', label: 'BER Assessment Complete' },
  { key: 'installation_signed_off', label: 'Installation Signed Off' },
  { key: 'seai_in_review', label: 'SEAI Review' },
  { key: 'paid', label: 'Grant Payment' },
] as const;

/* ── Helpers ── */

function weeksUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.round(diff / (7 * 24 * 60 * 60 * 1000));
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/* ── Component ── */

export default function HeatPumpHomeContent({
  installation,
  onNavigateToProfile,
}: HeatPumpHomeContentProps) {
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(
    new Set()
  );

  /* Safety alerts */
  const activeAlerts: SafetyAlert[] = useMemo(() => {
    const raw: SafetyAlert[] = installation.active_safety_alerts ?? [];
    return raw.filter((a) => !dismissedAlerts.has(a.id));
  }, [installation.active_safety_alerts, dismissedAlerts]);

  /* Stats */
  const indoorTemp: number | null = installation.indoor_temp_current ?? null;
  const dailyCostCents: number | null =
    installation.daily_running_cost_cents ?? null;
  const cop: number | null = installation.heat_pump_cop ?? null;

  /* CO2 */
  const co2Grams: number = installation.co2_saved_today_grams ?? 0;
  const co2Kg = (co2Grams / 1000).toFixed(1);
  const co2Baseline = 3000; // grams — average oil heating comparison
  const co2Pct = Math.min((co2Grams / co2Baseline) * 100, 100);

  /* SEAI Grant */
  const grant: SeaiGrantStatus | null = installation.seai_grant ?? null;
  const grantStepIndex = grant
    ? GRANT_STEPS.findIndex((s) => s.key === grant.current_step)
    : -1;

  /* Service reminder */
  const nextServiceDue: string | null = installation.next_service_due ?? null;
  const warrantyYears: number =
    installation.warranty_years ??
    installation.system_specs?.workmanship_warranty_years ??
    0;
  const serviceWeeksAway = nextServiceDue ? weeksUntil(nextServiceDue) : null;
  const showServiceReminder =
    nextServiceDue !== null &&
    serviceWeeksAway !== null &&
    serviceWeeksAway <= 13; // 90 days ~ 13 weeks (includes overdue: negative values)

  return (
    <div className="space-y-4">
      {/* ─── 1. Safety Alert Banner ─── */}
      {activeAlerts.map((alert) => (
        <div
          key={alert.id}
          className="relative rounded-xl border border-amber-300 bg-amber-50 px-4 py-3.5 shadow-sm transition-all duration-150"
        >
          <button
            onClick={() =>
              setDismissedAlerts((prev) => new Set(prev).add(alert.id))
            }
            className="absolute right-3 top-3 rounded-lg p-1 text-amber-400 hover:bg-amber-100 hover:text-amber-600 transition-all duration-150 active:scale-[0.98]"
            aria-label="Dismiss alert"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-start gap-3 pr-6">
            <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-800">
                {alert.title}
              </p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-amber-700">
                {alert.body}
              </p>
              <button
                onClick={onNavigateToProfile}
                className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-all duration-150 hover:bg-amber-700 active:scale-[0.98]"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Check my system
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* ─── 2. Stats Row (3-col) ─── */}
      <div className="grid grid-cols-3 gap-2.5">
        {/* Indoor Temp */}
        <div className="rounded-xl border border-gray-200 bg-white p-3.5 text-center shadow-sm transition-all duration-150 hover:shadow-md hover:-translate-y-0.5">
          <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50">
            <Thermometer className="h-4 w-4 text-rose-500" />
          </div>
          <p className="text-lg font-bold tabular-nums leading-none text-slate-900">
            {indoorTemp !== null ? (
              <>
                {indoorTemp}
                <span className="ml-0.5 text-xs font-medium text-slate-400">
                  °C
                </span>
              </>
            ) : (
              <span className="text-slate-300">--</span>
            )}
          </p>
          <p className="mt-1.5 text-[10px] font-medium text-slate-400">
            Indoor Temp
          </p>
        </div>

        {/* Daily Cost */}
        <div className="rounded-xl border border-gray-200 bg-white p-3.5 text-center shadow-sm transition-all duration-150 hover:shadow-md hover:-translate-y-0.5">
          <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50">
            <Banknote className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-lg font-bold tabular-nums leading-none text-slate-900">
            {dailyCostCents !== null ? (
              <>
                <span className="text-xs font-medium text-slate-400">
                  &euro;
                </span>
                {(dailyCostCents / 100).toFixed(2)}
              </>
            ) : (
              <span className="text-slate-300">--</span>
            )}
          </p>
          <p className="mt-1.5 text-[10px] font-medium text-slate-400">
            Today&apos;s Cost
          </p>
        </div>

        {/* COP */}
        <div className="rounded-xl border border-gray-200 bg-white p-3.5 text-center shadow-sm transition-all duration-150 hover:shadow-md hover:-translate-y-0.5">
          <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50">
            <Zap className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-lg font-bold tabular-nums leading-none text-slate-900">
            {cop !== null ? (
              cop.toFixed(1)
            ) : (
              <span className="text-slate-300">--</span>
            )}
          </p>
          <p className="mt-1.5 text-[10px] font-medium text-slate-400">
            System COP
          </p>
        </div>
      </div>

      {/* ─── 3. CO2 Saved Bar ─── */}
      <div className="rounded-xl border border-gray-200 bg-white px-4 py-3.5 shadow-sm transition-all duration-150">
        <div className="mb-2 flex items-center gap-2">
          <Leaf className="h-4 w-4 text-emerald-500" />
          <span className="text-sm font-semibold text-slate-900">
            CO&#x2082; Savings
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-700 ease-out"
            style={{ width: `${co2Pct}%` }}
          />
        </div>
        <p className="mt-2 text-[12px] leading-snug text-slate-500">
          <strong className="text-slate-700">{co2Kg} kg</strong> CO&#x2082;
          saved today vs oil heating
        </p>
      </div>

      {/* ─── 4. SEAI Grant Tracker ─── */}
      {grant && (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-4 shadow-sm transition-all duration-150">
          <div className="mb-4 flex items-center gap-2">
            <div
              className="h-1 w-5 rounded-full"
              style={{ backgroundColor: '#D4AF37' }}
            />
            <h4 className="text-sm font-semibold text-slate-900">
              SEAI Grant Progress
            </h4>
          </div>

          <div className="relative ml-3">
            {/* Vertical line */}
            <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-slate-100" />

            <div className="space-y-4">
              {GRANT_STEPS.map((step, idx) => {
                const isComplete = idx < grantStepIndex;
                const isCurrent = idx === grantStepIndex;
                const isFuture = idx > grantStepIndex;

                const isLastStep = idx === GRANT_STEPS.length - 1;
                const label = isLastStep
                  ? `Grant Payment (\u20AC${grant.grant_amount_eur.toLocaleString('en-IE')})`
                  : step.label;

                return (
                  <div key={step.key} className="relative flex items-start gap-3">
                    {/* Step indicator */}
                    <div className="relative z-10 flex-shrink-0">
                      {isComplete ? (
                        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500">
                          <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                        </div>
                      ) : isCurrent ? (
                        <div className="relative flex h-4 w-4 items-center justify-center">
                          <div
                            className="absolute inset-0 animate-ping rounded-full opacity-30"
                            style={{ backgroundColor: '#D4AF37' }}
                          />
                          <div
                            className="h-4 w-4 rounded-full"
                            style={{ backgroundColor: '#D4AF37' }}
                          />
                        </div>
                      ) : (
                        <Circle className="h-4 w-4 text-slate-200" strokeWidth={2} />
                      )}
                    </div>

                    {/* Label */}
                    <div className="min-w-0 -mt-0.5">
                      <p
                        className={`text-[13px] font-medium leading-snug ${
                          isComplete
                            ? 'text-slate-500'
                            : isCurrent
                              ? 'text-slate-900'
                              : 'text-slate-300'
                        }`}
                      >
                        {label}
                      </p>
                      {isCurrent && (
                        <span
                          className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                          style={{ backgroundColor: '#D4AF37' }}
                        >
                          {step.label}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── 5. Service Reminder ─── */}
      {showServiceReminder && nextServiceDue && serviceWeeksAway !== null && (
        <div
          className="rounded-xl border bg-white px-4 py-3.5 shadow-sm transition-all duration-150"
          style={{ borderColor: '#D4AF37' }}
        >
          <div className="flex items-start gap-3">
            <div
              className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: 'rgba(212, 175, 55, 0.1)' }}
            >
              <Calendar className="h-4 w-4" style={{ color: '#D4AF37' }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">
                {serviceWeeksAway < 0
                  ? `Annual service overdue since ${formatDate(nextServiceDue)}`
                  : serviceWeeksAway === 0
                    ? `Annual service due this week`
                    : `Annual service due ${formatDate(nextServiceDue)} \u2014 ${serviceWeeksAway} week${serviceWeeksAway !== 1 ? 's' : ''} away`}
              </p>
              {warrantyYears > 0 && (
                <p className="mt-0.5 text-[12px] text-slate-500">
                  Keeps your {warrantyYears}-year warranty valid
                </p>
              )}
              <button
                onClick={() => {
                  window.open(
                    `mailto:support@openhouse.ai?subject=${encodeURIComponent(
                      'Service Booking - ' +
                        (installation.job_reference ?? installation.id)
                    )}`,
                    '_blank'
                  );
                }}
                className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-all duration-150 hover:brightness-110 active:scale-[0.98]"
                style={{ backgroundColor: '#D4AF37' }}
              >
                Book now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
