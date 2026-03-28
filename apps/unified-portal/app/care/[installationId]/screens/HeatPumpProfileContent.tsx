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
  CircuitBoard,
} from 'lucide-react';

interface HeatPumpProfileContentProps {
  installation: any;
}

/* ────────────────────────────────────────────────────────────
   Expandable component card (accordion with max-height transition)
   ──────────────────────────────────────────────────────────── */
function ComponentCard({
  icon: Icon,
  iconColor,
  name,
  model,
  status,
  statusVariant = 'healthy',
  details,
}: {
  icon: React.ElementType;
  iconColor: string;
  name: string;
  model: string;
  status: string;
  statusVariant?: 'healthy' | 'warning';
  details: { label: string; value: string }[];
}) {
  const [expanded, setExpanded] = useState(false);

  const pillClasses =
    statusVariant === 'warning'
      ? 'bg-amber-50 text-amber-700'
      : 'bg-emerald-50 text-emerald-700';

  return (
    <button
      type="button"
      onClick={() => setExpanded((prev) => !prev)}
      className="w-full text-left rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden"
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
          className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 flex items-center gap-1 ${pillClasses}`}
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
        className={`${
          expanded ? 'max-h-[400px]' : 'max-h-0'
        } overflow-hidden transition-all duration-300`}
      >
        <div className="px-4 pb-4 pt-0">
          <div className="border-t border-slate-100 pt-3">
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

  const zonesTotal = specs.zones_total ?? 3;
  const warrantyYears = specs.workmanship_warranty_years ?? 5;
  const heatPumpModel = specs.heat_pump_model ?? installation.inverter_model ?? 'Daikin Altherma 3';
  const heatPumpSerial = specs.heat_pump_serial ?? 'Not recorded';
  const heatPumpCOP = specs.cop ?? '4.5';
  const heatPumpWarranty = specs.heat_pump_warranty_years ?? warrantyYears;
  const hotWaterCylinderModel = specs.hot_water_cylinder_model ?? 'Joule Cyclone 300L';
  const hotWaterTemp = specs.hot_water_temp ?? '55';
  const controlsModel = specs.controls_model ?? 'Daikin EKRUCBL3';
  const controlsIssue = specs.controls_issue ?? false;
  const flowTemp = specs.flow_temp ?? '40';
  const berRating = specs.ber_rating ?? 'A2';

  return (
    <div className="space-y-4">
      {/* ── SYSTEM TYPE card ── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
          System Type
        </p>
        <div className="flex items-center gap-2">
          <Thermometer className="w-5 h-5 text-[#D4AF37] flex-shrink-0" />
          <p className="text-lg font-bold text-slate-900">
            Air-to-Water Heat Pump + Underfloor Heating
          </p>
        </div>
      </div>

      {/* ── 2-col grid: Zones + Warranty ── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-[#D4AF37]/20 bg-white shadow-sm p-4 text-center">
          <Flame className="w-5 h-5 text-[#D4AF37] mx-auto mb-2" />
          <p className="text-2xl font-bold text-slate-900">{zonesTotal}</p>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mt-1">
            Heating Zones
          </p>
        </div>
        <div className="rounded-xl border border-[#D4AF37]/20 bg-white shadow-sm p-4 text-center">
          <CircuitBoard className="w-5 h-5 text-[#D4AF37] mx-auto mb-2" />
          <p className="text-2xl font-bold text-slate-900">{warrantyYears}</p>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mt-1">
            Year Warranty
          </p>
        </div>
      </div>

      {/* ── Component Cards (expandable) ── */}
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
          status="Operational"
          statusVariant="healthy"
          details={[
            { label: 'Model', value: heatPumpModel },
            { label: 'Serial', value: heatPumpSerial },
            { label: 'COP', value: String(heatPumpCOP) },
            { label: 'Warranty', value: `${heatPumpWarranty} years` },
          ]}
        />

        {/* Underfloor Heating */}
        <ComponentCard
          icon={Flame}
          iconColor="text-orange-500"
          name="Underfloor Heating"
          model="Pipelife Qual-Pex Plus+"
          status="Operational"
          statusVariant="healthy"
          details={[
            { label: 'Pipe System', value: 'Pipelife Qual-Pex Plus+' },
            { label: 'Zones', value: String(zonesTotal) },
            { label: 'Flow Temp', value: `${flowTemp}\u00B0C` },
            { label: 'Type', value: 'Wet System' },
          ]}
        />

        {/* Hot Water Cylinder */}
        <ComponentCard
          icon={Droplets}
          iconColor="text-blue-500"
          name="Hot Water Cylinder"
          model={hotWaterCylinderModel}
          status="Operational"
          statusVariant="healthy"
          details={[
            { label: 'Model', value: hotWaterCylinderModel },
            { label: 'Current Temp', value: `${hotWaterTemp}\u00B0C` },
            { label: 'Target', value: '55\u00B0C' },
            { label: 'Reheat Time', value: '~45 min' },
          ]}
        />

        {/* Controls */}
        <ComponentCard
          icon={Settings}
          iconColor="text-slate-600"
          name="Controls"
          model={controlsModel}
          status={controlsIssue ? 'Attention Needed' : 'Operational'}
          statusVariant={controlsIssue ? 'warning' : 'healthy'}
          details={[
            { label: 'Model', value: controlsModel },
            { label: 'Zone 1', value: controlsIssue ? 'Check required' : 'Active' },
            { label: 'Zone 2', value: 'Active' },
            ...(zonesTotal > 2
              ? [{ label: `Zone 3${zonesTotal > 3 ? '+' : ''}`, value: 'Active' }]
              : []),
          ]}
        />
      </div>

      {/* ── Optimal Settings card ── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">
          Optimal Settings
        </p>
        <div className="space-y-3">
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
              value: '18\u00B0C',
            },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">{row.label}</p>
                <p className="text-[11px] text-slate-400">{row.description}</p>
              </div>
              <span
                className="flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(212,175,55,0.15)', color: '#9A7A2E' }}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Equipment table ── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
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
            { label: 'BER Rating', value: berRating },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <span className="text-sm text-slate-500">{item.label}</span>
              <span className="text-sm font-medium text-slate-900">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
