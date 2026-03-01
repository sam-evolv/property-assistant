'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useCareApp } from '../care-app-provider';
import {
  Sun, Zap, TrendingUp, Shield, Wrench, Phone,
  Leaf, Battery, AlertTriangle, Calendar, CheckCircle2,
  ArrowUpRight, ThermometerSun,
} from 'lucide-react';

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

/* ── Main ── */
export default function HomeScreen() {
  const { installation } = useCareApp();
  const daysSince = Math.floor((Date.now() - new Date(installation.install_date).getTime()) / 86400000);
  const savings = daysSince * 5.8;

  return (
    <div className="h-full overflow-y-auto bg-[#FAFAFA]">
      <div className="max-w-lg mx-auto px-4 pt-5 pb-8 space-y-5">

        {/* ── Greeting ── */}
        <div>
          <p className="text-sm text-slate-500">
            {getGreeting()}, <span className="font-semibold text-slate-900">{getFirstName(installation.customer_name)}</span>
          </p>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-0.5">Your Solar System</h1>
        </div>

        {/* ── System Status Card — premium with gold accent ── */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500" />
          <div className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-sm font-semibold text-emerald-600">System Healthy</span>
              <span className="ml-auto text-xs text-slate-400">Installed by <strong className="text-slate-600">{installation.installer_name}</strong></span>
            </div>
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
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { label: 'Generated\nToday', value: '4.2', unit: 'kWh', icon: Sun, iconColor: 'text-amber-500', bg: 'bg-amber-50' },
            { label: 'Saved\nToday', value: '€3.18', icon: TrendingUp, iconColor: 'text-emerald-500', bg: 'bg-emerald-50' },
            { label: 'System\nEfficiency', value: '94%', icon: Zap, iconColor: 'text-blue-500', bg: 'bg-blue-50' },
          ].map((m) => (
            <div key={m.label} className="rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-3.5 text-center">
              <div className={`w-8 h-8 rounded-xl ${m.bg} flex items-center justify-center mx-auto mb-2`}>
                <m.icon className={`w-4 h-4 ${m.iconColor}`} />
              </div>
              <p className="text-lg font-bold text-slate-900 tabular-nums leading-none">
                {m.value}
                {m.unit && <span className="text-xs font-medium text-slate-400 ml-0.5">{m.unit}</span>}
              </p>
              <p className="text-[10px] text-slate-400 font-medium mt-1.5 whitespace-pre-line leading-tight">{m.label}</p>
            </div>
          ))}
        </div>

        {/* ── Savings Card — green gradient ── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 p-5 text-white shadow-lg shadow-emerald-500/15">
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
        <div className="rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4">
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
        <div>
          <h3 className="text-sm font-semibold text-slate-900 mb-2.5">Warranty Coverage</h3>
          <div className="space-y-2">
            {[
              { label: 'Solar Panels', years: installation.system_specs.panel_warranty_years, icon: Sun, color: 'text-amber-500' },
              { label: 'Inverter', years: installation.system_specs.inverter_warranty_years, icon: Zap, color: 'text-blue-500' },
              { label: 'Workmanship', years: installation.system_specs.workmanship_warranty_years, icon: Shield, color: 'text-[#D4AF37]' },
            ].map((w) => {
              const used = daysSince / 365;
              const pct = Math.min((used / w.years) * 100, 100);
              const remaining = Math.round(w.years - used);
              return (
                <div key={w.label} className="rounded-xl bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.06)] px-4 py-3">
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
        <div>
          <h3 className="text-sm font-semibold text-slate-900 mb-2.5">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { label: 'Contact Installer', icon: Phone, desc: installation.installer_name, iconColor: 'text-[#D4AF37]', bg: 'bg-[#D4AF37]/8' },
              { label: 'Report Issue', icon: AlertTriangle, desc: 'Get support', iconColor: 'text-red-500', bg: 'bg-red-50' },
              { label: 'Schedule Service', icon: Calendar, desc: 'Book maintenance', iconColor: 'text-blue-500', bg: 'bg-blue-50' },
              { label: 'SEAI Grant Info', icon: Leaf, desc: 'Check eligibility', iconColor: 'text-emerald-500', bg: 'bg-emerald-50' },
            ].map((a) => (
              <button key={a.label} className="rounded-xl bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-3.5 text-left hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 active:scale-[0.98] group">
                <div className={`w-9 h-9 rounded-xl ${a.bg} flex items-center justify-center mb-2.5`}>
                  <a.icon className={`w-4.5 h-4.5 ${a.iconColor}`} />
                </div>
                <p className="text-[13px] font-semibold text-slate-900 group-hover:text-[#D4AF37] transition-colors">{a.label}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{a.desc}</p>
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
