'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Image from 'next/image';
import { useCareApp } from '../care-app-provider';
import {
  Sun, Zap, TrendingUp, Shield, Wrench, Phone,
  ChevronRight, Leaf, Battery, AlertTriangle,
} from 'lucide-react';

/* ── Helpers ── */
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
function getFirstName(name: string) { return name.split(' ')[0]; }

/* ── Animated Counter ── */
function AnimatedCounter({ target, prefix = '', suffix = '', decimals = 0, duration = 1200 }: {
  target: number; prefix?: string; suffix?: string; decimals?: number; duration?: number;
}) {
  const [value, setValue] = useState(0);
  const started = useRef(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true;
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - t, 4);
          setValue(target * eased);
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [target, duration]);

  return <span ref={ref}>{prefix}{value.toFixed(decimals)}{suffix}</span>;
}

/* ── Energy Chart ── */
const WEEK_DATA = [
  { day: 'Mon', kwh: 3.2 }, { day: 'Tue', kwh: 4.1 }, { day: 'Wed', kwh: 2.8 },
  { day: 'Thu', kwh: 5.0 }, { day: 'Fri', kwh: 4.2 }, { day: 'Sat', kwh: 3.6 },
  { day: 'Sun', kwh: 4.8 },
];

function EnergyChart() {
  const max = Math.max(...WEEK_DATA.map(d => d.kwh));
  const today = new Date().getDay(); // 0=Sun
  const dayIndex = today === 0 ? 6 : today - 1;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">This Week</h3>
        <span className="text-xs text-gray-400 font-medium">kWh generated</span>
      </div>
      <div className="flex items-end justify-between gap-2 h-28">
        {WEEK_DATA.map((d, i) => {
          const height = (d.kwh / max) * 100;
          const isToday = i === dayIndex;
          return (
            <div key={d.day} className="flex-1 flex flex-col items-center gap-1.5">
              <span className={`text-[11px] font-semibold tabular-nums ${isToday ? 'text-[#D4AF37]' : 'text-gray-400'}`}>
                {d.kwh}
              </span>
              <div className="w-full flex justify-center">
                <div
                  className={`w-8 rounded-full transition-all duration-700 ease-out ${
                    isToday
                      ? 'bg-gradient-to-t from-[#D4AF37] to-[#F5D874]'
                      : 'bg-gradient-to-t from-gray-200 to-gray-100'
                  }`}
                  style={{ height: `${height}%`, minHeight: 8 }}
                />
              </div>
              <span className={`text-[11px] font-medium ${isToday ? 'text-[#D4AF37]' : 'text-gray-400'}`}>
                {d.day}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Main Component ── */
export default function HomeScreen() {
  const { installation, setActiveTab } = useCareApp();
  const daysSinceInstall = Math.floor(
    (Date.now() - new Date(installation.install_date).getTime()) / 86400000
  );
  const estimatedSavings = daysSinceInstall * 5.8;

  return (
    <div className="h-full overflow-y-auto bg-gray-50/50">
      <div className="max-w-2xl mx-auto px-4 pt-5 pb-8 space-y-4">

        {/* Greeting */}
        <div className="space-y-0.5">
          <p className="text-sm text-gray-500">
            {getGreeting()}, <span className="font-semibold text-gray-900">{getFirstName(installation.customer_name)}</span>
          </p>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Your Solar System</h1>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex items-center gap-1.5 bg-gray-100 rounded-full px-3 py-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-medium text-gray-600">Installed by <strong>{installation.installer_name}</strong></span>
            </div>
          </div>
        </div>

        {/* System Health Card */}
        <div className="relative overflow-hidden bg-white rounded-2xl border border-gray-100 shadow-sm">
          {/* Decorative gradient */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-[#D4AF37]/8 to-transparent rounded-bl-full" />
          <div className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm font-semibold text-emerald-600">System Healthy</span>
            </div>
            <p className="text-lg font-bold text-gray-900">{installation.system_size_kwp} kWp Solar PV System</p>
            <p className="text-sm text-gray-500 mt-0.5">
              {installation.panel_count}x {installation.panel_model} &bull; {installation.inverter_model}
            </p>
            {installation.system_specs.battery && (
              <div className="flex items-center gap-2 mt-3 bg-blue-50 rounded-xl px-3 py-2">
                <Battery className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-medium text-blue-700">{installation.system_specs.battery}</span>
              </div>
            )}
          </div>
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Generated Today', value: '4.2', unit: 'kWh', icon: Sun, color: 'text-amber-500', bg: 'bg-amber-50' },
            { label: 'Saved Today', value: '€3.18', icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-50' },
            { label: 'Efficiency', value: '94%', icon: Zap, color: 'text-blue-500', bg: 'bg-blue-50' },
          ].map((m) => (
            <div key={m.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
              <div className={`w-8 h-8 rounded-xl ${m.bg} flex items-center justify-center mx-auto mb-2`}>
                <m.icon className={`w-4 h-4 ${m.color}`} />
              </div>
              <p className="text-lg font-bold text-gray-900 tabular-nums">{m.value}{m.unit ? <span className="text-sm font-medium text-gray-400 ml-0.5">{m.unit}</span> : null}</p>
              <p className="text-[11px] text-gray-400 font-medium mt-0.5">{m.label}</p>
            </div>
          ))}
        </div>

        {/* Total Savings Card */}
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 rounded-2xl p-5 text-white shadow-lg shadow-emerald-500/20">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-bl-full" />
          <p className="text-xs font-semibold uppercase tracking-wider text-white/70">Total Savings Since Install</p>
          <p className="text-3xl font-extrabold mt-1 tabular-nums">
            <AnimatedCounter target={estimatedSavings} prefix="€" decimals={2} />
          </p>
          <p className="text-sm text-white/60 mt-1">Since {installation.install_date}</p>
        </div>

        {/* Energy Chart */}
        <EnergyChart />

        {/* Tip Card */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-100/50 p-5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-white shadow-sm flex items-center justify-center flex-shrink-0">
              <Leaf className="w-4.5 h-4.5 text-emerald-500" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900">Energy Saving Tip</h4>
              <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                Run your dishwasher and washing machine between <strong>11am – 3pm</strong> to use solar power directly and save more.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Contact Installer', icon: Phone, desc: 'SE Systems', color: 'text-[#D4AF37]', bg: 'bg-[#D4AF37]/8' },
              { label: 'Report Issue', icon: AlertTriangle, desc: 'Get support', color: 'text-red-500', bg: 'bg-red-50' },
              { label: 'Maintenance', icon: Wrench, desc: 'Schedule service', color: 'text-blue-500', bg: 'bg-blue-50' },
              { label: 'Warranty Info', icon: Shield, desc: 'View coverage', color: 'text-emerald-500', bg: 'bg-emerald-50' },
            ].map((a) => (
              <button key={a.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-left hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 active:scale-[0.98] group">
                <div className={`w-10 h-10 rounded-xl ${a.bg} flex items-center justify-center mb-3`}>
                  <a.icon className={`w-5 h-5 ${a.color}`} />
                </div>
                <p className="text-sm font-semibold text-gray-900 group-hover:text-[#D4AF37] transition-colors">{a.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{a.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Warranty Coverage */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Warranty Coverage</h3>
          <div className="space-y-2.5">
            {[
              { label: 'Solar Panels', years: installation.system_specs.panel_warranty_years, icon: Sun, color: 'text-amber-500' },
              { label: 'Inverter', years: installation.system_specs.inverter_warranty_years, icon: Zap, color: 'text-blue-500' },
              { label: 'Workmanship', years: installation.system_specs.workmanship_warranty_years, icon: Shield, color: 'text-[#D4AF37]' },
            ].map((w) => {
              const yearsUsed = daysSinceInstall / 365;
              const pct = Math.min((yearsUsed / w.years) * 100, 100);
              return (
                <div key={w.label} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <w.icon className={`w-4 h-4 ${w.color}`} />
                      <span className="text-sm font-medium text-gray-900">{w.label}</span>
                    </div>
                    <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      {w.years} years
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#D4AF37] to-[#F5D874] transition-all duration-1000"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1.5">
                    {Math.round(w.years - yearsUsed)} years remaining
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pt-4 pb-2">
          <Image
            src="/branding/openhouse-care-logo.png"
            alt="OpenHouse AI"
            width={24}
            height={24}
            className="mx-auto mb-1.5 opacity-30"
          />
          <p className="text-[11px] text-gray-300">Powered by OpenHouse Care</p>
        </div>
      </div>
    </div>
  );
}
