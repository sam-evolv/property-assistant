'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  Sun, Zap, TrendingUp, Calendar, AlertTriangle, CheckCircle,
  ArrowUpRight, Battery, Thermometer, Clock, ChevronRight,
} from 'lucide-react';

// ============================================================================
// Design Tokens (matching Property dashboard)
// ============================================================================

const tokens = {
  gold: '#D4AF37',
  goldLight: '#F5D874',
  goldDark: '#B8934C',
};

// ============================================================================
// Types
// ============================================================================

interface SystemOverview {
  systemType: string;
  capacity: string;
  panelCount: number;
  inverterModel: string;
  installDate: string;
  warrantyExpiry: string;
}

interface PerformanceData {
  todayGeneration: string;
  monthGeneration: string;
  yearGeneration: string;
  co2Saved: string;
  selfConsumption: string;
}

interface AlertItem {
  id: string;
  type: 'warning' | 'info' | 'success';
  title: string;
  description: string;
  date: string;
}

// ============================================================================
// Mock Data
// ============================================================================

const mockSystem: SystemOverview = {
  systemType: 'Solar PV',
  capacity: '6.6 kWp',
  panelCount: 16,
  inverterModel: 'SolarEdge SE6000H',
  installDate: '2024-03-15',
  warrantyExpiry: '2034-03-15',
};

const mockPerformance: PerformanceData = {
  todayGeneration: '18.4 kWh',
  monthGeneration: '420 kWh',
  yearGeneration: '5,240 kWh',
  co2Saved: '2.1 tonnes',
  selfConsumption: '68%',
};

const mockAlerts: AlertItem[] = [
  {
    id: '1',
    type: 'success',
    title: 'System performing well',
    description: 'Your solar system is generating above average for this time of year.',
    date: '2 hours ago',
  },
  {
    id: '2',
    type: 'info',
    title: 'Annual service due',
    description: 'Your annual system check is due in 30 days. We\'ll be in touch to schedule.',
    date: '1 day ago',
  },
];

// ============================================================================
// Sub-Components
// ============================================================================

