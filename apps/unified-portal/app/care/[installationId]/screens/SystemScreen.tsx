'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  Cpu, Sun, Battery, Zap, Thermometer, Calendar,
  Shield, MapPin, Phone, Mail, ChevronRight, ExternalLink,
  CheckCircle, AlertTriangle, Clock,
} from 'lucide-react';

// ============================================================================
// Design Tokens (matching Property dashboard)
// ============================================================================

const tokens = {
  gold: '#D4AF37',
  goldDark: '#B8934C',
};

// ============================================================================
// Types
// ============================================================================

interface SystemComponent {
  id: string;
  name: string;
  model: string;
  manufacturer: string;
  serialNumber: string;
  warrantyExpiry: string;
  status: 'healthy' | 'warning' | 'error';
}

interface InstallerInfo {
  company: string;
  contact: string;
  phone: string;
  email: string;
  seaiRegistered: boolean;
}

interface SystemSpec {
  label: string;
  value: string;
  icon: typeof Sun;
}

// ============================================================================
// Mock Data
// ============================================================================

const mockComponents: SystemComponent[] = [
  {
    id: '1',
    name: 'Solar Panels',
    model: 'JA Solar JAM72S30-545/MR',
    manufacturer: 'JA Solar',
    serialNumber: 'JAS-2024-001 to JAS-2024-016',
    warrantyExpiry: '2049-03-15',
    status: 'healthy',
  },
  {
    id: '2',
    name: 'Inverter',
    model: 'SolarEdge SE6000H',
    manufacturer: 'SolarEdge',
    serialNumber: 'SE-7F2A3B4C',
    warrantyExpiry: '2036-03-15',
    status: 'healthy',
  },
  {
    id: '3',
    name: 'Power Optimisers',
    model: 'SolarEdge P505',
    manufacturer: 'SolarEdge',
    serialNumber: 'Multiple (16 units)',
    warrantyExpiry: '2049-03-15',
    status: 'healthy',
  },
  {
    id: '4',
    name: 'Mounting System',
    model: 'K2 Systems SingleRail',
    manufacturer: 'K2 Systems',
    serialNumber: 'K2-BATCH-2024-03',
    warrantyExpiry: '2044-03-15',
    status: 'healthy',
  },
];

const mockInstaller: InstallerInfo = {
  company: 'SunPower Ireland Ltd.',
  contact: 'Michael O\'Brien',
  phone: '+353 1 234 5678',
  email: 'support@sunpowerireland.ie',
  seaiRegistered: true,
};

const mockSpecs: SystemSpec[] = [
  { label: 'System Capacity', value: '6.6 kWp', icon: Zap },
  { label: 'Panel Count', value: '16 panels', icon: Sun },
  { label: 'Roof Orientation', value: 'South-facing', icon: MapPin },
  { label: 'Tilt Angle', value: '35°', icon: Sun },
  { label: 'Annual Yield (est.)', value: '5,800 kWh', icon: Battery },
  { label: 'SEAI Grant', value: '€2,400 received', icon: Shield },
];

// ============================================================================
// Sub-Components
// ============================================================================

