import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import {
  Sparkles, FolderArchive, MessageSquare,
  Sun, Users, AlertTriangle, CheckCircle, ChevronRight,
  Zap, Battery, Plus,
} from 'lucide-react';

const tokens = {
  gold: '#D4AF37',
  goldDark: '#B8934C',
};

const quickLinks = [
  { href: '/care-dashboard/installations', label: 'Installations', description: 'View and manage all installations', icon: Sun },
  { href: '/care-dashboard/intelligence', label: 'Intelligence', description: 'Ask anything about your installations', icon: Sparkles },
  { href: '/care-dashboard/archive', label: 'Document Archive', description: 'Installation records and documentation', icon: FolderArchive },
  { href: '/care-dashboard/communications', label: 'Communications', description: 'Customer and installer messaging', icon: MessageSquare },
];

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export default async function CareDashboardOverview() {
  const supabase = getSupabaseAdmin();

  // Fetch stats in parallel
  const [
    { count: totalInstallations },
    { data: capacityData },
    { data: healthData },
    { data: faultData },
    { data: recentInstallations },
  ] = await Promise.all([
    supabase.from('installations').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('installations').select('system_size_kwp').eq('is_active', true),
    supabase.from('installations').select('health_status').eq('is_active', true),
    supabase.from('installations').select('id', { count: 'exact', head: true }).eq('is_active', true).eq('health_status', 'fault'),
    supabase.from('installations').select('id, customer_name, system_type, system_size_kwp, city, job_reference, created_at').eq('is_active', true).order('created_at', { ascending: false }).limit(5),
  ]);

  const totalCount = totalInstallations ?? 0;
  const totalCapacityKwp = (capacityData || []).reduce((sum, r) => sum + (Number(r.system_size_kwp) || 0), 0);
  const capacityDisplay = totalCapacityKwp >= 1000
    ? `${(totalCapacityKwp / 1000).toFixed(1)} MWp`
    : `${totalCapacityKwp.toFixed(0)} kWp`;
  const healthyCount = (healthData || []).filter(r => r.health_status === 'healthy').length;
  const healthPct = totalCount > 0 ? Math.round((healthyCount / totalCount) * 100) : 0;
  const faultCount = faultData?.length ?? 0;

  const stats = [
    { label: 'Active Installations', value: String(totalCount), icon: Sun, color: 'text-amber-500', change: '' },
    { label: 'Total Capacity', value: capacityDisplay, icon: Zap, color: 'text-blue-500', change: '' },
    { label: 'Avg System Health', value: `${healthPct}%`, icon: Battery, color: 'text-emerald-500', change: '' },
    { label: 'Open Faults', value: String(faultCount), icon: AlertTriangle, color: 'text-amber-500', change: '' },
  ];

  const recent = recentInstallations || [];

  return (
    <div className="min-h-full bg-gray-50">
      <div className="p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Care Dashboard</h1>
              <p className="text-sm text-gray-500 mt-1">Solar aftercare management overview</p>
            </div>
            <Link
              href="/care-dashboard/installations/new"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
              style={{ background: `linear-gradient(135deg, ${tokens.gold}, ${tokens.goldDark})` }}
            >
              <Plus className="w-4 h-4" />
              New Installation
            </Link>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="bg-white border border-gold-100 rounded-xl shadow-sm p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{stat.label}</span>
                    <div className="w-9 h-9 rounded-lg bg-gold-50 flex items-center justify-center">
                      <Icon className={`w-5 h-5 ${stat.color}`} />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  {stat.change && <p className="text-xs text-gray-500 mt-1">{stat.change}</p>}
                </div>
              );
            })}
          </div>

          {/* Quick Links + Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Quick Links */}
            <div className="lg:col-span-1 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">Quick Actions</h3>
              {quickLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center gap-4 p-4 bg-white border border-gold-100 rounded-lg shadow-sm
                      hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 group"
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `linear-gradient(135deg, ${tokens.gold} 0%, ${tokens.goldDark} 100%)` }}
                    >
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 group-hover:text-[#D4AF37] transition-colors">{link.label}</p>
                      <p className="text-xs text-gray-500">{link.description}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#D4AF37] transition-colors" />
                  </Link>
                );
              })}
            </div>

            {/* Recent Activity */}
            <div className="lg:col-span-2">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Recent Installations</h3>
              <div className="bg-white border border-gold-100 rounded-lg shadow-sm overflow-hidden">
                {recent.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-gray-400">
                    No installations yet. Create your first one to get started.
                  </div>
                ) : (
                  recent.map((inst, i) => {
                    const systemLabel = inst.system_type === 'solar_pv' ? 'Solar PV' : inst.system_type === 'heat_pump' ? 'Heat Pump' : inst.system_type === 'ev_charger' ? 'EV Charger' : inst.system_type;
                    const sizeLabel = inst.system_size_kwp ? `${inst.system_size_kwp} kWp` : '';
                    const timeAgo = getTimeAgo(inst.created_at);
                    return (
                      <div
                        key={inst.id}
                        className={`flex items-start gap-3 px-4 py-3 ${
                          i < recent.length - 1 ? 'border-b border-gray-50' : ''
                        }`}
                      >
                        <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-700">
                            <span className="font-medium">{inst.customer_name}</span>
                            {' — '}
                            {[systemLabel, sizeLabel].filter(Boolean).join(' · ')}
                            {inst.city ? `, ${inst.city}` : ''}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {inst.job_reference} · {timeAgo}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });
}