function StatCard({
  icon: Icon,
  label,
  value,
  subtitle,
  color = 'text-gray-600',
}: {
  icon: typeof Sun;
  label: string;
  value: string;
  subtitle?: string;
  color?: string;
}) {
  return (
    <div className="bg-white border border-gold-100 rounded-lg shadow-sm p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-150">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-gold-50 flex items-center justify-center">
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function AlertCard({ alert }: { alert: AlertItem }) {
  const styles = {
    warning: { bg: 'bg-amber-50', border: 'border-amber-200', icon: AlertTriangle, iconColor: 'text-amber-500' },
    info: { bg: 'bg-blue-50', border: 'border-blue-200', icon: Clock, iconColor: 'text-blue-500' },
    success: { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: CheckCircle, iconColor: 'text-emerald-500' },
  };
  const style = styles[alert.type];
  const Icon = style.icon;

  return (
    <div className={`${style.bg} border ${style.border} rounded-lg p-4 transition-all duration-150`}
      style={{ animation: 'fadeIn 0.4s ease-out' }}
    >
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 ${style.iconColor} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{alert.title}</p>
          <p className="text-xs text-gray-600 mt-0.5">{alert.description}</p>
          <p className="text-[10px] text-gray-400 mt-1">{alert.date}</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface HomeScreenProps {
  installationId: string;
}

export default function HomeScreen({ installationId }: HomeScreenProps) {
  const [installation, setInstallation] = useState<any>(null);
  const [system, setSystem] = useState<SystemOverview>(mockSystem);
  const [performance, setPerformance] = useState<PerformanceData>(mockPerformance);
  const [alerts, setAlerts] = useState<AlertItem[]>(mockAlerts);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInstallationData();
  }, [installationId]);

  const fetchInstallationData = async () => {
    try {
      const response = await fetch(`/api/care/installations/${installationId}`);
      if (!response.ok) throw new Error('Failed to fetch installation');

      const { installation: inst, solarData, alerts: dbAlerts } = await response.json();
      setInstallation(inst);

      // Build system overview from installation data
      const systemData: SystemOverview = {
        systemType: inst.system_type,
        capacity: inst.capacity || '6.6 kWp',
        panelCount: inst.component_specs?.panelCount || 16,
        inverterModel: inst.component_specs?.inverter || inst.system_model,
        installDate: inst.installation_date,
        warrantyExpiry: inst.warranty_expiry || new Date(new Date().getTime() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString(),
      };
      setSystem(systemData);

      // Build performance data from telemetry
      if (solarData && inst.system_type === 'solar') {
        const performanceData: PerformanceData = {
          todayGeneration: `${solarData.generation.today.toFixed(1)} kWh`,
          monthGeneration: `${solarData.generation.thisMonth.toFixed(0)} kWh`,
          yearGeneration: `${solarData.generation.thisYear.toFixed(0)} kWh`,
          co2Saved: `${(solarData.generation.thisYear * 0.407 / 1000).toFixed(2)} tonnes`,
          selfConsumption: `${solarData.selfConsumption?.toFixed(0) || 68}%`,
        };
        setPerformance(performanceData);
      }

      // Set alerts
      if (dbAlerts && dbAlerts.length > 0) {
        const alertItems: AlertItem[] = dbAlerts.map((a: any) => ({
          id: a.id,
          type: a.alert_type === 'error' ? 'warning' : a.alert_type === 'warning' ? 'warning' : 'info',
          title: a.title,
          description: a.description,
          date: new Date(a.created_at).toLocaleDateString(),
        }));
        setAlerts(alertItems);
      }

      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch installation data:', error);
      setLoading(false);
      // Fall back to mock data
    }
  };

  if (loading) {
    return (
      <div className="flex-1 overflow-auto flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#D4AF37]" />
          <p className="text-sm text-gray-500 mt-2">Loading system data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Welcome Section */}
        <div
          className="rounded-2xl p-6 text-white relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${tokens.gold} 0%, ${tokens.goldDark} 100%)` }}
        >
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-white/20 flex items-center justify-center">
                <Image src="/icon-192.png" alt="OpenHouse Care" width={40} height={40} className="w-10 h-10 object-cover rounded-xl" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Your Solar System</h2>
                <p className="text-sm text-white/80">{system.capacity} &middot; {system.panelCount} panels</p>
              </div>
            </div>
            <div className="flex items-center gap-4 mt-4">
              <div>
                <p className="text-3xl font-bold">{performance.todayGeneration}</p>
                <p className="text-xs text-white/70">Generated today</p>
              </div>
              <div className="h-10 w-px bg-white/20" />
              <div>
                <p className="text-lg font-semibold">{performance.selfConsumption}</p>
                <p className="text-xs text-white/70">Self-consumption</p>
              </div>
            </div>
          </div>
          <Sun className="absolute right-4 bottom-4 w-24 h-24 text-white/10" />
        </div>

        {/* Performance Stats */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Performance Overview</h3>
          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={Zap} label="Today" value={performance.todayGeneration} color="text-[#D4AF37]" />
            <StatCard icon={TrendingUp} label="This Month" value={performance.monthGeneration} color="text-blue-500" />
            <StatCard icon={Battery} label="This Year" value={performance.yearGeneration} color="text-emerald-500" />
            <StatCard icon={Thermometer} label="CO2 Saved" value={performance.co2Saved} subtitle="Environmental impact" color="text-green-600" />
          </div>
        </div>

        {/* System Info */}
        <div className="bg-white border border-gold-100 rounded-lg shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">System Details</h3>
          <div className="space-y-2">
            {[
              { label: 'System Type', value: system.systemType },
              { label: 'Capacity', value: system.capacity },
              { label: 'Inverter', value: system.inverterModel },
              { label: 'Installed', value: new Date(system.installDate).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' }) },
              { label: 'Warranty Until', value: new Date(system.warrantyExpiry).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' }) },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-xs text-gray-500">{item.label}</span>
                <span className="text-sm font-medium text-gray-900">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Alerts */}
        {alerts.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Recent Updates</h3>
            <div className="space-y-3">
              {alerts.map((alert) => (
                <AlertCard key={alert.id} alert={alert} />
              ))}
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