function ComponentCard({ component }: { component: SystemComponent }) {
  const statusConfig = {
    healthy: { icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-50', label: 'Healthy' },
    warning: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50', label: 'Attention Needed' },
    error: { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50', label: 'Issue Detected' },
  };
  const status = statusConfig[component.status];
  const StatusIcon = status.icon;

  return (
    <div className="bg-white border border-gold-100 rounded-lg shadow-sm p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-150">
      <div className="flex items-start justify-between mb-2">
        <h4 className="text-sm font-semibold text-gray-900">{component.name}</h4>
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${status.bg}`}>
          <StatusIcon className={`w-3 h-3 ${status.color}`} />
          <span className={`text-[10px] font-medium ${status.color}`}>{status.label}</span>
        </div>
      </div>
      <p className="text-xs text-gray-600 font-medium">{component.model}</p>
      <p className="text-[10px] text-gray-400 mt-0.5">{component.manufacturer}</p>
      <div className="mt-3 pt-3 border-t border-gray-50 space-y-1">
        <div className="flex justify-between">
          <span className="text-[10px] text-gray-400">Serial</span>
          <span className="text-[10px] text-gray-600 font-mono">{component.serialNumber}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[10px] text-gray-400">Warranty until</span>
          <span className="text-[10px] text-gray-600">
            {new Date(component.warrantyExpiry).toLocaleDateString('en-IE', { month: 'short', year: 'numeric' })}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface SystemScreenProps {
  installationId: string;
}

export default function SystemScreen({ installationId }: SystemScreenProps) {
  const [components] = useState<SystemComponent[]>(mockComponents);
  const [installer] = useState<InstallerInfo>(mockInstaller);
  const [specs] = useState<SystemSpec[]>(mockSpecs);

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-xl font-bold text-gray-900">System Details</h2>
          <p className="text-sm text-gray-500 mt-0.5">Your solar installation specifications and components</p>
        </div>

        {/* Specs Grid */}
        <div className="grid grid-cols-2 gap-3">
          {specs.map((spec) => {
            const Icon = spec.icon;
            return (
              <div key={spec.label} className="bg-white border border-gold-100 rounded-lg shadow-sm p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{spec.label}</span>
                </div>
                <p className="text-sm font-bold text-gray-900">{spec.value}</p>
              </div>
            );
          })}
        </div>

        {/* Components */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">System Components</h3>
          <div className="space-y-3">
            {components.map((component) => (
              <ComponentCard key={component.id} component={component} />
            ))}
          </div>
        </div>

        {/* Installer Info */}
        <div className="bg-white border border-gold-100 rounded-lg shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Your Installer</h3>
          <div className="flex items-start gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `linear-gradient(135deg, ${tokens.gold} 0%, ${tokens.goldDark} 100%)` }}
            >
              <Cpu className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{installer.company}</p>
              <p className="text-xs text-gray-500">{installer.contact}</p>
              {installer.seaiRegistered && (
                <div className="flex items-center gap-1 mt-1">
                  <CheckCircle className="w-3 h-3 text-emerald-500" />
                  <span className="text-[10px] text-emerald-600 font-medium">SEAI Registered Installer</span>
                </div>
              )}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-50 space-y-2">
            <a
              href={`tel:${installer.phone.replace(/\s/g, '')}`}
              className="flex items-center gap-2 text-sm text-[#D4AF37] hover:text-[#B8934C] transition-colors"
            >
              <Phone className="w-4 h-4" />
              {installer.phone}
            </a>
            <a
              href={`mailto:${installer.email}`}
              className="flex items-center gap-2 text-sm text-[#D4AF37] hover:text-[#B8934C] transition-colors"
            >
              <Mail className="w-4 h-4" />
              {installer.email}
            </a>
          </div>
        </div>

        {/* Warranty Timeline */}
        <div className="bg-white border border-gold-100 rounded-lg shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Warranty Coverage</h3>
          <div className="space-y-3">
            {components.map((component) => {
              const expiryDate = new Date(component.warrantyExpiry);
              const installDate = new Date('2024-03-15');
              const now = new Date();
              const totalMs = expiryDate.getTime() - installDate.getTime();
              const elapsedMs = now.getTime() - installDate.getTime();
              const progress = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100));
              const yearsRemaining = Math.round((expiryDate.getTime() - now.getTime()) / (365.25 * 24 * 60 * 60 * 1000));

              return (
                <div key={component.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-700">{component.name}</span>
                    <span className="text-[10px] text-gray-400">{yearsRemaining} years remaining</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${100 - progress}%`,
                        background: `linear-gradient(90deg, ${tokens.gold} 0%, ${tokens.goldDark} 100%)`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
