'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useCareApp } from '../care-app-provider';
import {
  Sparkles, MapPin, Home, FileText, Bookmark,
  Sun, Zap, Battery, Shield, Wrench, Calendar,
  ChevronRight, ExternalLink, LogOut,
} from 'lucide-react';

export default function ProfileScreen() {
  const { installation } = useCareApp();
  const [activeSection, setActiveSection] = useState<'system' | 'documents' | 'warranty'>('system');
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClientComponentClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const isHeatPump = installation.system_category === 'heat_pump' || installation.system_type === 'heat_pump';
  const daysSince = Math.floor((Date.now() - new Date(installation.install_date).getTime()) / 86400000);

  return (
    <div className="h-full overflow-y-auto bg-[#FAFAFA]">
      <div className="max-w-lg mx-auto px-4 pt-5 pb-8">

        {/* ── Header Card — matches Property PurchaserProfilePanel ── */}
        <div className="rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.04)] overflow-hidden">

          {/* Gold accent bar */}
          <div className="h-1 bg-gradient-to-r from-[#D4AF37] via-[#F5D874] to-[#D4AF37]" />

          <div className="p-6">
            {/* MY HOME badge — same as Property */}
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-gold-400 to-gold-600">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs font-medium uppercase tracking-wider text-gold-600">
                My System
              </span>
            </div>

            {/* Name */}
            <h2 className="text-2xl font-bold text-gray-900 mb-1">
              Welcome, {installation.customer_name}
            </h2>

            {/* Address */}
            <div className="flex items-start gap-2 text-gray-600">
              <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">{installation.address_line_1}</p>
                <p className="text-xs text-gray-400">{installation.city}, {installation.county}</p>
              </div>
            </div>

            {/* Tags */}
            <div className="flex items-center gap-1.5 mt-3 flex-wrap">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: 'rgba(196,164,74,0.15)', color: '#9A7A2E' }}>
                {isHeatPump ? (installation.heat_pump_model || 'Heat Pump') : `${installation.system_size_kwp} kWp`}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">
                🗓 Installed: {new Date(installation.install_date).toLocaleDateString('en-IE', { month: 'short', year: 'numeric' })}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700">
                ✓ {daysSince} days active
              </span>
            </div>
          </div>

          {/* Section Tabs — matches Property PurchaserProfilePanel tabs */}
          <div className="px-6 flex gap-2 border-t border-slate-100">
            {([
              { id: 'system' as const, label: 'System Details', icon: Home },
              { id: 'documents' as const, label: 'Documents', icon: FileText },
              { id: 'warranty' as const, label: 'Warranty', icon: Shield },
            ]).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
                  activeSection === tab.id
                    ? 'text-gold-600 border-gold-500'
                    : 'text-gray-400 border-transparent hover:text-gray-600'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeSection === 'system' && isHeatPump && (() => {
              const HeatPumpProfileContent = require('./HeatPumpProfileContent').default;
              return <HeatPumpProfileContent installation={installation} />;
            })()}

            {activeSection === 'system' && !isHeatPump && (
              <div className="space-y-4">
                {/* System type card — matches Property HOUSE TYPE card */}
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">System Type</p>
                  <p className="text-lg font-bold text-slate-900">{installation.system_size_kwp} kWp Solar PV</p>
                </div>

                {/* Grid — matches Property BEDROOMS/BATHROOMS layout */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-[#D4AF37]/20 p-4 text-center">
                    <Sun className="w-5 h-5 text-[#D4AF37] mx-auto mb-2" />
                    <p className="text-2xl font-bold text-slate-900">{installation.panel_count}</p>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mt-1">Panels</p>
                  </div>
                  <div className="rounded-xl border border-[#D4AF37]/20 p-4 text-center">
                    <Zap className="w-5 h-5 text-[#D4AF37] mx-auto mb-2" />
                    <p className="text-2xl font-bold text-slate-900">1</p>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mt-1">Inverter</p>
                  </div>
                </div>

                {installation.system_specs.battery && (
                  <div className="rounded-xl border border-[#D4AF37]/20 p-4 text-center">
                    <Battery className="w-5 h-5 text-[#D4AF37] mx-auto mb-2" />
                    <p className="text-lg font-bold text-slate-900">{installation.system_specs.battery}</p>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mt-1">Battery Storage</p>
                  </div>
                )}

                {/* Equipment details */}
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">Equipment</p>
                  <div className="space-y-3">
                    {[
                      { label: 'Panel Model', value: installation.panel_model },
                      { label: 'Inverter', value: installation.inverter_model },
                      { label: 'Installer', value: installation.installer_name },
                      { label: 'Install Date', value: new Date(installation.install_date).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' }) },
                      { label: 'System Orientation', value: installation.system_specs?.roof_orientation || 'Not recorded' },
                      { label: 'Roof Pitch', value: installation.system_specs?.roof_pitch ? installation.system_specs.roof_pitch + '\u00B0' : 'Not recorded' },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between">
                        <span className="text-sm text-slate-500">{item.label}</span>
                        <span className="text-sm font-medium text-slate-900">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'documents' && (
              <div className="space-y-3">
                <p className="text-sm text-slate-500 mb-4">
                  Documents will appear here once uploaded by your installer.
                </p>
                {[
                  'Installation Certificate',
                  'BER Certificate',
                  'SEAI Grant Confirmation',
                  'System Commissioning Report',
                  'Panel Warranty Certificate',
                  'Inverter Warranty Certificate',
                ].map((title) => (
                  <div key={title} className="w-full flex items-center gap-3 rounded-xl border border-slate-200 p-3.5 opacity-50">
                    <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{title}</p>
                      <p className="text-[11px] text-slate-400">PDF</p>
                    </div>
                    <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full flex-shrink-0">
                      Pending
                    </span>
                  </div>
                ))}
              </div>
            )}

            {activeSection === 'warranty' && (
              <div className="space-y-4">
                {[
                  { label: 'Solar Panels', years: installation.system_specs.panel_warranty_years, icon: Sun, color: 'text-amber-500', provider: installation.panel_model.split(' ')[0] },
                  { label: 'Inverter', years: installation.system_specs.inverter_warranty_years, icon: Zap, color: 'text-blue-500', provider: installation.inverter_model.split(' ')[0] },
                  { label: 'Workmanship', years: installation.system_specs.workmanship_warranty_years, icon: Wrench, color: 'text-[#D4AF37]', provider: installation.installer_name },
                ].map((w) => {
                  const used = daysSince / 365;
                  const pct = Math.min((used / w.years) * 100, 100);
                  const remaining = Math.max(0, w.years - used);
                  const expiry = new Date(installation.install_date);
                  expiry.setFullYear(expiry.getFullYear() + w.years);
                  return (
                    <div key={w.label} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center">
                          <w.icon className={`w-5 h-5 ${w.color}`} />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-slate-900">{w.label}</p>
                          <p className="text-xs text-slate-400">{w.provider}</p>
                        </div>
                        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                          Active
                        </span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
                        <div className="h-full rounded-full bg-gradient-to-r from-[#D4AF37] to-[#F5D874]" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>{remaining.toFixed(1)} years remaining</span>
                        <span>Expires: {expiry.toLocaleDateString('en-IE', { month: 'short', year: 'numeric' })}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Sign out button */}
        <button
          onClick={handleSignOut}
          className="w-full mt-6 flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-medium text-red-500 shadow-sm transition hover:bg-red-50 hover:border-red-200 active:scale-[0.98]"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>

      </div>
    </div>
  );
}
