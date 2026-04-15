'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useCareApp } from '../care-app-provider';
import {
  Sun, Zap, TrendingUp, Shield, Wrench, Phone,
  Leaf, Battery, AlertTriangle, Calendar, CheckCircle2,
  ArrowUpRight, ThermometerSun,
} from 'lucide-react';

/* ── Animation Styles ── */
const ANIMATION_STYLES = `
  @keyframes fade-in-up {
    0% { opacity: 0; transform: translateY(16px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  @keyframes fade-in-scale {
    0% { opacity: 0; transform: scale(0.95); }
    100% { opacity: 1; transform: scale(1); }
  }
  .card-item { animation: fade-in-up 0.5s ease-out backwards; }
  .card-item:nth-child(1) { animation-delay: 0.1s; }
  .card-item:nth-child(2) { animation-delay: 0.15s; }
  .card-item:nth-child(3) { animation-delay: 0.2s; }
  .card-item:nth-child(4) { animation-delay: 0.25s; }
  .card-item:nth-child(5) { animation-delay: 0.3s; }
  .card-item:nth-child(6) { animation-delay: 0.35s; }
  .card-item:nth-child(7) { animation-delay: 0.4s; }
`;

/* ── Helpers ── */
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
function getFirstName(name: string) { return name.split(' ')[0]; }

