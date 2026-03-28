'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Thermometer, Zap, Leaf, AlertTriangle, Calendar, Check,
  Circle, X, ArrowRight, MessageCircle, Upload, Banknote,
} from 'lucide-react';

/* ── Animated counter ── */
function AnimatedNumber({ value, suffix = '', prefix = '', decimals = 0, duration = 600 }: {
  value: number; suffix?: string; prefix?: string; decimals?: number; duration?: number;
}) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) { setDisplay(value); return; }
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true;
        const t0 = performance.now();
        const tick = (now: number) => {
          const p = Math.min((now - t0) / duration, 1);
          setDisplay(value * (1 - Math.pow(1 - p, 3)));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [value, duration]);

  return <span ref={ref}>{prefix}{display.toFixed(decimals)}{suffix}</span>;
}

/* ── Animated progress bar ── */
function AnimatedBar({ percent }: { percent: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        requestAnimationFrame(() => setWidth(Math.min(percent, 100)));
        obs.unobserve(el);
      }
    }, { threshold: 0.2 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [percent]);

  return (
    <div ref={ref} className="w-full h-2.5 bg-white/50 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full hover:shadow-[0_0_8px_rgba(16,185,129,0.3)]"
        style={{
          width: `${width}%`,
          background: 'linear-gradient(90deg, #10b981, #059669)',
          transition: 'width 800ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      />
    </div>
  );
}

const SEAI_STEPS = [
  { key: 'application_submitted', label: 'Application submitted' },
  { key: 'ber_complete', label: 'BER assessment complete' },
  { key: 'installation_signed_off', label: 'Installation signed off' },
  { key: 'seai_in_review', label: 'SEAI reviewing' },
  { key: 'approved', label: 'Approved' },
  { key: 'paid', label: 'Grant payment' },
];

const ROTATING_QUESTIONS = [
  '"Why is zone 3 warmer than the rest?"',
  '"What temperature should my hot water be?"',
  '"When is my next service due?"',
];

interface HeatPumpHomeContentProps {
  installation: Record<string, unknown>;
  onNavigateToProfile?: () => void;
  onNavigateToAssistant?: () => void;
}

export default function HeatPumpHomeContent({ installation, onNavigateToProfile, onNavigateToAssistant }: HeatPumpHomeContentProps) {
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [questionVisible, setQuestionVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setQuestionVisible(false);
      setTimeout(() => {
        setQuestionIndex(i => (i + 1) % ROTATING_QUESTIONS.length);
        setQuestionVisible(true);
      }, 300);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const alerts = (installation.active_safety_alerts as Array<{ id: string; title: string; body: string; severity: string; action_label?: string }>) || [];
  const visibleAlerts = alerts.filter(a => !dismissedAlerts.has(a.id));

  const dismissAlert = useCallback((alertId: string) => {
    setDismissingId(alertId);
    setTimeout(() => {
      setDismissedAlerts(prev => new Set(prev).add(alertId));
      setDismissingId(null);
      fetch('/api/care/dismiss-alert', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId, installationId: installation.id }),
      }).catch(() => {});
    }, 300);
  }, [installation.id]);

  const indoorTemp = Number(installation.indoor_temp_current) || 0;
  const indoorTarget = Number(installation.indoor_temp_target) || 21;
  const dailyCost = (Number(installation.daily_running_cost_cents) || 0) / 100;
  const cop = Number(installation.heat_pump_cop) || 0;
  const co2Today = (Number(installation.co2_saved_today_grams) || 0) / 1000;
  const co2Percent = Math.min((co2Today / 3) * 100, 100);

  const nextServiceStr = installation.next_service_due as string | null;
  const nextServiceDate = nextServiceStr ? new Date(nextServiceStr) : null;
  const weeksUntilService = nextServiceDate ? Math.round((nextServiceDate.getTime() - Date.now()) / (7 * 86400000)) : null;
  const isOverdue = weeksUntilService !== null && weeksUntilService < 0;
  const showServiceReminder = nextServiceDate && weeksUntilService !== null && weeksUntilService <= 13;

  const grantStatus = installation.seai_grant_status as string | null;
  const grantAmount = Number(installation.seai_grant_amount) || 0;
  const grantFormatted = (grantAmount / 100).toLocaleString('en-IE', { minimumFractionDigits: 0 });

  const copStatus = cop >= 3.0 ? { label: 'Excellent', color: 'text-emerald-600' } : cop >= 2.5 ? { label: 'Good', color: 'text-blue-600' } : { label: 'Below target', color: 'text-amber-600' };
  const tempDiff = Math.abs(indoorTemp - indoorTarget);
  const tempStatus = tempDiff <= 0.5 ? { label: 'At target', color: 'text-gray-400' } : indoorTemp > indoorTarget ? { label: 'Above target', color: 'text-amber-500' } : { label: 'Below target', color: 'text-blue-500' };

  return (
    <>
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          @keyframes pulse-ring { 0% { opacity: 1; transform: scale(0.8); } 100% { opacity: 0; transform: scale(1.8); } }
          @keyframes alert-dismiss { to { opacity: 0; transform: translateY(-8px); max-height: 0; margin: 0; padding: 0; overflow: hidden; } }
          .pulse-dot { position: relative; }
          .pulse-dot::after { content: ''; position: absolute; inset: -4px; border-radius: 50%; border: 2px solid #ef4444; animation: pulse-ring 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
          .seai-pulse { position: relative; }
          .seai-pulse::after { content: ''; position: absolute; inset: -3px; border-radius: 50%; border: 2px solid #D4AF37; animation: pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
          .alert-dismissing { animation: alert-dismiss 300ms cubic-bezier(0.4, 0, 1, 1) forwards; }
        }
      `}</style>

      {/* ── Hero Metric Card ── */}
      <div className="card-item rounded-2xl border border-gray-200 overflow-hidden" style={{ borderLeft: '4px solid #D4AF37', background: 'linear-gradient(135deg, #ffffff 60%, #D4AF3708 100%)', boxShadow: '0 2px 16px rgba(212,175,55,0.06)' }}>
        <div className="p-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400 mb-4">Your system at a glance</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center hover:scale-[1.03] hover:shadow-md transition-all duration-200">
              <Thermometer className="w-5 h-5 text-rose-400 mx-auto mb-2" />
              <p className="text-3xl font-bold tracking-tight text-gray-900"><AnimatedNumber value={indoorTemp} decimals={1} suffix="°" /></p>
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400 mt-1">Indoors</p>
              <p className={`text-[11px] font-medium mt-0.5 ${tempStatus.color}`}>{tempStatus.label}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center hover:scale-[1.03] hover:shadow-md transition-all duration-200">
              <Banknote className="w-5 h-5 text-emerald-500 mx-auto mb-2" />
              <p className="text-3xl font-bold tracking-tight text-gray-900"><AnimatedNumber value={dailyCost} prefix="€" decimals={2} /></p>
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400 mt-1">Today</p>
              <p className="text-[11px] font-medium mt-0.5 text-gray-400">so far</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center hover:scale-[1.03] hover:shadow-md transition-all duration-200">
              <Zap className="w-5 h-5 text-blue-500 mx-auto mb-2" />
              <p className="text-3xl font-bold tracking-tight text-gray-900"><AnimatedNumber value={cop} decimals={1} /></p>
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400 mt-1">COP</p>
              <p className={`text-[11px] font-medium mt-0.5 ${copStatus.color}`}>{copStatus.label}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── CO₂ Savings ── */}
      <div className="card-item rounded-2xl overflow-hidden hover:scale-[1.01] transition-all duration-200" style={{ background: '#ecfdf5', borderLeft: '4px solid #10b981' }}>
        <div className="p-5">
          <div className="flex items-center gap-2 mb-1">
            <Leaf className="w-5 h-5 text-emerald-600" />
            <span className="text-base font-semibold text-emerald-800"><AnimatedNumber value={co2Today} decimals={1} /> kg CO₂ saved today</span>
          </div>
          <p className="text-xs text-emerald-600 mb-3">vs oil heating baseline</p>
          <AnimatedBar percent={co2Percent} />
          <p className="text-xs text-emerald-500 mt-2">{Math.round(co2Today * 30)} kg this month · {Math.round(co2Today * 365)} kg since install</p>
        </div>
      </div>

      {/* ── Safety Alert ── */}
      {visibleAlerts.map((alert) => (
        <div key={alert.id} className={`card-item rounded-2xl bg-white border border-gray-200 overflow-hidden ${dismissingId === alert.id ? 'alert-dismissing' : ''}`} style={{ borderLeft: '4px solid #ef4444', background: 'linear-gradient(90deg, #fef2f211 0%, transparent 30%)' }}>
          <div className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 bg-red-500 rounded-full pulse-dot" />
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span className="text-xs font-medium text-red-500 uppercase tracking-wide">Safety notice</span>
              </div>
              <button onClick={() => dismissAlert(alert.id)} className="p-1 rounded-lg hover:bg-gray-100 transition-colors"><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <h4 className="text-sm font-semibold text-red-700 mb-1">{alert.title}</h4>
            <p className="text-sm text-red-600 mb-4 leading-relaxed">{alert.body}</p>
            <button onClick={onNavigateToProfile} className="px-4 py-2 rounded-xl text-sm font-medium border border-red-300 text-red-600 hover:bg-red-500 hover:text-white transition-all duration-150 active:scale-[0.97]">
              {alert.action_label || 'Check my system'}
            </button>
          </div>
        </div>
      ))}

      {/* ── SEAI Grant Tracker ── */}
      {grantStatus && (
        <div className="card-item rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">SEAI Grant — €{grantFormatted}</h3>
              <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: '#D4AF3720', color: '#96791A' }}>
                {grantStatus === 'seai_in_review' ? 'In review' : grantStatus.replace(/_/g, ' ')}
              </span>
            </div>
            <div className="relative pl-6">
              <div className="absolute left-[7px] top-2 bottom-2 w-px border-l border-dashed border-gray-300" />
              {SEAI_STEPS.map((step, i) => {
                const stepIndex = SEAI_STEPS.findIndex(s => s.key === grantStatus);
                const isDone = i < stepIndex;
                const isActive = i === stepIndex;
                const isLast = i === SEAI_STEPS.length - 1;
                const label = isLast ? `${step.label} (€${grantFormatted})` : step.label;
                return (
                  <div key={step.key} className="relative flex items-start gap-3 mb-4 last:mb-0">
                    <div className="absolute -left-6 top-0.5">
                      {isDone ? (
                        <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center"><Check className="w-2.5 h-2.5 text-white" /></div>
                      ) : isActive ? (
                        <div className="w-4 h-4 rounded-full bg-[#D4AF37] flex items-center justify-center seai-pulse"><div className="w-2 h-2 rounded-full bg-white" /></div>
                      ) : (
                        <Circle className="w-4 h-4 text-gray-300" />
                      )}
                    </div>
                    <div>
                      <p className={`text-sm ${isActive ? 'font-semibold text-gray-900' : isDone ? 'text-gray-500' : 'text-gray-400'}`}>{label}</p>
                      {isActive && <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: '#D4AF3720', color: '#96791A' }}>Current step</span>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400">Expected: 2–4 weeks</p>
              <button className="flex items-center gap-1 text-xs font-medium text-[#D4AF37] hover:text-[#C8A951] transition-colors"><Upload className="w-3 h-3" /> Upload docs</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Service Reminder ── */}
      {showServiceReminder && (
        <div className="card-item rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden" style={{ borderLeft: isOverdue ? '4px solid #ef4444' : '4px solid #D4AF37', background: isOverdue ? 'linear-gradient(135deg, #fff 80%, #fef2f208)' : 'linear-gradient(135deg, #fff 80%, #D4AF3706)' }}>
          <div className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isOverdue ? 'bg-red-100' : 'bg-[#D4AF37]/10'}`}>
                <Calendar className={`w-4 h-4 ${isOverdue ? 'text-red-500' : 'text-[#D4AF37]'}`} />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-900">Annual service due</h4>
                <p className="text-xs text-gray-500">{isOverdue ? <span className="text-red-500 font-medium">Overdue</span> : `${Math.abs(weeksUntilService!)} weeks away · ${nextServiceDate!.toLocaleDateString('en-IE', { month: 'long', year: 'numeric' })}`}</p>
              </div>
              {isOverdue && <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-600">OVERDUE</span>}
            </div>
            <p className="text-sm text-gray-500 mb-4">Your {installation.warranty_years as number}-year warranty requires an annual service to stay valid.</p>
            <button className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 active:scale-[0.97]" style={{ background: isOverdue ? '#ef4444' : '#D4AF37', color: isOverdue ? '#fff' : '#1a1200' }}>
              Book your service →
            </button>
          </div>
        </div>
      )}

      {/* ── Quick Ask AI ── */}
      <button onClick={onNavigateToAssistant} className="card-item w-full rounded-2xl bg-white border border-gray-200 shadow-sm p-5 text-left hover:border-[#D4AF37]/40 hover:shadow-[0_0_16px_rgba(212,175,55,0.1)] transition-all duration-200 active:scale-[0.98] group">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-full bg-[#D4AF37]/10 flex items-center justify-center"><MessageCircle className="w-4 h-4 text-[#D4AF37]" /></div>
          <h4 className="text-sm font-semibold text-gray-900">Ask anything about your system</h4>
          <ArrowRight className="w-4 h-4 text-gray-300 ml-auto group-hover:text-[#D4AF37] transition-colors" />
        </div>
        <p className="text-sm italic text-gray-400 ml-11 transition-opacity duration-300" style={{ opacity: questionVisible ? 1 : 0 }}>
          {ROTATING_QUESTIONS[questionIndex]}
        </p>
      </button>
    </>
  );
}
