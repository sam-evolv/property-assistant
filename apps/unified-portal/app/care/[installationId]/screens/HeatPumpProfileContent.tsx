'use client';

import { useState } from 'react';
import {
  Thermometer,
  Flame,
  Droplets,
  Gauge,
  Settings,
  ChevronDown,
  AlertTriangle,
  CheckCircle2,
  Layers,
  Shield,
} from 'lucide-react';

interface HeatPumpProfileContentProps {
  installation: any;
}

/* ────────────────────────────────────────────────────────────
   Expandable Component Card (accordion)
   ──────────────────────────────────────────────────────────── */
function ComponentCard({
  icon: Icon,
  iconColor,
  name,
  model,
  status,
  statusVariant = 'healthy',
  description,
  details,
  warningMessage,
}: {
  icon: React.ElementType;
  iconColor: string;
  name: string;
  model: string;
  status: string;
  statusVariant?: 'healthy' | 'warning';
  description?: string;
  details: { label: string; value: string }[];
  warningMessage?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  const pillClasses =
    statusVariant === 'warning'
      ? 'bg-amber-50 text-amber-700 border border-amber-200'
      : 'bg-emerald-50 text-emerald-700 border border-emerald-200';

  return (
    <button
      type="button"
      onClick={() => setExpanded((prev) => !prev)}
      className="w-full text-left rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden transition-all duration-150 active:scale-[0.97] hover:-translate-y-[3px] hover:shadow-md"
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center flex-shrink-0">
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">{name}</p>
          <p className="text-xs text-slate-400 truncate">{model}</p>
        </div>
        <span
          className={`text-[10px] font-medium px-2.5 py-0.5 rounded-full flex-shrink-0 flex items-center gap-1 ${pillClasses}`}
        >
          {statusVariant === 'warning' ? (
            <AlertTriangle className="w-3 h-3" />
          ) : (
            <CheckCircle2 className="w-3 h-3" />
          )}
          {status}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-300 ${
            expanded ? 'rotate-180' : ''
          }`}
        />
      </div>

      {/* Expandable detail area */}
      <div
        style={{
          maxHeight: expanded ? 500 : 0,
          transition: 'max-height 300ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        className="overflow-hidden"
      >
        <div className="px-4 pb-4 pt-0">
          <div className="border-t border-gray-100 pt-3 space-y-3">
            {/* Description */}
            {description && (
              <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
            )}

            {/* 2-col spec grid */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              {details.map((d) => (
                <div key={d.label}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {d.label}
                  </p>
                  <p className="text-sm font-medium text-slate-900 mt-0.5">{d.value}</p>
                </div>
              ))}
            </div>

            {/* Warning card if issue */}
            {warningMessage && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 leading-relaxed">{warningMessage}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

/* ────────────────────────────────────────────────────────────
   Main Heat Pump Profile Content
   ──────────────────────────────────────────────────────────── */
export default function HeatPumpProfileContent({ installation }: HeatPumpProfileContentProps) {
  const specs = installation.system_specs || {};

  const zonesTotal = specs.zones_total ?? 4;
  const warrantyYears = specs.workmanship_warranty_years ?? 7;
  const heatPumpModel = specs.heat_pump_model ?? installation.inverter_model ?? 'Daikin Altherma 3';
  const heatPumpSerial = specs.heat_pump_serial ?? 'Not recorded';
  const heatPumpCOP = specs.cop ?? '4.5';
  const heatPumpWarranty = specs.heat_pump_warranty_years ?? warrantyYears;
  const heatPumpRuntime = specs.runtime_hours ?? '2,400 hrs';
  const hotWaterCylinderModel = specs.hot_water_cylinder_model ?? 'Joule Cyclone 300L';
  const hotWaterTemp = specs.hot_water_temp ?? '55';
  const controlsModel = specs.controls_model ?? 'Daikin EKRUCBL3';
  const controlsIssue = specs.controls_issue ?? false;
  const flowTemp = specs.flow_temp ?? '40';
  const berRating = specs.ber_rating ?? 'A2';

  return (
    <div className="space-y-4">
      {/* -- SYSTEM TYPE card -- */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5 text-center">
        <p
          className="font-semibold uppercase tracking-widest text-[#D4AF37] mb-2"
          style={{ fontSize: 10 }}
        >
          SYSTEM TYPE
        </p>
        <p className="text-lg font-bold text-slate-900">
          Air-to-Water Heat Pump + Underfloor Heating
        </p>
      </div>

      {/* -- 2-col Stat Grid: Zones + Warranty -- */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 text-center transition-all duration-150 hover:-translate-y-[3px] hover:shadow-md">
          <Layers className="w-6 h-6 text-[#D4AF37] mx-auto mb-2" />
          <p className="text-2xl font-bold text-slate-900">{zonesTotal}</p>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mt-1">
            Heating Zones
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 text-center transition-all duration-150 hover:-translate-y-[3px] hover:shadow-md">
          <Shield className="w-6 h-6 text-[#D4AF37] mx-auto mb-2" />
          <p className="text-2xl font-bold text-slate-900">{warrantyYears} years</p>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mt-1">
            Year Warranty
          </p>
        </div>
      </div>

      {/* -- Component Cards (expandable accordion) -- */}
      <div className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Components
        </p>

        {/* Heat Pump */}
        <ComponentCard
          icon={Thermometer}
          iconColor="text-[#D4AF37]"
          name="Heat Pump"
          model={heatPumpModel}
          status="OK"
          statusVariant="healthy"
          description="Your air-to-water heat pump extracts heat from outside air and transfers it to your heating and hot water system."
          details={[
            { label: 'COP', value: String(heatPumpCOP) },
            { label: 'Serial', value: heatPumpSerial },
            { label: 'Runtime', value: String(heatPumpRuntime) },
            { label: 'Installed', value: new Date(installation.install_date).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' }) },
            { label: 'Warranty', value: `${heatPumpWarranty} years` },
            { label: 'Model', value: heatPumpModel },
          ]}
        />

        {/* Underfloor Heating */}
        <ComponentCard
          icon={Flame}
          iconColor="text-orange-500"
          name="Underfloor Heating"
          model="Pipelife Qual-Pex Plus+"
          status="OK"
          statusVariant="healthy"
          description="Wet underfloor heating distributes warmth evenly across each zone via embedded pipework."
          details={[
            { label: 'Zones', value: String(zonesTotal) },
            { label: 'Flow Temp', value: `${flowTemp}\u00B0C` },
            { label: 'Installed', value: new Date(installation.install_date).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' }) },
            { label: 'Warranty', value: `${warrantyYears} years` },
          ]}
        />

        {/* Hot Water Cylinder */}
        <ComponentCard
          icon={Droplets}
          iconColor="text-blue-500"
          name="Hot Water Cylinder"
          model={hotWaterCylinderModel}
          status="OK"
          statusVariant="healthy"
          description="Your insulated cylinder stores hot water heated by the heat pump for domestic use."
          details={[
            { label: 'Model', value: hotWaterCylinderModel },
            { label: 'Current Temp', value: `${hotWaterTemp}\u00B0C` },
            { label: 'Installed', value: new Date(installation.install_date).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' }) },
            { label: 'Warranty', value: `${warrantyYears} years` },
          ]}
        />

        {/* Controls */}
        <ComponentCard
          icon={Settings}
          iconColor="text-slate-600"
          name="Controls"
          model={controlsModel}
          status={controlsIssue ? 'Attention' : 'OK'}
          statusVariant={controlsIssue ? 'warning' : 'healthy'}
          description="The control unit manages heating schedules, zone temperatures and hot water timing."
          details={[
            { label: 'Model', value: controlsModel },
            { label: 'Zone 1', value: controlsIssue ? 'Check required' : 'Active' },
            { label: 'Zone 2', value: 'Active' },
            ...(zonesTotal > 2
              ? [{ label: `Zone 3${zonesTotal > 3 ? '+' : ''}`, value: controlsIssue ? 'Flagged' : 'Active' }]
              : []),
            { label: 'Installed', value: new Date(installation.install_date).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' }) },
            { label: 'Warranty', value: `${warrantyYears} years` },
          ]}
          warningMessage={
            controlsIssue
              ? 'Zone scheduling may need recalibration. Try resetting the controller by holding the power button for 5 seconds. If the issue persists, contact your installer.'
              : undefined
          }
        />
      </div>

      {/* -- Optimal Settings card -- */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
        <h3 className="text-sm font-bold text-slate-900 mb-0.5">
          Optimal settings for your home
        </h3>
        <p className="text-xs text-slate-400 mb-4">Based on your installed system</p>

        <div className="divide-y divide-[#e5e7eb]">
          {[
            {
              label: 'Flow Temperature',
              description: 'Recommended range for underfloor heating',
              value: '38\u201342\u00B0C',
            },
            {
              label: 'Room Temperature',
              description: 'Comfortable and efficient target',
              value: '20\u201321\u00B0C',
            },
            {
              label: 'Hot Water',
              description: 'Legionella-safe cylinder target',
              value: '55\u00B0C',
            },
            {
              label: 'Night Setback',
              description: 'Reduced overnight temperature',
              value: '17\u00B0C',
            },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">{row.label}</p>
                <p className="text-xs text-gray-400">{row.description}</p>
              </div>
              <span className="flex-shrink-0 bg-[#D4AF37]/10 text-[#D4AF37] rounded-lg px-3 py-1 text-sm font-semibold">
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* -- Equipment table -- */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">
          Equipment
        </p>
        <div className="space-y-3">
          {[
            { label: 'Heat Pump Model', value: heatPumpModel },
            { label: 'Installer', value: installation.installer_name },
            {
              label: 'Install Date',
              value: new Date(installation.install_date).toLocaleDateString('en-IE', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              }),
            },
            { label: 'Controls', value: controlsModel },
            { label: 'Hot Water Cylinder', value: hotWaterCylinderModel },
            { label: 'BER Rating', value: berRating },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <span className="text-sm text-slate-400">{item.label}</span>
              <span className="text-sm font-medium text-slate-900">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