/* ── Animated number ── */
function Counter({ target, prefix = '', decimals = 0 }: { target: number; prefix?: string; decimals?: number }) {
  const [val, setVal] = useState(0);
  const started = useRef(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true;
        const t0 = performance.now();
        const tick = (now: number) => {
          const p = Math.min((now - t0) / 1200, 1);
          setVal(target * (1 - Math.pow(1 - p, 4)));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [target]);
  return <span ref={ref}>{prefix}{val.toFixed(decimals)}</span>;
}

/* ── Mock hourly solar profile (used when API data is unavailable) ── */
function generateMockHourlyProfile() {
  const now = new Date().getHours();
  return Array.from({ length: 24 }, (_, hour) => {
    let generation = 0;
    if (hour >= 6 && hour <= 20) {
      const peakHour = 13;
      const sigma = 3.5;
      const maxGeneration = 1.1;
      generation = maxGeneration * Math.exp(-Math.pow(hour - peakHour, 2) / (2 * sigma * sigma));
      if (hour > now) generation = 0;
    }
    return { hour, generation: Math.round(generation * 100) / 100 };
  });
}

/* ── Generation Chart ── */
function GenerationChart({ hourlyProfile, loading }: { hourlyProfile: Array<{ hour: number; generation: number }>, loading: boolean }) {
  if (loading) {
    return (
      <div className="card-item rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4">
        <div className="h-28 bg-slate-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  const maxVal = Math.max(...hourlyProfile.map(h => h.generation), 0.1);
  const now = new Date().getHours();
  const chartHours = hourlyProfile.filter(h => h.hour >= 6 && h.hour <= 21); // daylight hours only
  const barWidth = 100 / chartHours.length;

  return (
    <div className="card-item rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4 sm:p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">Generation Today</h4>
          <p className="text-[11px] text-slate-400 mt-0.5">Hourly output (kWh)</p>
        </div>
        <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Live</span>
      </div>
      <svg viewBox={`0 0 100 40`} className="w-full h-28" preserveAspectRatio="none">
        {chartHours.map((h, i) => {
          const barH = (h.generation / maxVal) * 36;
          const isPast = h.hour <= now;
          const isCurrent = h.hour === now;
          return (
            <rect
              key={h.hour}
              x={i * barWidth + barWidth * 0.1}
              y={40 - barH}
              width={barWidth * 0.8}
              height={Math.max(barH, 0.5)}
              rx="1"
              fill={isCurrent ? '#D4AF37' : isPast ? '#10b981' : '#e2e8f0'}
              opacity={isCurrent ? 1 : isPast ? 0.7 : 0.4}
            />
          );
        })}
      </svg>
      <div className="flex justify-between text-[9px] text-slate-300 mt-1 px-0.5">
        <span>6am</span>
        <span>12pm</span>
        <span>6pm</span>
        <span>9pm</span>
      </div>
    </div>
  );
}

/* ── Main ── */
export default function HomeScreen() {
  const { installation, installationId, setActiveTab } = useCareApp();
  const [telemetry, setTelemetry] = useState<any>(null);
  const [telemetryLoading, setTelemetryLoading] = useState(true);

  const isHeatPump = installation.system_category === 'heat_pump' ||
    installation.system_type === 'heat_pump';

  useEffect(() => {
    fetch(`/api/care/telemetry/${installationId}`)
      .then(r => r.json())
      .then(data => { setTelemetry(data); setTelemetryLoading(false); })
      .catch(() => setTelemetryLoading(false));
  }, [installationId]);

  const daysSince = Math.floor((Date.now() - new Date(installation.install_date).getTime()) / 86400000);
  const savings = daysSince * 5.8;

  // For heat pump portals, render a different home screen
  if (isHeatPump) {
    const HeatPumpHomeContent = require('./HeatPumpHomeContent').default;
    return (
      <div className="h-full overflow-y-auto bg-[#FAFAFA]">
        <style>{ANIMATION_STYLES}</style>
        <div className="max-w-lg mx-auto px-4 pt-5 pb-8 space-y-5 sm:max-w-2xl">
          <div className="card-item">
            <p className="text-sm text-slate-500">
              {getGreeting()}, <span className="font-semibold text-slate-900">{getFirstName(installation.customer_name)}</span>
            </p>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-0.5">Your Heating System</h1>
          </div>
          <HeatPumpHomeContent installation={installation} onNavigateToProfile={() => setActiveTab('profile')} onNavigateToAssistant={() => setActiveTab('assistant')} />
          <div className="text-center pt-2 pb-1">
            <p className="text-[10px] text-slate-300">Powered by OpenHouse AI</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[#FAFAFA]">
      <style>{ANIMATION_STYLES}</style>
      <div className="max-w-lg mx-auto px-4 pt-5 pb-8 space-y-5 sm:max-w-2xl">

        {/* ── Greeting ── */}
        <div className="card-item">
          <p className="text-sm text-slate-500">
            {getGreeting()}, <span className="font-semibold text-slate-900">{getFirstName(installation.customer_name)}</span>
          </p>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-0.5">Your Solar System</h1>
        </div>

        {/* ── Alerts Banner ── */}
        {telemetry?.alerts?.length > 0 && (
          <div className="card-item rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">{telemetry.alerts[0].message}</p>
              {telemetry.alerts.length > 1 && <p className="text-xs text-amber-600 mt-0.5">+{telemetry.alerts.length - 1} more alert{telemetry.alerts.length > 2 ? 's' : ''}</p>}
            </div>
          </div>
        )}

        {/* ── System Status Card — premium with gold accent ── */}
        <div className="card-item relative overflow-hidden rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
          {(() => {
            const healthConfig = {
              healthy: { dot: 'bg-emerald-500', text: 'text-emerald-600', label: 'System Healthy', gradient: 'from-emerald-400 via-emerald-500 to-teal-500' },
              degraded: { dot: 'bg-amber-500', text: 'text-amber-600', label: 'Performance Degraded', gradient: 'from-amber-400 via-amber-500 to-orange-400' },
              fault: { dot: 'bg-red-500', text: 'text-red-600', label: 'System Fault', gradient: 'from-red-400 via-red-500 to-rose-500' },
            };
            const hc = healthConfig[installation.health_status as keyof typeof healthConfig] || healthConfig.healthy;
            return <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${hc.gradient}`} />;
          })()}
          <div className="p-5">
            {(() => {
              const healthConfig = {
                healthy: { dot: 'bg-emerald-500', text: 'text-emerald-600', label: 'System Healthy' },
                degraded: { dot: 'bg-amber-500', text: 'text-amber-600', label: 'Performance Degraded' },
                fault: { dot: 'bg-red-500', text: 'text-red-600', label: 'System Fault' },
              };
              const hc = healthConfig[installation.health_status as keyof typeof healthConfig] || healthConfig.healthy;
              return (
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-2 h-2 rounded-full ${hc.dot}`} />
                  <span className={`text-sm font-semibold ${hc.text}`}>{hc.label}</span>
                  <span className="ml-auto text-xs text-slate-400">Installed by <strong className="text-slate-600">{installation.installer_name}</strong></span>
                </div>
              );
            })()}
            <p className="text-lg font-bold text-slate-900">{installation.system_size_kwp} kWp Solar PV System</p>
            <p className="text-sm text-slate-500 mt-0.5">
              {installation.panel_count}x {installation.panel_model} · {installation.inverter_model}
            </p>
            {installation.system_specs.battery && (
              <div className="flex items-center gap-2 mt-3 bg-blue-50 rounded-xl px-3 py-2">
                <Battery className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-medium text-blue-700">{installation.system_specs.battery}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Performance Cards — 3-col grid ── */}
        <div className="card-item grid grid-cols-3 gap-2.5 sm:gap-3">
          {[
            { label: 'Generated\nToday', value: telemetryLoading ? '...' : (telemetry?.generation?.today?.toFixed(1) ?? ((installation.system_size_kwp * 850) / 365).toFixed(1)), unit: 'kWh', icon: Sun, iconColor: 'text-amber-500', bg: 'bg-amber-50' },
            { label: 'Saved\nToday', value: telemetryLoading ? '...' : '€' + ((telemetry?.generation?.today || 0) * 0.35).toFixed(2), icon: TrendingUp, iconColor: 'text-emerald-500', bg: 'bg-emerald-50' },
            { label: 'Self-\nUse', value: telemetryLoading ? '...' : Math.round(telemetry?.selfConsumption || 68) + '%', icon: Leaf, iconColor: 'text-emerald-500', bg: 'bg-emerald-50' },
          ].map((m) => (
            <div key={m.label} className="rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-3.5 sm:p-4 text-center hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group">
              <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl ${m.bg} flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform duration-200`}>
                <m.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${m.iconColor} group-hover:scale-110 transition-transform duration-200`} />
              </div>
              <p className="text-lg sm:text-xl font-bold text-slate-900 tabular-nums leading-none">
                {m.value}
                {m.unit && <span className="text-xs font-medium text-slate-400 ml-0.5">{m.unit}</span>}
              </p>
              <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium mt-1.5 whitespace-pre-line leading-tight">{m.label}</p>
            </div>
          ))}
        </div>

        {/* ── Generation Chart ── */}
        <GenerationChart
          hourlyProfile={telemetry?.hourlyProfile?.length > 0 ? telemetry.hourlyProfile : generateMockHourlyProfile()}
          loading={telemetryLoading}
        />

        {/* ── Savings Card — green gradient ── */}
        <div className="card-item relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 p-5 sm:p-6 text-white shadow-lg shadow-emerald-500/15 hover:shadow-xl hover:shadow-emerald-500/25 hover:-translate-y-1 transition-all duration-300 cursor-pointer">
          <div className="absolute top-0 right-0 w-28 h-28 bg-white/5 rounded-bl-full" />
          <div className="flex items-center gap-2 mb-1">
            <ArrowUpRight className="w-4 h-4 text-white/60" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/60">Total Savings</p>
          </div>
          <p className="text-3xl font-extrabold tabular-nums">
            <Counter target={savings} prefix="€" decimals={2} />
          </p>
          <p className="text-sm text-white/50 mt-1">Since {installation.install_date}</p>
        </div>

        {/* ── Energy Tip ── */}
        <div className="card-item rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4 sm:p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
              <ThermometerSun className="w-4.5 h-4.5 text-amber-500" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Energy Tip</h4>
              <p className="text-[13px] text-slate-500 mt-0.5 leading-relaxed">
                Run heavy appliances between <strong className="text-slate-700">11am–3pm</strong> to maximise your solar generation and save more.
              </p>
            </div>
          </div>
        </div>

        {/* ── Warranty Overview ── */}
        <div className="card-item">
          <h3 className="text-sm sm:text-base font-semibold text-slate-900 mb-2.5 sm:mb-3">Warranty Coverage</h3>
          <div className="space-y-2 sm:space-y-2.5">
            {[
              { label: 'Solar Panels', years: installation.system_specs.panel_warranty_years, icon: Sun, color: 'text-amber-500' },
              { label: 'Inverter', years: installation.system_specs.inverter_warranty_years, icon: Zap, color: 'text-blue-500' },
              { label: 'Workmanship', years: installation.system_specs.workmanship_warranty_years, icon: Shield, color: 'text-[#D4AF37]' },
            ].map((w) => {
              const used = daysSince / 365;
              const pct = Math.min((used / w.years) * 100, 100);
              const remaining = Math.round(w.years - used);
              return (
                <div key={w.label} className="rounded-xl bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.06)] px-4 py-3 sm:px-5 sm:py-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <w.icon className={`w-4 h-4 ${w.color}`} />
                      <span className="text-sm font-medium text-slate-900">{w.label}</span>
                    </div>
                    <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      {remaining}y remaining
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#D4AF37] to-[#F5D874]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Quick Actions ── */}
        <div className="card-item">
          <h3 className="text-sm sm:text-base font-semibold text-slate-900 mb-2.5 sm:mb-3">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            {[
              { label: 'Contact Installer', icon: Phone, desc: installation.installer_name, iconColor: 'text-[#D4AF37]', bg: 'bg-[#D4AF37]/8', onClick: () => { if (installation.installer_contact?.phone) { window.open(`tel:${installation.installer_contact.phone}`); } else { window.open('mailto:support@openhouse.ai'); } } },
              { label: 'Report Issue', icon: AlertTriangle, desc: 'Get support', iconColor: 'text-red-500', bg: 'bg-red-50', onClick: () => setActiveTab('assistant') },
              { label: 'Schedule Service', icon: Calendar, desc: 'Book maintenance', iconColor: 'text-blue-500', bg: 'bg-blue-50', onClick: () => { window.open(`mailto:support@openhouse.ai?subject=${encodeURIComponent('Service Request - ' + installation.job_reference)}`); } },
              { label: 'SEAI Grant Info', icon: Leaf, desc: 'Check eligibility', iconColor: 'text-emerald-500', bg: 'bg-emerald-50', onClick: () => { window.open('https://www.seai.ie/grants/', '_blank'); } },
            ].map((a) => (
              <button key={a.label} onClick={a.onClick} className="rounded-xl bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-3.5 sm:p-4 text-left hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-gold-500/30 group" aria-label={`${a.label}: ${a.desc}`}>
                <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${a.bg} flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform duration-200`}>
                  <a.icon className={`w-4.5 h-4.5 sm:w-5 sm:h-5 ${a.iconColor} group-hover:scale-110 transition-transform duration-200`} />
                </div>
                <p className="text-[13px] sm:text-sm font-semibold text-slate-900 group-hover:text-[#D4AF37] transition-colors duration-200">{a.label}</p>
                <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">{a.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="text-center pt-2 pb-1">
          <p className="text-[10px] text-slate-300">Powered by OpenHouse AI</p>
        </div>
      </div>
    </div>
  );
}
